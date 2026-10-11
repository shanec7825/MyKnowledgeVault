'use strict';

var OpenAI = require('openai');
var zod = require('zod');
require('crypto');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var OpenAI__default = /*#__PURE__*/_interopDefault(OpenAI);

// src/ai/providers/openai-responses.ts

// src/ai/providers/http.ts
function providerFetch(context, implementation = globalThis.fetch) {
  return async (input2, init) => {
    const headers = new Headers(init?.headers ?? (input2 instanceof Request ? input2.headers : void 0));
    if (Number(headers.get("x-stainless-retry-count") ?? 0) > 0) context.onRetry?.();
    return implementation(input2, init);
  };
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
  if (!apiKey && !(options.allowAnonymous && credentials.allowAnonymous === true))
    throw new MissingProviderCredentialsError("Configure credentials for the selected endpoint");
  return { baseUrl: base.href.replace(/\/+$/, ""), apiKey };
}

// src/ai/providers/openai-responses.ts
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
var effort = zod.z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"]);
var argumentsSchema = zod.z.record(zod.z.string(), zod.z.unknown());
var transcriptSchema = zod.z.array(zod.z.object({ type: zod.z.string() }).passthrough()).max(1e3);
function text(message) {
  if (message.content.some((part) => part.type !== "text"))
    throw new ProviderError("invalid_request", "This message role accepts text only");
  return message.content.map((part) => part.type === "text" ? part.text : "").join("\n");
}
function input(request) {
  const result = [];
  if (request.continuation) {
    if (request.continuation.provider !== request.provider || request.continuation.model !== request.model)
      throw new ProviderError("invalid_request", "Continuation belongs to a different provider or model");
    result.push(...transcriptSchema.parse(request.continuation.data));
  }
  for (const message of request.messages) {
    if (message.role === "system") continue;
    if (message.role === "tool") {
      if (!message.toolCallId)
        throw new ProviderError("invalid_request", "A tool result must identify its call");
      result.push({ type: "function_call_output", call_id: message.toolCallId, output: text(message) });
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
      result.push({
        type: "message",
        role: message.role,
        content: message.role === "assistant" && message.content.every((part) => part.type === "text") ? text(message) : content
      });
    if (message.role === "assistant")
      for (const call of message.toolCalls ?? [])
        result.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: JSON.stringify(call.arguments)
        });
  }
  return result;
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
      const result = [];
      for await (const model of models2) {
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
      const tools = (request.tools ?? []).map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.schema,
        strict: false
      }));
      if (request.allowWeb) tools.push({ type: webSearchType });
      const transcript = input(request);
      const stream = await client(context).responses.create(
        {
          model: request.model,
          temperature: validateTemperature(request.temperature),
          input: transcript,
          instructions: request.messages.filter((message) => message.role === "system").map(text).join("\n\n") || void 0,
          stream: options.streaming !== false,
          store: false,
          include: ["reasoning.encrypted_content"],
          ...tools.length ? { tools } : {},
          ...request.maxOutputTokens === void 0 ? {} : { max_output_tokens: request.maxOutputTokens },
          ...request.effort ? { reasoning: { effort: effort.parse(request.effort) } } : {},
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
                arguments: argumentsSchema.parse(JSON.parse(item.arguments))
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
            data: [...transcript, ...response.output]
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

exports.createResponsesProvider = createResponsesProvider;
