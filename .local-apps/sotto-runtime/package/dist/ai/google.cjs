'use strict';

var crypto = require('crypto');
var genai = require('@google/genai');
var zod = require('zod');

// src/ai/providers/google.ts
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

// src/runtime/process/abort.ts
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
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
zod.z.object({
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

// src/ai/providers/google.ts
var transcriptSchema = zod.z.array(zod.z.object({ role: zod.z.enum(["user", "model"]), parts: zod.z.array(zod.z.record(zod.z.string(), zod.z.unknown())) })).max(1e3);
var efforts = zod.z.enum(["minimal", "low", "medium", "high"]);
function contents(request) {
  const history = request.continuation ? transcriptSchema.parse(request.continuation.data) : [];
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

exports.createGoogleProvider = createGoogleProvider;
