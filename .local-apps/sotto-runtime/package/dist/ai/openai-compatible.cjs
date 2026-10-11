'use strict';

require('crypto');
var zod = require('zod');
var OpenAI = require('openai');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

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

// src/ai/providers/openai-compatible.ts
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
function text(message) {
  if (message.content.some((part) => part.type !== "text"))
    throw new ProviderError("invalid_request", "This message role accepts text only");
  return message.content.map((part) => part.type === "text" ? part.text : "").join("\n");
}
function messages(request, assistantImages = false) {
  return request.messages.map((message) => {
    if (message.role === "tool") {
      if (!message.toolCallId)
        throw new ProviderError("invalid_request", "A tool result must identify its call");
      return { role: "tool", tool_call_id: message.toolCallId, content: text(message) };
    }
    if (message.role === "system") return { role: "system", content: text(message) };
    if (message.role === "assistant" && message.content.every((part) => part.type === "text")) {
      const result = { role: "assistant", content: text(message) };
      if (message.toolCalls?.length)
        result.tool_calls = message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) }
        }));
      return result;
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
      content: message.content.every((part) => part.type === "text") ? text(message) : content
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
      const result = [];
      for await (const model of page) {
        context.signal.throwIfAborted();
        if (result.length >= 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
        result.push({
          id: model.id,
          label: model.id,
          capabilities: options.descriptor.capabilities
        });
      }
      return result;
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
        messages: messages(request, options.assistantImages),
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

exports.createCompatibleProvider = createCompatibleProvider;
