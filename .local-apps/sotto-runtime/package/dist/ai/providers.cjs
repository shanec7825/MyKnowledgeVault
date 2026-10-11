'use strict';

var crypto = require('crypto');
var zod = require('zod');
var Anthropic = require('@anthropic-ai/sdk');
var OpenAI = require('openai');
var genai = require('@google/genai');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Anthropic__default = /*#__PURE__*/_interopDefault(Anthropic);
var OpenAI__default = /*#__PURE__*/_interopDefault(OpenAI);

// src/ai/index.ts

// src/runtime/process/abort.ts
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}

// src/runtime/process/stream.ts
function interruptibleStream(open, options) {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  async function* owned() {
    signal.throwIfAborted();
    yield* open(signal);
  }
  const iterator = owned();
  const hasCleanup = (error, seen = /* @__PURE__ */ new Set()) => {
    if (seen.has(error)) return false;
    seen.add(error);
    return options.isCleanupError(error) || error instanceof AggregateError && error.errors.some((nested) => hasCleanup(nested, seen)) || error instanceof Error && error.cause !== void 0 && hasCleanup(error.cause, seen);
  };
  let cleanupFailure;
  const next = iterator.next.bind(iterator);
  const close = iterator.return.bind(iterator);
  const fail = iterator.throw.bind(iterator);
  iterator.next = (...args) => next(...args).catch((error) => {
    if (hasCleanup(error)) cleanupFailure = error;
    throw error;
  });
  iterator.return = async (value) => {
    controller.abort();
    const result2 = await close(value);
    if (cleanupFailure) throw cleanupFailure;
    return result2;
  };
  iterator.throw = async (error) => {
    controller.abort(error);
    try {
      return await fail(error);
    } catch (failure) {
      const cleanup = cleanupFailure ?? (hasCleanup(failure) ? failure : void 0);
      if (cleanup && cleanup !== error)
        throw new AggregateError([error, cleanup], "Stream interruption and cleanup failed", {
          cause: failure
        });
      throw failure;
    }
  };
  return iterator;
}

// src/ai/usage.ts
var incompleteGeneration = /* @__PURE__ */ Symbol.for("thesidedoor.incomplete-generation");
var reportedGenerationUsage = /* @__PURE__ */ Symbol.for("thesidedoor.reported-generation-usage");
var GenerationUsageError = class extends Error {
  [reportedGenerationUsage] = true;
  usage;
  status;
  code;
  constructor(message, usage, options) {
    super(message, options);
    this.name = "GenerationUsageError";
    this.usage = Object.freeze(normalizeUsage(usage));
    const cause = options?.cause;
    if (cause instanceof Error && "code" in cause && typeof cause.code === "string") this.code = cause.code;
    if (cause instanceof Error && "status" in cause && typeof cause.status === "number" && Number.isInteger(cause.status)) {
      this.status = cause.status;
    }
  }
};
function normalizeUsage(value) {
  const usage = value !== null && typeof value === "object" ? value : {};
  const count = (key) => typeof usage[key] === "number" ? knownTokenSum(usage[key]) : null;
  return {
    inputTokens: count("inputTokens"),
    outputTokens: count("outputTokens"),
    cachedInputTokens: count("cachedInputTokens"),
    cacheWriteTokens: count("cacheWriteTokens"),
    reasoningTokens: count("reasoningTokens")
  };
}
function reportedUsageFromGenerationError(error) {
  if (error !== null && typeof error === "object" && (incompleteGeneration in error && error[incompleteGeneration] === true || reportedGenerationUsage in error && error[reportedGenerationUsage] === true) && "usage" in error)
    return normalizeUsage(error.usage);
  return void 0;
}
function knownTokenSum(...counts) {
  let total = 0;
  for (const count of counts) {
    if (count === null || count === void 0 || !Number.isSafeInteger(count) || count < 0) return null;
    total += count;
  }
  return Number.isSafeInteger(total) ? total : null;
}
function inclusiveTokenTotals(parts) {
  const unknown = { inputTokens: null, outputTokens: null };
  if (Object.values(parts).some((value) => value !== void 0 && knownTokenSum(value) === null))
    return unknown;
  let inputTokens = knownTokenSum(parts.input, parts.additionalInput);
  let outputTokens = knownTokenSum(parts.output, parts.additionalOutput);
  const total = parts.total;
  if (total === void 0) return { inputTokens, outputTokens };
  const base = knownTokenSum(parts.input, parts.output);
  if (base !== null && base > total) return unknown;
  if (inputTokens !== null && outputTokens !== null)
    return inputTokens + outputTokens === total ? { inputTokens, outputTokens } : unknown;
  if (inputTokens !== null && parts.output !== void 0) {
    if (total - inputTokens < parts.output) return unknown;
    outputTokens = total - inputTokens;
  } else if (outputTokens !== null && parts.input !== void 0) {
    if (total - outputTokens < parts.input) return unknown;
    inputTokens = total - outputTokens;
  } else if (base === total && parts.input !== void 0 && parts.output !== void 0) {
    inputTokens = parts.input;
    outputTokens = parts.output;
  }
  return { inputTokens, outputTokens };
}

