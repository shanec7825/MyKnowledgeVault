'use strict';

require('crypto');
var zod = require('zod');
var Anthropic = require('@anthropic-ai/sdk');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Anthropic__default = /*#__PURE__*/_interopDefault(Anthropic);

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
  if (!apiKey && !(options.allowAnonymous && credentials.allowAnonymous === true))
    throw new MissingProviderCredentialsError("Configure credentials for the selected endpoint");
  return { baseUrl: base.href.replace(/\/+$/, ""), apiKey };
}

// src/ai/providers/http.ts
function providerFetch(context, implementation = globalThis.fetch) {
  return async (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : void 0));
    if (Number(headers.get("x-stainless-retry-count") ?? 0) > 0) context.onRetry?.();
    return implementation(input, init);
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
  const probeFetch = async (input, init) => {
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : void 0);
    const combined = inherited ? AbortSignal.any([signal, inherited]) : signal;
    combined.throwIfAborted();
    const endpoint = input instanceof Request ? input.url : String(input);
    const response = await implementation(input, { ...init, signal: combined, redirect: "error" });
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
      const result = [];
      for await (const model of page) {
        context.signal.throwIfAborted();
        if (result.length >= 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
        result.push({
          id: model.id,
          label: model.display_name,
          capabilities: options.descriptor.capabilities
        });
      }
      return result;
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

exports.createAnthropicProvider = createAnthropicProvider;
