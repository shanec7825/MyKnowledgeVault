import { GenerationUsageError, reportedUsageFromGenerationError } from './chunk-NGJOFCTL.js';
import { interruptibleStream } from './chunk-HDHO73O7.js';
import { abortable } from './chunk-GDO34PSX.js';
import { randomBytes, createHash, createHmac, timingSafeEqual, createDecipheriv, createCipheriv, randomUUID } from 'crypto';
import { z } from 'zod';

var webSearchOptionsSchema = z.object({
  allowedDomains: z.array(z.string().min(1)).nullable().optional(),
  blockedDomains: z.array(z.string().min(1)).nullable().optional(),
  maxUses: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  userLocation: z.object({
    type: z.literal("approximate"),
    city: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    timezone: z.string().nullable().optional()
  }).strict().nullable().optional()
}).strict().refine(
  (value) => value.allowedDomains == null || value.blockedDomains == null,
  "Web search cannot combine allowed and blocked domains"
);
var ProviderError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ProviderError";
  }
  code;
};
var MissingProviderCredentialsError = class extends ProviderError {
  constructor(message) {
    super("invalid_request", message);
    this.name = "MissingProviderCredentialsError";
  }
};
function validateTemperature(value) {
  if (value !== void 0 && !Number.isFinite(value)) {
    throw new ProviderError("invalid_request", "Temperature must be finite");
  }
  return value;
}
function imageUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ProviderError("invalid_request", "Image URL must be a nonempty string");
  }
  return value;
}
function responseSchemaName(value) {
  if (value === void 0) return "result";
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw new ProviderError(
      "invalid_request",
      "Schema name must contain 1 to 64 letters, digits, underscores or hyphens"
    );
  }
  return value;
}
var ProviderCleanupError = class extends Error {
  constructor(unconfirmed, options) {
    super(unconfirmed ? "Provider cleanup could not be confirmed" : "Provider cleanup failed", options);
    this.unconfirmed = unconfirmed;
    this.name = "ProviderCleanupError";
  }
  unconfirmed;
  code = "cleanup_failed";
};
var ProviderRegistry = class {
  constructor(options) {
    this.options = options;
    this.continuationSecret = Buffer.from(options.continuationSecret ?? randomBytes(32));
    if (this.continuationSecret.length !== 32) throw new Error("Continuation secret must contain 32 bytes");
    for (const provider of options.providers) {
      if (this.providers.has(provider.descriptor.id))
        throw new Error(`Duplicate provider: ${provider.descriptor.id}`);
      this.providers.set(provider.descriptor.id, provider);
    }
  }
  options;
  providers = /* @__PURE__ */ new Map();
  continuationSecret;
  descriptors() {
    return structuredClone([...this.providers.values()].map((provider) => provider.descriptor));
  }
  signContinuation(request, credentials, continuation) {
    if (!request.consumerId?.trim() || !request.conversationId?.trim() || !request.credentialOwnerId?.trim())
      throw new ProviderError(
        "invalid_request",
        "Continuation requires server-derived caller, conversation and credential owner identities"
      );
    const configuration = createHash("sha256").update(JSON.stringify(Object.entries(credentials).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
    return createHmac("sha256", this.continuationSecret).update(
      JSON.stringify({
        provider: continuation.provider,
        model: continuation.model,
        data: continuation.data,
        consumerId: request.consumerId ?? null,
        conversationId: request.conversationId ?? null,
        credentialOwnerId: request.credentialOwnerId ?? null,
        configuration
      })
    ).digest("hex");
  }
  adapter(id) {
    const adapter = this.providers.get(id);
    if (!adapter) throw new ProviderError("unknown_provider", `Unknown provider: ${id}`);
    return adapter;
  }
  async readiness(provider, signal = AbortSignal.timeout(1e4)) {
    signal.throwIfAborted();
    const adapter = this.adapter(provider);
    const credentials = await abortable(this.options.credentials.resolve(provider), signal);
    return abortable(adapter.readiness({ credentials, signal }), signal);
  }
  async models(provider, signal = AbortSignal.timeout(1e4)) {
    signal.throwIfAborted();
    const adapter = this.adapter(provider);
    const credentials = await abortable(this.options.credentials.resolve(provider), signal);
    return abortable(adapter.models({ credentials, signal }), signal);
  }
  /** Reuse the selected transport's probe without treating outages as rejected credentials. */
  async validateCredentials(provider, signal) {
    signal?.throwIfAborted();
    const adapter = this.adapter(provider);
    const deadline = AbortSignal.timeout(1e4);
    const probeSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
    let readiness;
    try {
      const credentials = await abortable(this.options.credentials.resolve(provider), probeSignal);
      signal?.throwIfAborted();
      if (adapter.descriptor.transport !== "api" || credentials.allowAnonymous === true)
        return {
          status: "inconclusive",
          readiness: { code: "unsupported", checkedAt: Date.now(), action: "configure" }
        };
      readiness = await abortable(adapter.readiness({ credentials, signal: probeSignal }), probeSignal);
    } catch {
      signal?.throwIfAborted();
      readiness = { code: "unreachable", checkedAt: Date.now(), action: "retry" };
    }
    signal?.throwIfAborted();
    const status = readiness.code === "ready" && readiness.authentication === "verified" ? "valid" : readiness.code === "not_authenticated" ? "rejected" : readiness.code === "missing_credentials" ? "missing" : "inconclusive";
    return { status, readiness };
  }
  generate(request) {
    return interruptibleStream((signal) => this.run({ ...request, signal }), {
      signal: request.signal,
      isCleanupError: (error) => error instanceof ProviderCleanupError
    });
  }
  async *run(request) {
    const bindings = [request.consumerId, request.conversationId, request.credentialOwnerId];
    const resumable = bindings.every((value) => Boolean(value?.trim()));
    if ((request.continuation || bindings.some((value) => value !== void 0)) && !resumable)
      throw new ProviderError(
        "invalid_request",
        "Continuation requires server-derived caller, conversation and credential owner identities"
      );
    const adapter = this.adapter(request.provider);
    const providerTimeout = this.options.timeoutMode === "provider";
    if (providerTimeout && (!adapter.managesAttemptTimeouts || request.timeoutMs !== void 0))
      throw new ProviderError(
        "invalid_request",
        "Provider timing requires adapter support and no request timeout"
      );
    if (request.webSearch !== void 0) {
      webSearchOptionsSchema.parse(request.webSearch);
      if (!request.allowWeb)
        throw new ProviderError("invalid_request", "Web search settings require web search to be enabled");
      if (!adapter.supportsWebSearchOptions)
        throw new ProviderError(
          "unsupported_capability",
          "This transport does not support web search settings"
        );
    }
    const required = new Set(request.required ?? ["text"]);
    if (request.schema || request.responseFormat) required.add("structured");
    if (request.allowWeb) required.add("web");
    if (request.tools?.length) required.add("tools");
    if (request.messages.some(
      (message) => message.content.some((part) => part.type === "image" || part.type === "image_url")
    ))
      required.add("vision");
    for (const capability of required) {
      if (!adapter.descriptor.capabilities.includes(capability))
        throw new ProviderError(
          "unsupported_capability",
          `${request.provider} does not support ${capability}`
        );
    }
    const timeout = request.timeoutMs ?? 6e5;
    const maxOutputBytes = request.maxOutputBytes ?? 16 * 1024 * 1024;
    if (!request.model || !Number.isSafeInteger(timeout) || timeout < 1 || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1)
      throw new ProviderError("invalid_request", "A model and positive timeout are required");
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      ...providerTimeout ? [] : [AbortSignal.timeout(timeout)],
      ...request.signal ? [request.signal] : []
    ]);
    const started = performance.now();
    let firstOutputMs = null;
    let usage = { inputTokens: null, outputTokens: null };
    let outcome = "cancelled";
    let retryCount = 0;
    let outputBytes = 0;
    let terminal;
    let iterator;
    let primary;
    let failureUsage;
    let acceptingMeasurements = true;
    const captureFailureUsage = (error) => {
      const reported = reportedUsageFromGenerationError(error);
      if (acceptingMeasurements && reported) {
        failureUsage = reported;
        usage = reported;
      }
    };
    try {
      signal.throwIfAborted();
      const credentials = await abortable(this.options.credentials.resolve(request.provider), signal);
      let adapterRequest = request;
      if (request.continuation) {
        if (typeof request.continuation.data !== "string" || request.continuation.data.length > 24 * 1024 * 1024)
          throw new ProviderError("invalid_request", "Invalid continuation envelope");
        const supplied = request.continuation.signature;
        const expected = this.signContinuation(request, credentials, request.continuation);
        if (request.continuation.provider !== request.provider || request.continuation.model !== request.model || !supplied || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex")))
          throw new ProviderError(
            "invalid_request",
            "Continuation no longer belongs to this caller or credential configuration"
          );
        const envelope = Buffer.from(request.continuation.data, "base64");
        try {
          const decipher = createDecipheriv("aes-256-gcm", this.continuationSecret, envelope.subarray(0, 12));
          decipher.setAuthTag(envelope.subarray(12, 28));
          const data = JSON.parse(
            Buffer.concat([decipher.update(envelope.subarray(28)), decipher.final()]).toString("utf8")
          );
          adapterRequest = { ...request, continuation: { ...request.continuation, data } };
        } catch {
          throw new ProviderError("invalid_request", "Invalid continuation envelope");
        }
      }
      signal.throwIfAborted();
      const stream = adapter.generate(adapterRequest, {
        credentials,
        signal,
        onRetry: () => {
          retryCount++;
        }
      });
      iterator = stream[Symbol.asyncIterator]();
      while (true) {
        const pending = iterator.next().catch((error) => {
          captureFailureUsage(error);
          throw error;
        });
        const next = await abortable(pending, signal);
        if (next.done) break;
        const event = next.value;
        if (event.type === "text") outputBytes += Buffer.byteLength(event.text);
        if (event.type === "audio") outputBytes += event.data.byteLength;
        if (event.type === "tool_call") outputBytes += Buffer.byteLength(JSON.stringify(event));
        if (event.type === "citation") outputBytes += Buffer.byteLength(JSON.stringify(event));
        if (outputBytes > maxOutputBytes)
          throw new ProviderError("invalid_stream", "Provider output exceeded the configured limit");
        signal.throwIfAborted();
        if (terminal) throw new ProviderError("invalid_stream", "Provider emitted data after completion");
        if (event.type === "finish") {
          terminal = event;
          if (event.usage) usage = { ...event.usage };
          continue;
        }
        if (event.type === "usage") usage = { ...event.usage };
        if ((event.type === "text" || event.type === "audio") && firstOutputMs === null)
          firstOutputMs = performance.now() - started;
        if (event.type === "continuation") {
          if (!resumable) continue;
          const serialized = JSON.stringify(event.data);
          if (Buffer.byteLength(serialized) > 16 * 1024 * 1024)
            throw new ProviderError("invalid_stream", "Continuation exceeded the configured limit");
          const nonce = randomBytes(12);
          const cipher = createCipheriv("aes-256-gcm", this.continuationSecret, nonce);
          const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
          const sealed = {
            ...event,
            data: Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64")
          };
          yield { ...sealed, signature: this.signContinuation(request, credentials, sealed) };
        } else yield event;
      }
      if (!terminal) throw new ProviderError("invalid_stream", "Provider ended without a completion event");
      signal.throwIfAborted();
      outcome = "success";
    } catch (error) {
      outcome = signal.aborted ? "cancelled" : "error";
      captureFailureUsage(error);
      primary = { error };
    } finally {
      controller.abort();
      let cleanup;
      if (iterator?.return) {
        const settlementTimeout = AbortSignal.timeout(5e3);
        try {
          await abortable(iterator.return(), settlementTimeout);
        } catch (error) {
          outcome = "error";
          cleanup = new ProviderCleanupError(settlementTimeout.aborted, { cause: error });
        }
      }
      if (!cleanup && request.signal?.aborted) outcome = "cancelled";
      acceptingMeasurements = false;
      this.options.metrics?.record({
        version: 1,
        id: randomUUID(),
        timestamp: Date.now(),
        kind: "execution",
        operation: "generate",
        outcome,
        provider: request.provider,
        model: request.model,
        consumerId: request.consumerId,
        credentialOwnerId: request.credentialOwnerId,
        durationMs: performance.now() - started,
        firstOutputMs,
        retryCount,
        ...usage,
        estimatedCost: null
      });
      if (cleanup) raiseCleanupFailure(cleanup, primary, usage);
    }
    if (primary) {
      if (failureUsage && !reportedUsageFromGenerationError(primary.error))
        throw new GenerationUsageError(
          primary.error instanceof Error ? primary.error.message : "Provider generation failed",
          failureUsage,
          { cause: primary.error }
        );
      throw primary.error;
    }
    request.signal?.throwIfAborted();
    if (terminal) yield terminal;
  }
};
function raiseCleanupFailure(cleanup, primary, usage) {
  const failure = primary ? new AggregateError([primary.error, cleanup], "Provider execution and cleanup failed", {
    cause: cleanup
  }) : cleanup;
  throw new GenerationUsageError(failure.message, usage, { cause: failure });
}

export { MissingProviderCredentialsError, ProviderCleanupError, ProviderError, ProviderRegistry, imageUrl, responseSchemaName, validateTemperature, webSearchOptionsSchema };