// src/ai/index.ts
var webSearchOptionsSchema = zod.z.object({
  allowedDomains: zod.z.array(zod.z.string().min(1)).nullable().optional(),
  blockedDomains: zod.z.array(zod.z.string().min(1)).nullable().optional(),
  maxUses: zod.z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  userLocation: zod.z.object({
    type: zod.z.literal("approximate"),
    city: zod.z.string().nullable().optional(),
    country: zod.z.string().nullable().optional(),
    region: zod.z.string().nullable().optional(),
    timezone: zod.z.string().nullable().optional()
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
    this.continuationSecret = Buffer.from(options.continuationSecret ?? crypto.randomBytes(32));
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
    const configuration = crypto.createHash("sha256").update(JSON.stringify(Object.entries(credentials).sort(([a], [b]) => a.localeCompare(b)))).digest("hex");
    return crypto.createHmac("sha256", this.continuationSecret).update(
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
        if (request.continuation.provider !== request.provider || request.continuation.model !== request.model || !supplied || !/^[a-f0-9]{64}$/.test(supplied) || !crypto.timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex")))
          throw new ProviderError(
            "invalid_request",
            "Continuation no longer belongs to this caller or credential configuration"
          );
        const envelope = Buffer.from(request.continuation.data, "base64");
        try {
          const decipher = crypto.createDecipheriv("aes-256-gcm", this.continuationSecret, envelope.subarray(0, 12));
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
          const nonce = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv("aes-256-gcm", this.continuationSecret, nonce);
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
        id: crypto.randomUUID(),
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

// src/ai/configuration/connection.ts
function providerConnection(credentials, options) {
  const configured = credentials.baseUrl;
  let base;
  let defaultBase;
  try {
    defaultBase = new URL(options.defaultBaseUrl);
    base = new URL(typeof configured === "string" && configured ? configured : options.defaultBaseUrl);
  } catch {
    throw new ProviderError("invalid_request", "Invalid provider endpoint");
  }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash)
    throw new ProviderError("invalid_request", "Invalid provider endpoint");
  if (options.normalizeV1 && !base.pathname.replace(/\/+$/, "").endsWith("/v1"))
    base.pathname = base.pathname.replace(/\/+$/, "") + "/v1";
  const selected = base.origin === defaultBase.origin ? credentials.apiKey : credentials.compatibleApiKey;
  const apiKey = typeof selected === "string" ? selected : "";
  if (options.requiresKey && !apiKey && !(options.allowAnonymous && credentials.allowAnonymous === true))
    throw new MissingProviderCredentialsError("Configure credentials for the selected endpoint");
  return { baseUrl: base.href.replace(/\/+$/, ""), apiKey };
}

// src/ai/providers/http.ts
function providerFetch(context, implementation = globalThis.fetch) {
  return async (input2, init) => {
    const headers = new Headers(init?.headers ?? (input2 instanceof Request ? input2.headers : void 0));
    if (Number(headers.get("x-stainless-retry-count") ?? 0) > 0) context.onRetry?.();
    return implementation(input2, init);
  };
}

// src/runtime/process/request.ts
var RequestBodyTooLargeError = class extends Error {
  constructor(maxBytes) {
    super("Request body exceeds the allowed size");
    this.maxBytes = maxBytes;
    this.name = "RequestBodyTooLargeError";
  }
  maxBytes;
};
async function readRequestBytes(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("Invalid request body limit");
  request.signal.throwIfAborted();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let length = 0;
  let cancellation;
  let failure;
  let bytes = new Uint8Array();
  const abort = () => {
    cancellation ??= reader.cancel(request.signal.reason);
    void cancellation.catch(() => void 0);
  };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      request.signal.throwIfAborted();
      const chunk = await reader.read();
      request.signal.throwIfAborted();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) throw new RequestBodyTooLargeError(maxBytes);
      chunks.push(chunk.value);
    }
    bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch (error) {
    failure = { error };
  }
  request.signal.removeEventListener("abort", abort);
  try {
    await (cancellation ?? reader.cancel());
  } catch (error) {
    failure ??= { error };
  } finally {
    reader.releaseLock();
  }
  if (failure) throw failure.error;
  return bytes;
}

// src/providers/model-credential-proof.ts
var models = zod.z.array(zod.z.object({ id: zod.z.string().min(1) }));
var compatiblePage = zod.z.object({ object: zod.z.literal("list"), data: models });
var anthropicPage = zod.z.object({
  data: models,
  has_more: zod.z.boolean(),
  first_id: zod.z.string().nullable(),
  last_id: zod.z.string().nullable()
});
var compatibleEndpoints = /* @__PURE__ */ new Set([
  "https://api.meta.ai/v1/models",
  "https://api.openai.com/v1/models",
  "https://generativelanguage.googleapis.com/v1beta/openai/models",
  "https://api.groq.com/openai/v1/models",
  "https://api.x.ai/v1/models",
  "https://api.deepseek.com/models",
  "https://api.deepseek.com/v1/models",
  "https://api.mistral.ai/v1/models"
]);
function authenticates(endpoint, bytes) {
  const url = new URL(endpoint);
  const path = `${url.origin}${url.pathname}`;
  const schema = path === "https://api.anthropic.com/v1/models" ? anthropicPage : compatibleEndpoints.has(path) ? compatiblePage : void 0;
  if (!schema || url.username || url.password || url.hash) return false;
  if (url.search && !(path === "https://api.anthropic.com/v1/models" && url.search === "?limit=1"))
    return false;
  try {
    return schema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).success;
  } catch {
    return false;
  }
}
function modelCredentialProbe(signal, implementation = globalThis.fetch) {
  const responses = /* @__PURE__ */ new WeakMap();
  const probeFetch = async (input2, init) => {
    const inherited = init?.signal ?? (input2 instanceof Request ? input2.signal : void 0);
    const combined = inherited ? AbortSignal.any([signal, inherited]) : signal;
    combined.throwIfAborted();
    const endpoint = input2 instanceof Request ? input2.url : String(input2);
    const response = await implementation(input2, { ...init, signal: combined, redirect: "error" });
    if (combined.aborted) {
      await abortable(Promise.resolve(response.body?.cancel()), combined);
      combined.throwIfAborted();
    }
    if (response.redirected) {
      await abortable(Promise.resolve(response.body?.cancel()), combined);
      throw new Error("Credential probe redirected");
    }
    const bytes = await abortable(
      readRequestBytes({ body: response.body, signal: combined }, 64 * 1024),
      combined
    );
    const bounded = new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    responses.set(bounded, { endpoint, bytes });
    return bounded;
  };
  return {
    fetch: probeFetch,
    async readiness(response) {
      await abortable(Promise.resolve(response.body?.cancel()), signal);
      signal.throwIfAborted();
      const captured = responses.get(response);
      return {
        code: "ready",
        checkedAt: Date.now(),
        ...response.status === 200 && captured && authenticates(captured.endpoint, captured.bytes) ? { authentication: "verified" } : {}
      };
    }
  };
}

// src/ai/providers/anthropic.ts
var effort = zod.z.enum(["low", "medium", "high", "xhigh", "max"]);
var mediaType = zod.z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]);
var toolSchema = zod.z.object({
  type: zod.z.literal("object"),
  properties: zod.z.record(zod.z.string(), zod.z.unknown()).optional(),
  required: zod.z.array(zod.z.string()).optional()
}).passthrough();
var toolArguments = zod.z.record(zod.z.string(), zod.z.unknown());
var transcript = zod.z.array(
  zod.z.object({
    role: zod.z.enum(["user", "assistant"]),
    content: zod.z.union([zod.z.string(), zod.z.array(zod.z.object({ type: zod.z.string() }).passthrough())])
  })
).max(1e3);
function text(message) {
  if (message.content.some((part) => part.type !== "text"))
    throw new ProviderError("invalid_request", "System and tool messages require text content");
  return message.content.map((part) => part.type === "text" ? part.text : "").join("\n");
}
function messages(request) {
  return request.messages.filter((message) => message.role !== "system").map((message) => {
    if (message.role === "tool") {
      if (!message.toolCallId)
        throw new ProviderError("invalid_request", "A tool result must identify its call");
      return {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: text(message) }]
      };
    }
    const content = message.content.map((part) => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image_url")
        return { type: "image", source: { type: "url", url: imageUrl(part.url) } };
      if (part.type === "image")
        return {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType.parse(part.mediaType),
            data: Buffer.from(part.data).toString("base64")
          }
        };
      throw new ProviderError("unsupported_capability", "Anthropic messages do not accept audio input");
    });
    for (const call of message.toolCalls ?? [])
      content.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments });
    return { role: message.role === "assistant" ? "assistant" : "user", content };
  });
}
function createAnthropicProvider(options) {
  const webSearchMaxUses = options.webSearchMaxUses === void 0 ? 3 : options.webSearchMaxUses;
  if (webSearchMaxUses !== null && (!Number.isSafeInteger(webSearchMaxUses) || webSearchMaxUses < 1)) {
    throw new ProviderError("invalid_request", "Web search limit must be a positive safe integer or null");
  }
  function client(context, probeFetch) {
    const { baseUrl, apiKey } = providerConnection(context.credentials, {
      defaultBaseUrl: "https://api.anthropic.com",
      requiresKey: true
    });
    return new Anthropic__default.default({
      apiKey,
      baseURL: baseUrl,
      maxRetries: options.maxRetries ?? 2,
      fetch: providerFetch(context, probeFetch ?? options.fetch)
    });
  }
  return {
    descriptor: options.descriptor,
    supportsWebSearchOptions: true,
    managesAttemptTimeouts: true,
    validateConfiguration(context) {
      client(context);
    },
    async readiness(context) {
      try {
        const probe = modelCredentialProbe(context.signal, options.fetch);
        const response = await client(context, probe.fetch).models.list({ limit: 1 }, { signal: context.signal }).asResponse();
        return await probe.readiness(response);
      } catch (error) {
        context.signal.throwIfAborted();
        if (error instanceof MissingProviderCredentialsError)
          return { code: "missing_credentials", checkedAt: Date.now(), action: "configure" };
        if (error instanceof ProviderError)
          return { code: "not_configured", checkedAt: Date.now(), action: "configure" };
        if (error instanceof Anthropic__default.default.AuthenticationError)
          return { code: "not_authenticated", checkedAt: Date.now(), action: "configure" };
        return { code: "unreachable", checkedAt: Date.now(), action: "retry" };
      }
    },
    async models(context) {
      const page = await client(context).models.list({ limit: 100 }, { signal: context.signal });
      const result2 = [];
      for await (const model of page) {
        context.signal.throwIfAborted();
        if (result2.length >= 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
        result2.push({
          id: model.id,
          label: model.display_name,
          capabilities: options.descriptor.capabilities
        });
      }
      return result2;
    },
    async *generate(request, context) {
      if (request.allowWeb && request.tools?.some((tool) => tool.name === "web_search"))
        throw new ProviderError("invalid_request", "Custom tools cannot use the hosted web search tool name");
      const search = request.webSearch === void 0 ? void 0 : webSearchOptionsSchema.parse(request.webSearch);
      if (search && !request.allowWeb)
        throw new ProviderError("invalid_request", "Web search settings require web search to be enabled");
      const tools = (request.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: toolSchema.parse(tool.schema)
      }));
      if (request.allowWeb)
        tools.push({
          type: "web_search_20250305",
          name: "web_search",
          ...webSearchMaxUses === null ? {} : { max_uses: webSearchMaxUses },
          ...search?.maxUses === void 0 ? {} : { max_uses: search.maxUses },
          ...search?.allowedDomains === void 0 ? {} : { allowed_domains: search.allowedDomains },
          ...search?.blockedDomains === void 0 ? {} : { blocked_domains: search.blockedDomains },
          ...search?.userLocation === void 0 ? {} : { user_location: search.userLocation }
        });
      const conversation = messages(request);
      if (request.continuation) {
        if (request.continuation.provider !== request.provider || request.continuation.model !== request.model)
          throw new ProviderError("invalid_request", "Continuation belongs to a different provider or model");
        conversation.unshift(...transcript.parse(request.continuation.data));
      }
      const totals = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 };
      let outputText = "";
      let authoritativeUsage;
      try {
        for (let round = 0; round < 6; round++) {
          authoritativeUsage = void 0;
          const roundOffset = outputText.length;
          const parameters = {
            model: request.model,
            max_tokens: request.maxOutputTokens ?? 16e3,
            temperature: validateTemperature(request.temperature),
            system: request.messages.filter((message) => message.role === "system").map(text).join("\n\n") + (request.responseFormat ? "\nRespond with a single valid JSON object." : "") || void 0,
            messages: conversation,
            ...tools.length ? { tools } : {},
            ...request.effort || request.adaptiveThinking ? {
              thinking: { type: "adaptive" },
              output_config: {
                ...request.effort ? { effort: effort.parse(request.effort) } : {},
                ...request.schema ? { format: { type: "json_schema", schema: request.schema } } : {}
              }
            } : request.schema ? { output_config: { format: { type: "json_schema", schema: request.schema } } } : {}
          };
          let final;
          if (options.streaming === false) {
            final = await client(context).messages.create(parameters, { signal: context.signal });
          } else {
            const stream = client(context).messages.stream(parameters, { signal: context.signal });
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                outputText += event.delta.text;
                yield { type: "text", text: event.delta.text };
              }
            }
            final = await stream.finalMessage();
          }
          totals.inputTokens = knownTokenSum(
            totals.inputTokens,
            final.usage.input_tokens,
            final.usage.cache_read_input_tokens,
            final.usage.cache_creation_input_tokens
          );
          totals.outputTokens += final.usage.output_tokens;
          totals.reasoningTokens = knownTokenSum(
            totals.reasoningTokens,
            final.usage.output_tokens_details?.thinking_tokens
          );
          totals.cachedInputTokens = totals.cachedInputTokens === null || final.usage.cache_read_input_tokens == null ? null : totals.cachedInputTokens + final.usage.cache_read_input_tokens;
          totals.cacheWriteTokens = totals.cacheWriteTokens === null || final.usage.cache_creation_input_tokens == null ? null : totals.cacheWriteTokens + final.usage.cache_creation_input_tokens;
          authoritativeUsage = { ...totals };
          if (options.streaming === false) {
            for (const block of final.content)
              if (block.type === "text") {
                outputText += block.text;
                yield { type: "text", text: block.text };
              }
          }
          if (final.stop_reason === "refusal")
            throw new ProviderError("invalid_stream", "The provider refused the request");
          let offset = roundOffset;
          for (const block of final.content) {
            if (block.type !== "text") continue;
            for (const citation of block.citations ?? []) {
              if (citation.type === "web_search_result_location")
                yield {
                  type: "citation",
                  url: citation.url,
                  title: citation.title ?? citation.url,
                  start: offset,
                  end: offset + block.text.length
                };
            }
            offset += block.text.length;
          }
          conversation.push({ role: "assistant", content: final.content });
          if (final.stop_reason === "pause_turn") {
            continue;
          }
          if (!final.stop_reason)
            throw new ProviderError("invalid_stream", "The provider did not complete the turn");
          if (request.responseFormat && final.stop_reason !== "tool_use")
            toolArguments.parse(JSON.parse(outputText));
          for (const block of final.content) {
            if (block.type === "tool_use")
              yield {
                type: "tool_call",
                id: block.id,
                name: block.name,
                arguments: toolArguments.parse(block.input)
              };
          }
          yield {
            type: "continuation",
            provider: request.provider,
            model: request.model,
            data: conversation
          };
          yield {
            type: "finish",
            reason: final.stop_reason === "max_tokens" ? "length" : final.stop_reason === "tool_use" ? "tool_calls" : "complete",
            usage: totals
          };
          return;
        }
        throw new ProviderError("invalid_stream", "The provider exceeded the continuation limit");
      } catch (error) {
        if (authoritativeUsage)
          throw new GenerationUsageError(
            error instanceof Error ? error.message : "Provider generation failed",
            authoritativeUsage,
            { cause: error }
          );
        throw error;
      }
    }
  };
}
var effortSchema = zod.z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
var argumentsSchema = zod.z.record(zod.z.string(), zod.z.unknown());
async function* completionChunk(response) {
  yield {
    id: response.id,
    object: "chat.completion.chunk",
    created: response.created,
    model: response.model,
    usage: response.usage,
    choices: []
  };
  yield {
    id: response.id,
    object: "chat.completion.chunk",
    created: response.created,
    model: response.model,
    choices: response.choices.map((choice) => ({
      index: choice.index,
      finish_reason: choice.finish_reason,
      logprobs: choice.logprobs,
      delta: {
        content: choice.message.content,
        refusal: choice.message.refusal,
        tool_calls: choice.message.tool_calls?.map((call, index) => {
          if (call.type !== "function")
            throw new ProviderError("invalid_stream", "Unsupported tool call type");
          return { ...call, index };
        })
      }
    }))
  };
}
function text2(message) {
  if (message.content.some((part) => part.type !== "text"))
    throw new ProviderError("invalid_request", "This message role accepts text only");
  return message.content.map((part) => part.type === "text" ? part.text : "").join("\n");
}
function messages2(request, assistantImages = false) {
  return request.messages.map((message) => {
    if (message.role === "tool") {
      if (!message.toolCallId)
        throw new ProviderError("invalid_request", "A tool result must identify its call");
      return { role: "tool", tool_call_id: message.toolCallId, content: text2(message) };
    }
    if (message.role === "system") return { role: "system", content: text2(message) };
    if (message.role === "assistant" && message.content.every((part) => part.type === "text")) {
      const result2 = { role: "assistant", content: text2(message) };
      if (message.toolCalls?.length)
        result2.tool_calls = message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) }
        }));
      return result2;
    }
    const content = message.content.map((part) => {
      if (part.type === "text") return { type: "text", text: part.text };
      if (part.type === "image_url") return { type: "image_url", image_url: { url: imageUrl(part.url) } };
      if (part.type === "image")
        return {
          type: "image_url",
          image_url: { url: `data:${part.mediaType};base64,${Buffer.from(part.data).toString("base64")}` }
        };
      throw new ProviderError("unsupported_capability", "This provider does not accept audio input");
    });
    if (message.role === "assistant") {
      if (!assistantImages)
        throw new ProviderError(
          "unsupported_capability",
          "This transport does not accept images in assistant history"
        );
      return {
        role: "assistant",
        content,
        ...message.toolCalls?.length ? {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.arguments) }
          }))
        } : {}
      };
    }
    return {
      role: "user",
      content: message.content.every((part) => part.type === "text") ? text2(message) : content
    };
  });
}
function createCompatibleProvider(options) {
  function client(context, probeFetch) {
    const { baseUrl, apiKey } = providerConnection(context.credentials, {
      defaultBaseUrl: options.defaultBaseUrl,
      normalizeV1: options.normalizeV1,
      requiresKey: options.requiresKey,
      allowAnonymous: true
    });
    return new OpenAI__default.default({
      baseURL: baseUrl,
      apiKey: apiKey || "unused",
      maxRetries: options.maxRetries ?? 2,
      fetch: providerFetch(context, probeFetch ?? options.fetch)
    });
  }
  return {
    descriptor: options.descriptor,
    validateConfiguration(context) {
      client(context);
    },
    async readiness(context) {
      try {
        const probe = modelCredentialProbe(context.signal, options.fetch);
        const response = await client(context, probe.fetch).models.list({ signal: context.signal }).asResponse();
        return await probe.readiness(response);
      } catch (error) {
        context.signal.throwIfAborted();
        if (error instanceof MissingProviderCredentialsError)
          return { code: "missing_credentials", checkedAt: Date.now(), action: "configure" };
        if (error instanceof ProviderError)
          return { code: "not_configured", checkedAt: Date.now(), action: "configure" };
        if (error instanceof OpenAI__default.default.AuthenticationError)
          return { code: "not_authenticated", checkedAt: Date.now(), action: "configure" };
        return { code: "unreachable", checkedAt: Date.now(), action: "retry" };
      }
    },
    async models(context) {
      if (options.descriptor.id === "ollama") {
        const connection = providerConnection(context.credentials, {
          defaultBaseUrl: options.defaultBaseUrl,
          normalizeV1: true,
          requiresKey: false,
          allowAnonymous: true
        });
        const url = connection.baseUrl.replace(/\/v1$/, "") + "/api/tags";
        const response = await providerFetch(context, options.fetch)(url, {
          signal: context.signal,
          headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}
        });
        if (!response.ok) throw new Error("Model discovery failed");
        const data = zod.z.object({ models: zod.z.array(zod.z.object({ name: zod.z.string().min(1) })).max(1e4) }).parse(await response.json());
        return data.models.map((model) => ({
          id: model.name,
          label: model.name,
          capabilities: options.descriptor.capabilities
        }));
      }
      const page = await client(context).models.list({ signal: context.signal });
      const result2 = [];
      for await (const model of page) {
        context.signal.throwIfAborted();
        if (result2.length >= 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
        result2.push({
          id: model.id,
          label: model.id,
          capabilities: options.descriptor.capabilities
        });
      }
      return result2;
    },
    async *generate(request, context) {
      if (request.webSearch !== void 0)
        throw new ProviderError(
          "unsupported_capability",
          "This transport does not support web search settings"
        );
      if (request.allowWeb)
        throw new ProviderError(
          "unsupported_capability",
          "Web search requires the shared tool runtime for this transport"
        );
      const parameters = {
        model: request.model,
        temperature: validateTemperature(request.temperature),
        messages: messages2(request, options.assistantImages),
        ...request.maxOutputTokens === void 0 ? {} : options.maxTokensParameter === "max_tokens" ? { max_tokens: request.maxOutputTokens } : { max_completion_tokens: request.maxOutputTokens },
        ...request.effort ? { reasoning_effort: effortSchema.parse(request.effort) } : {},
        ...request.schema ? {
          response_format: {
            type: "json_schema",
            json_schema: {
              name: responseSchemaName(request.schemaName),
              schema: request.schema,
              strict: true
            }
          }
        } : request.responseFormat ? { response_format: { type: request.responseFormat } } : {},
        ...request.tools?.length ? {
          tools: request.tools.map((tool) => ({
            type: "function",
            function: { name: tool.name, description: tool.description, parameters: tool.schema }
          }))
        } : {}
      };
      const stream = options.streaming === false ? completionChunk(
        await client(context).chat.completions.create(parameters, { signal: context.signal })
      ) : await client(context).chat.completions.create(
        { ...parameters, stream: true, stream_options: { include_usage: true } },
        { signal: context.signal }
      );
      let reason;
      let usage = { inputTokens: null, outputTokens: null };
      let authoritativeUsage;
      const calls = /* @__PURE__ */ new Map();
      try {
        for await (const chunk of stream) {
          if (chunk.usage)
            usage = {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              ...chunk.usage.prompt_tokens_details ? { cachedInputTokens: chunk.usage.prompt_tokens_details.cached_tokens ?? null } : {},
              ...chunk.usage.completion_tokens_details ? { reasoningTokens: chunk.usage.completion_tokens_details.reasoning_tokens ?? null } : {}
            };
          if (chunk.usage && (options.streaming === false || reason && chunk.choices.length === 0)) {
            if (authoritativeUsage)
              throw new ProviderError("invalid_stream", "Provider emitted multiple terminal usage records");
            authoritativeUsage = { ...usage };
          }
          const choice = chunk.choices[0];
          if (!choice) continue;
          if (reason)
            throw new ProviderError("invalid_stream", "Provider emitted choice data after completion");
          if (choice.delta.refusal)
            throw new ProviderError("invalid_stream", "The provider refused the request");
          if (choice.delta.content) yield { type: "text", text: choice.delta.content };
          for (const delta of choice.delta.tool_calls ?? []) {
            const current = calls.get(delta.index) ?? { id: "", name: "", arguments: "" };
            current.id += delta.id ?? "";
            current.name += delta.function?.name ?? "";
            current.arguments += delta.function?.arguments ?? "";
            if (current.arguments.length > 1024 * 1024 || calls.size > 100)
              throw new ProviderError("invalid_stream", "Tool call output exceeds the allowed size");
            calls.set(delta.index, current);
          }
          if (choice.finish_reason === "content_filter")
            throw new ProviderError("invalid_stream", "The provider filtered its response");
          if (choice.finish_reason)
            reason = choice.finish_reason === "length" ? "length" : choice.finish_reason === "tool_calls" ? "tool_calls" : "complete";
        }
        if (!reason) throw new ProviderError("invalid_stream", "Provider ended without a completion reason");
        for (const call of calls.values()) {
          if (!call.id || !call.name) throw new ProviderError("invalid_stream", "Incomplete tool call");
          yield {
            type: "tool_call",
            id: call.id,
            name: call.name,
            arguments: argumentsSchema.parse(JSON.parse(call.arguments))
          };
        }
        yield { type: "finish", reason, usage };
      } catch (error) {
        if (authoritativeUsage)
          throw new GenerationUsageError(
            error instanceof Error ? error.message : "Provider generation failed",
            authoritativeUsage,
            { cause: error }
          );
        throw error;
      }
    }
  };
}
function responseUsage(response) {
  return {
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
    reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens ?? null
  };
}
async function* responseEvents(value) {
  if (Symbol.asyncIterator in value) {
    yield* value;
    return;
  }
  if (!["completed", "incomplete", "failed"].includes(value.status ?? ""))
    throw new ProviderError("invalid_stream", "Provider ended without a completed response");
  const blocks = value.output.flatMap((item) => item.type === "message" ? item.content : []);
  if (blocks.some((block) => block.type === "refusal"))
    throw new ProviderError("invalid_stream", "The provider refused the request");
  const outputText = blocks.map((block) => block.type === "output_text" ? block.text : "").join("");
  if (outputText)
    yield {
      type: "response.output_text.delta",
      delta: outputText,
      item_id: value.id,
      output_index: 0,
      content_index: 0,
      sequence_number: 0,
      logprobs: []
    };
  if (value.status === "failed") yield { type: "response.failed", response: value, sequence_number: 1 };
  else if (value.status === "incomplete")
    yield { type: "response.incomplete", response: value, sequence_number: 1 };
  else yield { type: "response.completed", response: value, sequence_number: 1 };
}
var effort2 = zod.z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
var argumentsSchema2 = zod.z.record(zod.z.string(), zod.z.unknown());
var transcriptSchema = zod.z.array(zod.z.object({ type: zod.z.string() }).passthrough()).max(1e3);
function text3(message) {
  if (message.content.some((part) => part.type !== "text"))
    throw new ProviderError("invalid_request", "This message role accepts text only");
  return message.content.map((part) => part.type === "text" ? part.text : "").join("\n");
}
function input(request) {
  const result2 = [];
  if (request.continuation) {
    if (request.continuation.provider !== request.provider || request.continuation.model !== request.model)
      throw new ProviderError("invalid_request", "Continuation belongs to a different provider or model");
    result2.push(...transcriptSchema.parse(request.continuation.data));
  }
  for (const message of request.messages) {
    if (message.role === "system") continue;
    if (message.role === "tool") {
      if (!message.toolCallId)
        throw new ProviderError("invalid_request", "A tool result must identify its call");
      result2.push({ type: "function_call_output", call_id: message.toolCallId, output: text3(message) });
      continue;
    }
    const content = message.content.map((part) => {
      if (part.type === "text") return { type: "input_text", text: part.text };
      if (part.type === "image_url")
        return { type: "input_image", detail: "auto", image_url: imageUrl(part.url) };
      if (part.type === "image")
        return {
          type: "input_image",
          detail: "auto",
          image_url: `data:${part.mediaType};base64,${Buffer.from(part.data).toString("base64")}`
        };
      throw new ProviderError("unsupported_capability", "This Responses adapter does not accept audio input");
    });
    if (message.content.length)
      result2.push({
        type: "message",
        role: message.role,
        content: message.role === "assistant" && message.content.every((part) => part.type === "text") ? text3(message) : content
      });
    if (message.role === "assistant")
      for (const call of message.toolCalls ?? [])
        result2.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.arguments)
        });
  }
  return result2;
}
function createResponsesProvider(options) {
  const endpointOptions = {
    defaultBaseUrl: options.defaultBaseUrl ?? "https://api.openai.com/v1",
    requiresKey: true
  };
  const baseURL = providerConnection({ apiKey: "validation" }, endpointOptions).baseUrl;
  const webSearchType = zod.z.enum(["web_search", "web_search_preview"]).parse(options.webSearchType ?? "web_search");
  function client(context, probeFetch) {
    const apiKey = context.credentials.apiKey;
    if (typeof apiKey !== "string" || !apiKey)
      throw new MissingProviderCredentialsError("Configure an OpenAI API key");
    if (context.credentials.baseUrl && providerConnection(
      { baseUrl: context.credentials.baseUrl, apiKey: "validation", compatibleApiKey: "validation" },
      endpointOptions
    ).baseUrl !== baseURL)
      throw new ProviderError("invalid_request", "Custom endpoints must select the compatible transport");
    return new OpenAI__default.default({
      apiKey,
      baseURL,
      fetch: providerFetch(context, probeFetch ?? options.fetch),
      maxRetries: options.maxRetries ?? 2
    });
  }
  return {
    descriptor: options.descriptor,
    validateConfiguration(context) {
      client(context);
    },
    async readiness(context) {
      try {
        const probe = modelCredentialProbe(context.signal, options.fetch);
        const response = await client(context, probe.fetch).models.list({ signal: context.signal }).asResponse();
        return await probe.readiness(response);
      } catch (error) {
        context.signal.throwIfAborted();
        if (error instanceof MissingProviderCredentialsError)
          return { code: "missing_credentials", checkedAt: Date.now(), action: "configure" };
        if (error instanceof ProviderError)
          return { code: "not_configured", checkedAt: Date.now(), action: "configure" };
        if (error instanceof OpenAI__default.default.AuthenticationError)
          return { code: "not_authenticated", checkedAt: Date.now(), action: "configure" };
        return { code: "unreachable", checkedAt: Date.now(), action: "retry" };
      }
    },
    async models(context) {
      const models2 = await client(context).models.list({ signal: context.signal });
      const result2 = [];
      for await (const model of models2) {
        context.signal.throwIfAborted();
        if (result2.length >= 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
        result2.push({
          id: model.id,
          label: model.id,
          capabilities: options.descriptor.capabilities
        });
      }
      return result2;
    },
    async *generate(request, context) {
      if (request.webSearch !== void 0)
        throw new ProviderError(
          "unsupported_capability",
          "This transport does not support web search settings"
        );
      const tools = (request.tools ?? []).map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
        strict: false
      }));
      if (request.allowWeb) tools.push({ type: webSearchType });
      const transcript2 = input(request);
      const stream = await client(context).responses.create(
        {
          model: request.model,
          temperature: validateTemperature(request.temperature),
          input: transcript2,
          instructions: request.messages.filter((message) => message.role === "system").map(text3).join("\n\n") || void 0,
          stream: options.streaming !== false,
          store: false,
          include: ["reasoning.encrypted_content"],
          ...tools.length ? { tools } : {},
          ...request.maxOutputTokens === void 0 ? {} : { max_output_tokens: request.maxOutputTokens },
          ...request.effort ? { reasoning: { effort: effort2.parse(request.effort) } } : {},
          ...request.schema ? {
            text: {
              format: {
                type: "json_schema",
                name: responseSchemaName(request.schemaName),
                schema: request.schema,
                strict: true
              }
            }
          } : request.responseFormat ? { text: { format: { type: request.responseFormat } } } : {}
        },
        { signal: context.signal }
      );
      let completed = false;
      let authoritativeUsage = "output" in stream ? responseUsage(stream) : void 0;
      try {
        for await (const event of responseEvents(stream)) {
          if (event.type === "response.completed" || event.type === "response.incomplete" || event.type === "response.failed")
            authoritativeUsage ??= responseUsage(event.response);
          if (event.type === "response.output_text.delta") yield { type: "text", text: event.delta };
          if (event.type === "response.refusal.delta")
            throw new ProviderError("invalid_stream", "The provider refused the request");
          if (event.type === "error" || event.type === "response.failed")
            throw new ProviderError("invalid_stream", "The provider failed to generate a response");
          if (event.type !== "response.completed" && event.type !== "response.incomplete") continue;
          if (completed)
            throw new ProviderError("invalid_stream", "Provider emitted multiple completion events");
          const response = event.response;
          if (event.type === "response.incomplete" && response.incomplete_details?.reason !== "max_output_tokens")
            throw new ProviderError("invalid_stream", "The provider could not complete the response");
          completed = true;
          let hasTools = false;
          for (const item of response.output) {
            if (item.type === "function_call") {
              hasTools = true;
              yield {
                type: "tool_call",
                id: item.call_id,
                name: item.name,
                arguments: argumentsSchema2.parse(JSON.parse(item.arguments))
              };
            }
            if (item.type !== "message") continue;
            for (const block of item.content) {
              if (block.type === "refusal")
                throw new ProviderError("invalid_stream", "The provider refused the request");
              if (block.type !== "output_text") continue;
              for (const annotation of block.annotations) {
                if (annotation.type === "url_citation")
                  yield {
                    type: "citation",
                    url: annotation.url,
                    title: annotation.title,
                    start: annotation.start_index,
                    end: annotation.end_index
                  };
              }
            }
          }
          yield {
            type: "continuation",
            provider: request.provider,
            model: request.model,
            data: [...transcript2, ...response.output]
          };
          yield {
            type: "finish",
            reason: event.type === "response.incomplete" ? "length" : hasTools ? "tool_calls" : "complete",
            usage: responseUsage(response)
          };
        }
        if (!completed)
          throw new ProviderError("invalid_stream", "Provider ended without a completed response");
      } catch (error) {
        if (authoritativeUsage)
          throw new GenerationUsageError(
            error instanceof Error ? error.message : "Provider generation failed",
            authoritativeUsage,
            { cause: error }
          );
        throw error;
      }
    }
  };
}

