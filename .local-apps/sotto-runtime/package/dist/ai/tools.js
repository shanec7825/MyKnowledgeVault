import { ProviderCleanupError, ProviderError } from '../chunk-YIW7ZQGE.js';
import '../chunk-NGJOFCTL.js';
import { interruptibleStream } from '../chunk-HDHO73O7.js';
import { abortable } from '../chunk-GDO34PSX.js';
import { randomUUID } from 'crypto';

function defineTool(definition) {
  return {
    name: definition.name,
    description: definition.description,
    schema: definition.schema,
    prepare(input, context) {
      const parsed = definition.parse(input);
      return {
        effect: definition.effect,
        authorize: () => definition.authorize(parsed, context),
        execute: () => definition.execute(parsed, context)
      };
    }
  };
}
var ToolExecutionError = class extends Error {
  constructor(code, callId, options) {
    super(`Agent tool ${code}`, options);
    this.code = code;
    this.callId = callId;
  }
  code;
  callId;
};
var usageFields = [
  "inputTokens",
  "outputTokens",
  "cachedInputTokens",
  "cacheWriteTokens",
  "reasoningTokens"
];
var ToolRuntime = class {
  constructor(options) {
    this.options = options;
    this.rounds = options.maxToolRounds ?? 6;
    this.calls = options.maxCalls ?? 24;
    this.timeout = options.toolTimeoutMs ?? 3e4;
    this.argumentBytes = options.maxArgumentBytes ?? 64e3;
    this.resultBytes = options.maxResultBytes ?? 1e6;
    if (![this.rounds, this.calls, this.timeout, this.argumentBytes, this.resultBytes].every(
      (value) => Number.isSafeInteger(value) && value > 0
    ))
      throw new Error("Tool limits must be positive integers");
    for (const tool of options.tools) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(tool.name) || this.tools.has(tool.name))
        throw new Error("Invalid or duplicate tool name");
      this.tools.set(tool.name, tool);
    }
  }
  options;
  tools = /* @__PURE__ */ new Map();
  rounds;
  calls;
  timeout;
  argumentBytes;
  resultBytes;
  stream(request, actor) {
    return interruptibleStream((signal) => this.run({ ...request, signal }, actor), {
      signal: request.signal,
      isCleanupError: (error) => error instanceof ProviderCleanupError
    });
  }
  async *run(request, actor) {
    if (![request.consumerId, request.conversationId, request.credentialOwnerId].every(
      (value) => Boolean(value?.trim())
    ))
      throw new ProviderError(
        "invalid_request",
        "Tool execution requires server-derived caller, conversation and credential owner identities"
      );
    const controller = new AbortController();
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(request.timeoutMs ?? 6e5),
      ...request.signal ? [request.signal] : []
    ]);
    const operationId = randomUUID();
    const seen = /* @__PURE__ */ new Set();
    const totals = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0
    };
    const instructions = request.messages.filter((message) => message.role === "system");
    let history = [...request.messages];
    let continuation = request.continuation;
    const structuredFinal = this.options.structuredFinalAnswer && Boolean(request.responseFormat || request.schema);
    let finalize = false;
    try {
      for (let round = 0; round <= this.rounds + (structuredFinal ? 1 : 0); round++) {
        signal.throwIfAborted();
        const calls = [];
        let finish;
        let usage;
        let text = "";
        let nextContinuation;
        const limitReached = this.options.finalAnswerOnLimit && (round === this.rounds || seen.size >= this.calls);
        const finalAnswer = finalize || limitReached;
        if (limitReached && !finalize)
          yield { type: "tool_limit", limit: round === this.rounds ? "rounds" : "calls" };
        for await (const event of this.options.registry.generate({
          ...request,
          messages: history,
          continuation,
          signal,
          responseFormat: structuredFinal && !finalAnswer ? void 0 : request.responseFormat,
          schema: structuredFinal && !finalAnswer ? void 0 : request.schema,
          tools: finalAnswer ? void 0 : [...this.tools.values()].map(({ name, description, schema }) => ({
            name,
            description,
            schema
          }))
        })) {
          if (event.type === "finish") {
            finish = event;
            usage = event.usage ?? usage;
            continue;
          }
          if (event.type === "usage") {
            usage = event.usage;
            continue;
          }
          if (event.type === "tool_call") {
            if (finalAnswer) throw new ToolExecutionError("invalid_calls", event.id);
            if (seen.size + calls.length >= this.calls) throw new ToolExecutionError("tool_limit");
            calls.push(event);
            continue;
          }
          if (event.type === "continuation") {
            nextContinuation = event;
            continue;
          }
          if (event.type === "text") text += event.text;
          if (structuredFinal && !finalAnswer && event.type === "text") continue;
          yield event;
        }
        if (!finish) throw new ProviderError("invalid_stream", "Missing round completion");
        for (const field of usageFields) {
          const measurement = usage?.[field];
          totals[field] = totals[field] === null || measurement == null ? null : (totals[field] ?? 0) + measurement;
        }
        if (finish.reason !== "tool_calls") {
          if (calls.length) throw new ToolExecutionError("invalid_calls");
          if (structuredFinal && !finalAnswer) {
            if (finish.reason !== "complete")
              throw new ProviderError("invalid_stream", "Provider truncated the tool-planning response");
            finalize = true;
            continue;
          }
          if (nextContinuation) yield { type: "continuation", ...nextContinuation };
          yield { type: "finish", reason: finish.reason, usage: totals };
          return;
        }
        if (!calls.length) throw new ToolExecutionError("invalid_calls");
        if (round === this.rounds || seen.size + calls.length > this.calls)
          throw new ToolExecutionError("tool_limit");
        const prepared = calls.map((call) => {
          if (!call.id || call.id.length > 256 || seen.has(call.id) || Buffer.byteLength(JSON.stringify(call.arguments)) > this.argumentBytes)
            throw new ToolExecutionError("invalid_calls", call.id);
          seen.add(call.id);
          const tool = this.tools.get(call.name);
          if (!tool) throw new ToolExecutionError("unknown_tool", call.id);
          const context = {
            actor,
            signal,
            operationId: `${operationId}:${call.id}`
          };
          const operation = tool.prepare(call.arguments, context);
          return { call, operation, context };
        });
        for (const item of prepared) await abortable(item.operation.authorize(), signal);
        const results = [];
        for (const item of prepared) {
          signal.throwIfAborted();
          yield { type: "tool_status", callId: item.call.id, name: item.call.name, status: "running" };
          signal.throwIfAborted();
          item.context.signal = AbortSignal.any([signal, AbortSignal.timeout(this.timeout)]);
          await abortable(item.operation.authorize(), item.context.signal);
          item.context.signal.throwIfAborted();
          let result;
          try {
            result = await abortable(item.operation.execute(), item.context.signal);
          } catch (error) {
            throw new ToolExecutionError(
              item.operation.effect === "write" ? "outcome_unknown" : "tool_failed",
              item.call.id,
              { cause: error }
            );
          }
          item.context.signal.throwIfAborted();
          if (Buffer.byteLength(result) > this.resultBytes)
            throw new ToolExecutionError("completed_result_too_large", item.call.id);
          results.push({ role: "tool", toolCallId: item.call.id, content: [{ type: "text", text: result }] });
          yield { type: "tool_status", callId: item.call.id, name: item.call.name, status: "complete" };
        }
        if (nextContinuation) {
          continuation = nextContinuation;
          history = [...instructions, ...results];
        } else {
          if (continuation) throw new ProviderError("invalid_stream", "Provider lost its continuation state");
          history.push(
            {
              role: "assistant",
              content: text ? [{ type: "text", text }] : [],
              toolCalls: calls.map(({ id, name, arguments: args }) => ({ id, name, arguments: args }))
            },
            ...results
          );
        }
      }
    } finally {
      controller.abort();
    }
  }
};

export { ToolExecutionError, ToolRuntime, defineTool };
