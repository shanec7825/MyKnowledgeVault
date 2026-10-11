import { ProviderError, validateTemperature, MissingProviderCredentialsError } from './chunk-YIW7ZQGE.js';
import { validateServiceCredentials } from './chunk-GT4UCTDM.js';
import { inclusiveTokenTotals, GenerationUsageError } from './chunk-NGJOFCTL.js';
import { randomUUID } from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

var transcriptSchema = z.array(z.object({ role: z.enum(["user", "model"]), parts: z.array(z.record(z.string(), z.unknown())) })).max(1e3);
var efforts = z.enum(["minimal", "low", "medium", "high"]);
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
    return new GoogleGenAI({
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
      const result = [];
      for await (const model of page) {
        context.signal.throwIfAborted();
        if (!model.name || !model.supportedActions?.includes("generateContent")) continue;
        result.push({
          id: model.name.replace(/^models\//, ""),
          label: model.displayName ?? model.name,
          capabilities: descriptor.capabilities,
          contextTokens: model.inputTokenLimit,
          maxOutputTokens: model.outputTokenLimit
        });
        if (result.length > 1e4)
          throw new ProviderError("invalid_stream", "Model list exceeded the allowed size");
      }
      return result;
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
            if (part.functionCall && !part.functionCall.id) part.functionCall.id = randomUUID();
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

export { createGoogleProvider };