// src/providers/catalog.ts
var identities = {
  meta: {
    compatibleApi: { baseURL: "https://api.meta.ai/v1" },
    label: "Meta (Muse)",
    helpUrl: "https://dev.meta.ai/",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["text"]
  },
  pricetoken: {
    label: "PriceToken",
    helpUrl: "https://pricetoken.com",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["pricing"]
  },
  r2: {
    label: "Cloudflare R2",
    helpUrl: "https://developers.cloudflare.com/r2/api/s3/tokens/",
    fields: [
      { id: "accessKeyId", label: "Access Key ID", kind: "string", required: true, secret: true },
      {
        id: "secretAccessKey",
        label: "Secret Access Key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["storage"]
  },
  s3: {
    label: "Amazon S3",
    helpUrl: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
    fields: [
      { id: "accessKeyId", label: "Access Key ID", kind: "string", required: true, secret: true },
      {
        id: "secretAccessKey",
        label: "Secret Access Key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["storage"]
  },
  sunoapi: {
    label: "Suno API (sunoapi.org)",
    helpUrl: "https://docs.sunoapi.org/suno-api/quickstart",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["music"]
  },
  suno: {
    label: "Suno",
    helpUrl: "https://docs.sunoapi.org/suno-api/quickstart",
    fields: [],
    credentialProvider: "sunoapi",
    modalities: ["music"]
  },
  pexels: {
    label: "Pexels",
    helpUrl: "https://www.pexels.com/api/documentation/",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["visual"]
  },
  anthropic: {
    label: "Anthropic (Claude)",
    helpUrl: "https://console.anthropic.com/settings/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-ant-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  openai: {
    creditExhaustion: {
      origin: "https://api.openai.com",
      rules: [
        { status: 429, path: ["error", "code"], value: "insufficient_quota" },
        { status: 429, path: ["error", "code"], value: "credit_balance_exhausted" }
      ]
    },
    label: "OpenAI",
    helpUrl: "https://platform.openai.com/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "speech", "transcription", "storage"]
  },
  "claude-code": {
    label: "Claude Code (CLI)",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  codex: {
    label: "Codex (CLI)",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  local: {
    label: "Local model (Ollama / vLLM / LM Studio)",
    helpUrl: "",
    fields: [],
    fieldsByModality: {
      text: [{ id: "apiKey", label: "API key", kind: "string", required: false, secret: true }],
      speech: [{ id: "apiKey", label: "API key", kind: "string", required: false, secret: true }],
      transcription: [{ id: "apiKey", label: "API key", kind: "string", required: false, secret: true }]
    },
    modalities: ["text", "speech", "transcription"]
  },
  together: {
    compatibleApi: { baseURL: "https://api.together.xyz/v1" },
    label: "Together AI",
    helpUrl: "https://api.together.xyz/settings/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "transcription"]
  },
  deepgram: {
    label: "Deepgram (STT)",
    helpUrl: "https://console.deepgram.com/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech", "transcription"]
  },
  assemblyai: {
    label: "AssemblyAI (STT)",
    helpUrl: "https://www.assemblyai.com/app",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["transcription"]
  },
  groq: {
    compatibleApi: { baseURL: "https://api.groq.com/openai/v1" },
    label: "Groq",
    helpUrl: "https://console.groq.com/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "gsk_...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "transcription"]
  },
  xai: {
    compatibleApi: { baseURL: "https://api.x.ai/v1" },
    label: "xAI (Grok)",
    helpUrl: "https://console.x.ai/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "xai-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  deepseek: {
    compatibleApi: { baseURL: "https://api.deepseek.com/v1" },
    label: "DeepSeek",
    helpUrl: "https://platform.deepseek.com/api_keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  mistral: {
    compatibleApi: { baseURL: "https://api.mistral.ai/v1" },
    label: "Mistral",
    helpUrl: "https://console.mistral.ai/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "Your Mistral API key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "speech"]
  },
  nvidia: {
    compatibleApi: { baseURL: "https://integrate.api.nvidia.com/v1" },
    label: "NVIDIA NIM",
    helpUrl: "https://build.nvidia.com/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "nvapi-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  gladia: {
    label: "Gladia (STT)",
    helpUrl: "https://app.gladia.io/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["transcription"]
  },
  speechmatics: {
    label: "Speechmatics (STT)",
    helpUrl: "https://portal.speechmatics.com/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["transcription"]
  },
  google: {
    label: "Google (Gemini)",
    helpUrl: "https://aistudio.google.com/apikey",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "AIza...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  elevenlabs: {
    creditExhaustion: {
      origin: "https://api.elevenlabs.io",
      rules: [
        { status: 401, path: ["detail", "status"], value: "quota_exceeded" },
        { status: 402, path: ["detail", "code"], value: "insufficient_credits" }
      ]
    },
    label: "ElevenLabs",
    helpUrl: "https://elevenlabs.io/app/settings/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "xi-xxxxxxxxxxxxxxxxxxxx",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech", "transcription"]
  },
  cartesia: {
    creditExhaustion: {
      origin: "https://api.cartesia.ai",
      rules: [{ status: 402, path: [], value: "Model credits limit reached:", prefix: true }]
    },
    configurationFields: [
      { id: "usagePlan", label: "Usage Plan", kind: "string", required: false, secret: false }
    ],
    label: "Cartesia",
    helpUrl: "https://play.cartesia.ai/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk_car_...",
        kind: "string",
        required: true,
        secret: true
      },
      {
        id: "adminApiKey",
        label: "Admin API Key",
        placeholder: "sk_car_admin_... (optional, for usage)",
        kind: "string",
        required: false,
        secret: true
      },
      {
        id: "monthlyCreditLimit",
        label: "Monthly Credit Limit",
        placeholder: "Optional, e.g. 1000000",
        kind: "number",
        required: false,
        secret: false
      },
      {
        id: "billingResetDay",
        label: "Billing Reset Day",
        placeholder: "Optional, 1-31",
        kind: "number",
        required: false,
        secret: false
      }
    ],
    modalities: ["speech", "transcription"]
  },
  hume: {
    label: "Hume AI",
    helpUrl: "https://platform.hume.ai/settings/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "Your Hume AI API key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  fal: {
    label: "Fal",
    helpUrl: "https://fal.ai/dashboard/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "fal_sk_...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  minimax: {
    label: "MiniMax",
    helpUrl: "",
    fields: [],
    modalities: ["speech"],
    credentialProvider: "fal",
    fieldPresentation: { apiKey: { placeholder: "Your FAL API key" } }
  },
  replicate: {
    label: "Replicate",
    helpUrl: "https://replicate.com/account/api-tokens",
    fields: [
      {
        id: "apiKey",
        label: "API Token",
        placeholder: "r8_xxxxxxxxxxxx",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  kokoro: {
    label: "Kokoro (Local)",
    helpUrl: "",
    fields: [],
    modalities: ["speech"]
  },
  rime: {
    label: "Rime",
    helpUrl: "https://app.rime.ai/tokens",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  playht: {
    label: "PlayHT",
    helpUrl: "https://play.ht/studio/api-access",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      },
      {
        id: "userId",
        label: "User ID",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  ollama: {
    label: "Ollama",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  llamacpp: {
    label: "llama.cpp",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  vllm: {
    label: "vLLM",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  }
};
function identity(provider) {
  if (!Object.hasOwn(identities, provider)) throw new Error(`Unknown provider: ${provider}`);
  return identities[provider];
}
function providerCredentials(provider, modality) {
  const entry = identity(provider);
  if (!entry.modalities.includes(modality))
    throw new Error(`Provider ${provider} does not support ${modality}`);
  const credentialProvider = entry.credentialProvider ?? provider;
  const authority = identity(credentialProvider);
  return {
    provider,
    modality,
    credentialProvider,
    configurationFields: structuredClone(authority.configurationFields ?? []),
    helpUrl: authority.helpUrl,
    fields: structuredClone(authority.fieldsByModality?.[modality] ?? authority.fields).map((field) => ({
      ...field,
      ...entry.fieldPresentation?.[field.id],
      helpUrl: authority.helpUrl
    }))
  };
}

// src/providers/service-validation.ts
var nonempty = zod.z.string().min(1);
var record = zod.z.record(zod.z.string(), zod.z.unknown());
var integer = zod.z.number().int().nonnegative();
var protocols = {
  pexels: {
    origin: "https://api.pexels.com",
    path: "/v1/search?query=language%20learning&per_page=1",
    header: "authorization",
    prefix: "",
    proof: zod.z.object({
      photos: zod.z.array(zod.z.object({ id: zod.z.number().int().positive() })),
      page: integer,
      per_page: integer,
      total_results: integer
    })
  },
  google: {
    origin: "https://generativelanguage.googleapis.com",
    path: "/v1beta/models?pageSize=1",
    header: "x-goog-api-key",
    prefix: "",
    proof: zod.z.object({ models: zod.z.array(zod.z.object({ name: nonempty })) })
  },
  elevenlabs: {
    origin: "https://api.elevenlabs.io",
    path: "/v1/user",
    header: "xi-api-key",
    prefix: "",
    proof: zod.z.object({ user_id: nonempty, subscription: record })
  },
  cartesia: {
    origin: "https://api.cartesia.ai",
    path: "/voices?limit=1",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ data: zod.z.array(zod.z.object({ id: nonempty })), has_more: zod.z.boolean() })
  },
  hume: {
    origin: "https://api.hume.ai",
    path: "/v0/tts/voices?provider=CUSTOM_VOICE&page_size=1",
    header: "X-Hume-Api-Key",
    prefix: "",
    proof: zod.z.object({
      voices_page: zod.z.array(record),
      page_number: integer,
      page_size: integer,
      total_pages: integer
    })
  },
  fal: {
    origin: "https://api.fal.ai",
    path: "/v1/models/pricing?endpoint_id=fal-ai/flux/dev",
    header: "authorization",
    prefix: "Key ",
    proof: zod.z.object({
      prices: zod.z.array(
        zod.z.object({
          endpoint_id: nonempty,
          unit_price: zod.z.number().nonnegative(),
          unit: nonempty,
          currency: nonempty
        })
      ).refine((prices) => prices.some((price) => price.endpoint_id === "fal-ai/flux/dev")),
      has_more: zod.z.boolean(),
      next_cursor: zod.z.string().nullable()
    })
  },
  replicate: {
    origin: "https://api.replicate.com",
    path: "/v1/account",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ username: nonempty, type: zod.z.enum(["user", "organization"]) })
  },
  assemblyai: {
    origin: "https://api.assemblyai.com",
    path: "/v2/transcript?limit=1",
    header: "authorization",
    prefix: "",
    proof: zod.z.object({
      transcripts: zod.z.array(record),
      page_details: zod.z.object({ limit: integer, result_count: integer })
    })
  },
  gladia: {
    origin: "https://api.gladia.io",
    path: "/v2/pre-recorded",
    header: "x-gladia-key",
    prefix: "",
    proof: zod.z.object({
      items: zod.z.array(record),
      first: zod.z.string(),
      current: zod.z.string(),
      next: zod.z.string().nullable()
    })
  },
  playht: {
    origin: "https://api.play.ht",
    path: "/api/v2/cloned-voices",
    header: "authorization",
    prefix: "",
    proof: zod.z.array(zod.z.object({ id: nonempty, name: zod.z.string() }))
  },
  deepgram: {
    origin: "https://api.deepgram.com",
    path: "/v1/projects",
    header: "authorization",
    prefix: "Token ",
    proof: zod.z.object({ projects: zod.z.array(zod.z.object({ project_id: nonempty, name: zod.z.string() })) })
  },
  speechmatics: {
    origin: "https://eu1.asr.api.speechmatics.com",
    path: "/v2/jobs?limit=1",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ jobs: zod.z.array(record) })
  },
  rime: {
    origin: "https://users.rime.ai",
    path: "/oov",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.array(zod.z.string())
  },
  sunoapi: {
    origin: "https://api.sunoapi.org",
    path: "/api/v1/generate/credit",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ code: zod.z.literal(200), data: integer, msg: zod.z.string() })
  }
};
function result(status, code, action) {
  return {
    status,
    readiness: {
      code,
      checkedAt: Date.now(),
      ...action ? { action } : {},
      ...status === "valid" ? { authentication: "verified" } : {}
    }
  };
}
async function validateServiceCredentials(selection, signal) {
  signal?.throwIfAborted();
  if (!Object.hasOwn(protocols, selection.protocol)) throw new Error("Unknown credential protocol");
  const protocol = protocols[selection.protocol];
  let origin;
  try {
    origin = new URL(selection.origin);
  } catch {
    return result("inconclusive", "not_configured", "configure");
  }
  if (origin.href !== `${protocol.origin}/`) return result("inconclusive", "unsupported", "configure");
  const { apiKey, userId } = selection.credentials;
  if (!apiKey?.trim() || selection.protocol === "playht")
    return result("missing", "missing_credentials", "configure");
  const deadline = AbortSignal.timeout(1e4);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const protocolId = selection.protocol;
  const headers = new Headers();
  try {
    headers.set(protocol.header, `${protocol.prefix}${apiKey}`);
    if (protocolId === "playht") ;
    if (protocolId === "cartesia") ;
    if (protocolId === "rime") ;
  } catch {
    return result("inconclusive", "not_configured", "configure");
  }
  const work = async () => {
    const response = await fetch(new URL(protocol.path, origin), {
      headers,
      signal: combined,
      redirect: "error",
      ...{}
    });
    if (combined.aborted) {
      await response.body?.cancel();
      combined.throwIfAborted();
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      return response.status === 401 ? result("rejected", "not_authenticated", "login") : result(
        "inconclusive",
        "unreachable",
        response.status === 403 ? "configure" : "retry"
      );
    }
    const bytes = await readRequestBytes({ body: response.body, signal: combined }, 64 * 1024);
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return protocol.proof.safeParse(body).success ? result("valid", "ready") : result("inconclusive", "unreachable", "retry");
  };
  try {
    const validation = await abortable(work(), combined);
    signal?.throwIfAborted();
    return validation;
  } catch {
    signal?.throwIfAborted();
    return result("inconclusive", "unreachable", "retry");
  }
}

// src/ai/providers/google.ts
var transcriptSchema2 = zod.z.array(zod.z.object({ role: zod.z.enum(["user", "model"]), parts: zod.z.array(zod.z.record(zod.z.string(), zod.z.unknown())) })).max(1e3);
var efforts = zod.z.enum(["minimal", "low", "medium", "high"]);
function contents(request) {
  const history = request.continuation ? transcriptSchema2.parse(request.continuation.data) : [];
  const calls = /* @__PURE__ */ new Map();
  for (const message of history)
    for (const part of message.parts ?? []) {
      if (part.functionCall?.id && part.functionCall.name)
        calls.set(part.functionCall.id, part.functionCall.name);
    }
  for (const message of request.messages)
    for (const call of message.toolCalls ?? []) calls.set(call.id, call.name);
  for (const message of request.messages) {
    if (message.role === "system") continue;
    const parts = message.content.map((part) => {
      if (part.type === "image_url")
        throw new ProviderError(
          "unsupported_capability",
          "The native Google transport requires inline image data or a supported file reference"
        );
      return part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.mediaType, data: Buffer.from(part.data).toString("base64") } };
    });
    if (message.role === "tool") {
      const name = message.toolCallId && calls.get(message.toolCallId);
      if (!name || parts.some((part) => part.text === void 0))
        throw new ProviderError(
          "invalid_request",
          "Tool output must identify its original call and contain text"
        );
      history.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              id: message.toolCallId,
              name,
              response: { result: parts.map((part) => part.text).join("\n") }
            }
          }
        ]
      });
      continue;
    }
    for (const call of message.toolCalls ?? [])
      parts.push({ functionCall: { id: call.id, name: call.name, args: call.arguments } });
    history.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }
  return history;
}
function createGoogleProvider(descriptor, options = {}) {
  function client(context) {
    if (typeof context.credentials.apiKey !== "string" || !context.credentials.apiKey)
      throw new MissingProviderCredentialsError("Configure a Google API key");
    if (context.credentials.baseUrl)
      throw new ProviderError("invalid_request", "The Google transport requires its official endpoint");
    return new genai.GoogleGenAI({
      apiKey: context.credentials.apiKey,
      vertexai: false,
      httpOptions: {
        baseUrl: "https://generativelanguage.googleapis.com",
        apiVersion: "v1beta",
        retryOptions: { attempts: 1 }
      }
    });
  }
  return {
    descriptor,
    validateConfiguration(context) {
      client(context);
    },
    async models(context) {
      const page = await client(context).models.list({
        config: { abortSignal: context.signal, pageSize: 100 }
      });
      const result2 = [];
      for await (const model of page) {
        context.signal.throwIfAborted();
        if (!model.name || !model.supportedActions?.includes("generateContent")) continue;
        result2.push({
          id: model.name.replace(/^models\//, ""),
          label: model.displayName ?? model.name,
          capabilities: descriptor.capabilities,
          contextTokens: model.inputTokenLimit,
          maxOutputTokens: model.outputTokenLimit
        });
        if (result2.length > 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
      }
      return result2;
    },
    async readiness(context) {
      try {
        client(context);
        const validation = await validateServiceCredentials(
          {
            protocol: "google",
            origin: "https://generativelanguage.googleapis.com",
            credentials: {
              apiKey: typeof context.credentials.apiKey === "string" ? context.credentials.apiKey : void 0
            }
          },
          context.signal
        );
        return {
          ...validation.readiness,
          ...validation.status === "rejected" ? { action: "configure" } : {}
        };
      } catch (error) {
        context.signal.throwIfAborted();
        if (error instanceof MissingProviderCredentialsError)
          return { code: "missing_credentials", checkedAt: Date.now(), action: "configure" };
        if (error instanceof ProviderError)
          return { code: "not_configured", checkedAt: Date.now(), action: "configure" };
        const status = error instanceof Error && "status" in error ? error.status : void 0;
        return {
          code: status === 401 ? "not_authenticated" : "unreachable",
          checkedAt: Date.now(),
          action: status === 401 || status === 403 ? "configure" : "retry"
        };
      }
    },
    async *generate(request, context) {
      if (request.webSearch !== void 0)
        throw new ProviderError(
          "unsupported_capability",
          "This transport does not support web search settings"
        );
      if (request.continuation && (request.continuation.provider !== request.provider || request.continuation.model !== request.model))
        throw new ProviderError("invalid_request", "Continuation belongs to another provider or model");
      const history = contents(request);
      const tools = [];
      if (request.allowWeb) tools.push({ googleSearch: {} });
      if (request.tools?.length)
        tools.push({
          functionDeclarations: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.schema
          }))
        });
      const parameters = {
        model: request.model,
        contents: history,
        config: {
          abortSignal: context.signal,
          systemInstruction: request.messages.filter((message) => message.role === "system").map(
            (message) => message.content.map((part) => {
              if (part.type !== "text")
                throw new ProviderError("invalid_request", "System instructions accept text only");
              return part.text;
            }).join("\n")
          ).join("\n") || void 0,
          maxOutputTokens: request.maxOutputTokens,
          temperature: validateTemperature(request.temperature),
          responseMimeType: request.schema || request.responseFormat ? "application/json" : void 0,
          responseJsonSchema: request.schema,
          thinkingConfig: request.effort ? { thinkingLevel: efforts.parse(request.effort).toUpperCase() } : void 0,
          tools: tools.length ? tools : void 0,
          automaticFunctionCalling: { disable: true }
        }
      };
      async function* single() {
        yield await client(context).models.generateContent(parameters);
      }
      const stream = options.streaming === false ? single() : await client(context).models.generateContentStream(parameters);
      const parts = [];
      let reason;
      let usage = { inputTokens: null, outputTokens: null };
      let authoritativeUsage;
      let output = "";
      let bytes = 0;
      const citations = /* @__PURE__ */ new Map();
      try {
        for await (const chunk of stream) {
          context.signal.throwIfAborted();
          if (chunk.usageMetadata)
            usage = {
              ...inclusiveTokenTotals({
                input: chunk.usageMetadata.promptTokenCount,
                output: chunk.usageMetadata.candidatesTokenCount,
                additionalInput: chunk.usageMetadata.toolUsePromptTokenCount,
                additionalOutput: chunk.usageMetadata.thoughtsTokenCount,
                total: chunk.usageMetadata.totalTokenCount
              }),
              cachedInputTokens: chunk.usageMetadata.cachedContentTokenCount ?? null,
              reasoningTokens: chunk.usageMetadata.thoughtsTokenCount ?? null
            };
          const candidate = chunk.candidates?.[0];
          if (chunk.usageMetadata && (options.streaming === false || candidate?.finishReason))
            authoritativeUsage ??= { ...usage };
          if (chunk.promptFeedback?.blockReason)
            throw new ProviderError("invalid_stream", "Google blocked the request");
          if (!candidate) continue;
          if (reason)
            throw new ProviderError("invalid_stream", "Google emitted candidate data after completion");
          for (const part of candidate.content?.parts ?? []) {
            bytes += Buffer.byteLength(JSON.stringify(part));
            if (bytes > (request.maxOutputBytes ?? 16 * 1024 * 1024))
              throw new ProviderError("invalid_stream", "Google output exceeded the configured limit");
            if (part.functionCall && !part.functionCall.id) part.functionCall.id = crypto.randomUUID();
            parts.push(part);
            if (part.text && !part.thought) {
              output += part.text;
              yield { type: "text", text: part.text };
            }
          }
          const grounding = candidate.groundingMetadata;
          if (grounding) {
            bytes += Buffer.byteLength(JSON.stringify(grounding));
            if (bytes > (request.maxOutputBytes ?? 16 * 1024 * 1024))
              throw new ProviderError("invalid_stream", "Google grounding exceeded the configured limit");
          }
          for (const support of grounding?.groundingSupports ?? [])
            for (const index of support.groundingChunkIndices ?? []) {
              const web = grounding?.groundingChunks?.[index]?.web;
              if (!web?.uri) continue;
              const citation = {
                type: "citation",
                url: web.uri,
                title: web.title ?? web.uri,
                start: support.segment?.startIndex ?? 0,
                end: support.segment?.endIndex ?? 0
              };
              citations.set(JSON.stringify(citation), citation);
            }
          if (candidate.finishReason) {
            if (candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS")
              throw new ProviderError("invalid_stream", "Google could not complete the response");
            reason = candidate.finishReason === "STOP" ? "complete" : "length";
          }
        }
        if (!reason) throw new ProviderError("invalid_stream", "Google ended without a completion reason");
        const calls = parts.flatMap((part) => part.functionCall ? [part.functionCall] : []);
        for (const call of calls) {
          if (!call.id || !call.name || call.partialArgs?.length || call.willContinue)
            throw new ProviderError("invalid_stream", "Incomplete Google tool call");
          yield { type: "tool_call", id: call.id, name: call.name, arguments: call.args ?? {} };
        }
        if ((request.schema || request.responseFormat) && !calls.length && reason === "complete")
          JSON.parse(output);
        for (const citation of citations.values()) yield citation;
        yield {
          type: "continuation",
          provider: request.provider,
          model: request.model,
          data: [...history, { role: "model", parts }]
        };
        yield {
          type: "finish",
          reason: calls.length && reason === "complete" ? "tool_calls" : reason,
          usage
        };
      } catch (error) {
        if (authoritativeUsage)
          throw new GenerationUsageError(
            error instanceof Error ? error.message : "Provider generation failed",
            authoritativeUsage,
            { cause: error }
          );
        throw error;
      }
    }
  };
}

