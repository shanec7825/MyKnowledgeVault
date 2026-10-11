import { modelCredentialProbe, providerFetch } from './chunk-LDMROBJI.js';
import { providerConnection } from './chunk-VNEBU6XY.js';
import { ProviderError, webSearchOptionsSchema, validateTemperature, MissingProviderCredentialsError, imageUrl } from './chunk-YIW7ZQGE.js';
import { knownTokenSum, GenerationUsageError } from './chunk-NGJOFCTL.js';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

var effort = z.enum(["low", "medium", "high", "xhigh", "max"]);
var mediaType = z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]);
var toolSchema = z.object({
  type: z.literal("object"),
  properties: z.record(z.string(), z.unknown()).optional(),
  required: z.array(z.string()).optional()
}).passthrough();
var toolArguments = z.record(z.string(), z.unknown());
var transcript = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())])
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
    return new Anthropic({
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
        if (error instanceof Anthropic.AuthenticationError)
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

export { createAnthropicProvider };