// src/ai/configuration/catalog.ts
var definitions = {
  anthropic: {
    displayName: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    allowCustomBaseUrl: true,
    models: [
      {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        costPer1kInput: 1e-3,
        costPer1kOutput: 5e-3
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        costPer1kInput: 3e-3,
        costPer1kOutput: 0.015
      }
    ]
  },
  openai: {
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    models: [{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini", costPer1kInput: 4e-4, costPer1kOutput: 16e-4 }]
  },
  ollama: {
    displayName: "Ollama",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434/v1",
    models: []
  },
  llamacpp: {
    displayName: "llama.cpp",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    defaultBaseUrl: "http://localhost:8080/v1",
    models: []
  },
  vllm: {
    displayName: "vLLM",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    defaultBaseUrl: "http://localhost:8000/v1",
    models: []
  },
  google: {
    displayName: "Google",
    allowCustomModel: true,
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", costPer1kInput: 15e-5, costPer1kOutput: 35e-4 }
    ]
  },
  "claude-code": {
    displayName: "Claude Code (Max)",
    models: [
      { id: "sonnet", name: "Claude Sonnet (via CLI)", costPer1kInput: 0, costPer1kOutput: 0 },
      { id: "opus", name: "Claude Opus (via CLI)", costPer1kInput: 0, costPer1kOutput: 0 }
    ]
  },
  codex: {
    displayName: "OpenAI Codex (CLI)",
    models: [{ id: "codex", name: "Codex CLI", costPer1kInput: 0, costPer1kOutput: 0 }]
  },
  meta: {
    displayName: "Meta (Muse)",
    defaultBaseUrl: "https://api.meta.ai/v1",
    models: [
      {
        id: "muse-spark-1.3",
        name: "Muse Spark 1.3 (Standard)",
        costPer1kInput: 125e-5,
        costPer1kOutput: 425e-5
      }
    ]
  }
};
var PROVIDER_METADATA = definitions;
var CLI_PROVIDERS = { "claude-code": "claude", codex: "codex" };
var LOCAL_PROVIDER_IDS = ["ollama", "llamacpp", "vllm"];
var LOCAL_PROVIDERS = new Set(LOCAL_PROVIDER_IDS);
function providerDescriptors() {
  return Object.entries(PROVIDER_METADATA).map(([id, metadata]) => {
    const cli = Boolean(CLI_PROVIDERS[id]);
    const capabilities = ["text", "vision", "structured"];
    if (!cli) capabilities.push("tools");
    if (["anthropic", "google", "claude-code", "codex"].includes(id)) capabilities.push("web");
    return {
      id,
      label: metadata.displayName,
      transport: cli ? "cli" : LOCAL_PROVIDERS.has(id) ? "local" : "api",
      capabilities,
      fields: [
        ...providerCredentials(id, "text").fields.map((field) => ({
          ...field,
          label: field.id === "apiKey" ? "API key" : field.label
        })),
        ...metadata.allowCustomBaseUrl ? [
          {
            id: "baseUrl",
            label: "API endpoint",
            kind: "string",
            secret: false,
            required: false,
            placeholder: metadata.defaultBaseUrl
          },
          {
            id: "compatibleApiKey",
            label: "Custom endpoint API key",
            kind: "string",
            secret: true,
            required: false
          },
          {
            id: "allowAnonymous",
            label: "Endpoint needs no API key",
            kind: "boolean",
            secret: false,
            required: false
          }
        ] : []
      ].filter((field) => field.id !== "allowAnonymous" || id !== "anthropic"),
      models: metadata.models.map((model) => ({ id: model.id, label: model.name, capabilities }))
    };
  });
}

// src/ai/configuration/compatible.ts
function captureCompatibleApi(input2) {
  if (!input2.endpoint.trim()) throw new ProviderError("invalid_request", "A compatible endpoint is required");
  const connection = providerConnection(
    { apiKey: input2.apiKey ?? "" },
    { defaultBaseUrl: input2.endpoint.trim(), requiresKey: false }
  );
  if (connection.apiKey && input2.credentialBinding) {
    const binding = input2.credentialBinding;
    const bound = providerConnection({}, { defaultBaseUrl: binding.endpoint, requiresKey: false });
    if (binding.protocol !== "compatible" || bound.baseUrl !== connection.baseUrl)
      throw new ProviderError("invalid_request", "The saved credential belongs to a different endpoint");
  }
  return {
    transport: "compatible",
    descriptor: {
      id: input2.provider,
      label: input2.label,
      transport: input2.transport ?? "api",
      fields: [],
      models: [],
      capabilities: [...input2.capabilities ?? ["text", "vision", "structured"]]
    },
    credentials: { apiKey: connection.apiKey },
    baseUrl: connection.baseUrl,
    requiresKey: input2.requiresKey ?? false
  };
}
function captureCompatibleModel(input2) {
  const model = input2.model.trim();
  if (!model) throw new ProviderError("invalid_request", "A compatible model is required");
  return { ...captureCompatibleApi(input2), model };
}

// src/ai/configuration/providers.ts
function createSelectedApiRegistry(selection, options = {}) {
  const descriptor = structuredClone(selection.descriptor);
  const credentials = { ...selection.credentials };
  const common = {
    descriptor,
    streaming: options.streaming,
    maxRetries: options.maxRetries,
    fetch: options.fetch
  };
  const adapter = selection.transport === "anthropic" ? createAnthropicProvider({ ...common, ...options.anthropic }) : selection.transport === "responses" ? createResponsesProvider({
    ...common,
    defaultBaseUrl: selection.baseUrl,
    webSearchType: selection.webSearchType
  }) : createCompatibleProvider({
    ...common,
    ...options.compatible,
    defaultBaseUrl: selection.baseUrl,
    requiresKey: selection.requiresKey
  });
  return new ProviderRegistry({
    providers: [adapter],
    timeoutMode: options.timeoutMode,
    credentials: {
      async resolve() {
        return { ...credentials };
      }
    }
  });
}
function apiProviders(options = {}) {
  return providerDescriptors().filter((descriptor) => descriptor.transport !== "cli").map((descriptor) => {
    if (descriptor.id === "anthropic")
      return createAnthropicProvider({ descriptor, streaming: options.streaming });
    if (descriptor.id === "google")
      return createGoogleProvider(descriptor, { streaming: options.streaming });
    if (descriptor.id === "openai" && options.openaiTransport === "responses")
      return createResponsesProvider({
        streaming: options.streaming,
        descriptor: { ...descriptor, capabilities: [...descriptor.capabilities, "web"] }
      });
    return createCompatibleProvider({
      descriptor,
      defaultBaseUrl: PROVIDER_METADATA[descriptor.id]?.defaultBaseUrl ?? "https://api.openai.com/v1",
      requiresKey: descriptor.transport === "api",
      normalizeV1: descriptor.transport === "local",
      streaming: options.streaming,
      maxTokensParameter: options.maxTokensParameter ?? (descriptor.transport === "local" ? "max_tokens" : "max_completion_tokens")
    });
  });
}

exports.apiProviders = apiProviders;
exports.captureCompatibleApi = captureCompatibleApi;
exports.captureCompatibleModel = captureCompatibleModel;
exports.createSelectedApiRegistry = createSelectedApiRegistry;
exports.providerConnection = providerConnection;
