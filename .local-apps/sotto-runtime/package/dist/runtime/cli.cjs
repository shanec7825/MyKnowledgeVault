'use strict';

// src/ai/usage.ts
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function cliTokenUsage(provider, event) {
  const envelope = record(event);
  if (envelope?.type !== (provider === "codex" ? "turn.completed" : "result")) return void 0;
  const usage = record(envelope.usage);
  if (!usage) return void 0;
  const count = (field) => {
    const value = usage[field];
    return typeof value === "number" ? knownTokenSum(value) : null;
  };
  const cachedInputTokens = count(provider === "codex" ? "cached_input_tokens" : "cache_read_input_tokens");
  const cacheWriteTokens = count(
    provider === "codex" ? "cache_write_input_tokens" : "cache_creation_input_tokens"
  );
  const inputTokens = provider === "codex" ? count("input_tokens") : knownTokenSum(count("input_tokens"), cachedInputTokens, cacheWriteTokens);
  const outputTokens = count("output_tokens");
  const reasoningTokens = provider === "codex" ? count("reasoning_output_tokens") : null;
  const invalidInput = inputTokens !== null && (cachedInputTokens !== null && cachedInputTokens > inputTokens || cacheWriteTokens !== null && cacheWriteTokens > inputTokens || cachedInputTokens !== null && cacheWriteTokens !== null && cachedInputTokens + cacheWriteTokens > inputTokens);
  return {
    inputTokens: invalidInput ? null : inputTokens,
    outputTokens: outputTokens !== null && reasoningTokens !== null && reasoningTokens > outputTokens ? null : outputTokens,
    cachedInputTokens: invalidInput ? null : cachedInputTokens,
    cacheWriteTokens: invalidInput ? null : cacheWriteTokens,
    reasoningTokens: outputTokens !== null && reasoningTokens !== null && reasoningTokens > outputTokens ? null : reasoningTokens
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

// src/runtime/process/cli.ts
var CliProtocolError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "CliProtocolError";
  }
};
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
var CliLines = class {
  constructor(maximumLineChars) {
    this.maximumLineChars = maximumLineChars;
    if (!Number.isSafeInteger(maximumLineChars) || maximumLineChars < 1)
      throw new Error("Invalid CLI line limit");
  }
  maximumLineChars;
  buffer = "";
  finished = false;
  *push(text) {
    if (this.finished) throw new CliProtocolError("CLI output already finished");
    let start = 0;
    while (start < text.length) {
      const newline = text.indexOf("\n", start);
      const end = newline < 0 ? text.length : newline;
      if (this.buffer.length + end - start > this.maximumLineChars)
        throw new CliProtocolError("CLI output record exceeds limit");
      this.buffer += text.slice(start, end);
      if (newline < 0) break;
      const line = this.buffer;
      this.buffer = "";
      yield line;
      start = newline + 1;
    }
  }
  finish() {
    if (this.finished) throw new CliProtocolError("CLI output already finished");
    this.finished = true;
    const output = this.buffer;
    this.buffer = "";
    return output;
  }
};
var CodexOutputDecoder = class {
  lines;
  terminal = false;
  messages = /* @__PURE__ */ new Set();
  constructor(maximumLineChars = 16 * 1024 * 1024) {
    this.lines = new CliLines(maximumLineChars);
  }
  *push(text) {
    for (const line of this.lines.push(text)) yield* this.decode(line);
  }
  /** On transport failure drain measurements with requireTerminal=false, then preserve that failure. */
  *finish(requireTerminal = true) {
    yield* this.decode(this.lines.finish());
    if (requireTerminal && !this.terminal) throw new CliProtocolError("CLI completion record is missing");
  }
  decode(line) {
    if (!line.trim()) return [];
    let value;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new CliProtocolError(
        error instanceof SyntaxError ? "Malformed CLI JSON record" : "Invalid CLI record"
      );
    }
    const event = object(value);
    if (!event || typeof event.type !== "string") throw new CliProtocolError("Invalid CLI event");
    if (this.terminal) throw new CliProtocolError("CLI output follows completion");
    if (event.type === "turn.completed") {
      const usage = cliTokenUsage("codex", event);
      if (!usage) throw new CliProtocolError("Invalid CLI completion usage");
      this.terminal = true;
      return [{ type: "usage", usage }];
    }
    if (event.type === "turn.failed" || event.type === "error") {
      this.terminal = event.type === "turn.failed";
      const message = event.type === "error" ? event.message : object(event.error)?.message;
      if (typeof message !== "string") throw new CliProtocolError("Invalid CLI error event");
      return [{ type: "failure", message: message.slice(-4096) }];
    }
    const item = object(event.item);
    if (event.type === "item.completed" && (!item || typeof item.type !== "string" || typeof item.id !== "string" || !item.id))
      throw new CliProtocolError("Invalid CLI completed item");
    if (event.type !== "item.completed" || item?.type !== "agent_message") return [];
    if (typeof item.id !== "string" || !item.id || typeof item.text !== "string")
      throw new CliProtocolError("Invalid CLI assistant message");
    if (this.messages.has(item.id)) throw new CliProtocolError("Duplicate CLI assistant message");
    if (this.messages.size >= 1e4) throw new CliProtocolError("Too many CLI assistant messages");
    this.messages.add(item.id);
    return item.text ? [{ type: "text", text: item.text }] : [];
  }
};
var ClaudeOutputDecoder = class {
  constructor(options = {}) {
    this.options = options;
    this.lines = new CliLines(options.maximumLineChars ?? 16 * 1024 * 1024);
  }
  options;
  lines;
  messages = /* @__PURE__ */ new Map();
  active;
  terminal = false;
  produced = false;
  *push(text) {
    for (const line of this.lines.push(text)) yield* this.decode(line);
  }
  *finish(requireTerminal = true) {
    yield* this.decode(this.lines.finish());
    if (requireTerminal && !this.terminal) throw new CliProtocolError("CLI completion record is missing");
  }
  *decode(line) {
    if (!line.trim()) return;
    if (this.terminal) throw new CliProtocolError("CLI output follows completion");
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw new CliProtocolError("Malformed CLI JSON record");
    }
    const envelope = object(value);
    if (!envelope) return;
    const event = envelope.type === "stream_event" ? object(envelope.event) : envelope;
    if (!event || typeof event.type !== "string") throw new CliProtocolError("Invalid CLI event");
    if (event.type === "result") {
      this.terminal = true;
      const usage = cliTokenUsage("claude-code", event);
      if (usage) yield { type: "usage", usage };
      if (event.is_error === true || typeof event.subtype === "string" && event.subtype.startsWith("error_")) {
        const errors = Array.isArray(event.errors) ? event.errors.filter((error) => typeof error === "string").join("\n") : "";
        yield {
          type: "failure",
          message: (errors || (typeof event.result === "string" ? event.result : "") || "Claude execution failed").slice(-4096)
        };
        return;
      }
      if (!this.produced && typeof event.result === "string") yield* this.text(event.result);
      return;
    }
    if (event.type === "message_start") {
      this.active = this.message(object(event.message)?.id);
      return;
    }
    if (event.type === "content_block_start") {
      const block = object(event.content_block);
      const message2 = this.active ??= this.message(void 0);
      const index = this.index(event.index);
      if (message2.blocks.has(index) || message2.excludedBlocks.has(index))
        throw new CliProtocolError("Duplicate CLI content block");
      if (block?.type !== "text") {
        message2.excludedBlocks.add(index);
        return;
      }
      if (block?.type === "text" && typeof block.text === "string") {
        message2.blocks.set(index, block.text);
        yield* this.text(block.text);
      }
      return;
    }
    if (event.type === "content_block_delta") {
      const delta = object(event.delta);
      if (!delta || delta.type !== void 0 && delta.type !== "text_delta") return;
      if (typeof delta.text !== "string") return;
      const message2 = this.active ??= this.message(void 0);
      const index = this.index(event.index ?? 0);
      if (message2.excludedBlocks.has(index)) return;
      message2.blocks.set(index, (message2.blocks.get(index) ?? "") + delta.text);
      yield* this.text(delta.text);
      return;
    }
    if (event.type !== "assistant") return;
    const body = object(event.message);
    const blocks = body?.content ?? event.content;
    if (!Array.isArray(blocks)) return;
    const id = body?.id;
    if (typeof id === "string" && id && !this.messages.has(id) && this.active && !this.active.id && !this.active.summarized)
      this.identify(id, this.active);
    const message = typeof id === "string" ? this.messages.get(id) ?? this.message(id) : this.active && !this.active.summarized ? this.active : this.message(void 0);
    for (const [index, value2] of blocks.entries()) {
      const block = object(value2);
      if (block?.type !== "text" || typeof block.text !== "string") continue;
      if (message.excludedBlocks.has(index)) throw new CliProtocolError("Conflicting CLI block type");
      const previous = message.blocks.get(index) ?? "";
      if (!block.text.startsWith(previous)) throw new CliProtocolError("Conflicting CLI assistant text");
      if (message.summarized && block.text !== previous)
        throw new CliProtocolError("Conflicting CLI assistant summary");
      message.blocks.set(index, block.text);
      yield* this.text(block.text.slice(previous.length));
    }
    message.summarized = true;
    if (this.active === message) this.active = void 0;
  }
  message(id) {
    const message = {
      blocks: /* @__PURE__ */ new Map(),
      excludedBlocks: /* @__PURE__ */ new Set(),
      summarized: false
    };
    if (typeof id === "string" && id) {
      this.identify(id, message);
    }
    return message;
  }
  identify(id, message) {
    if (this.messages.has(id)) throw new CliProtocolError("Duplicate CLI message start");
    if (this.messages.size >= 1e4) throw new CliProtocolError("Too many CLI messages");
    message.id = id;
    this.messages.set(id, message);
  }
  index(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= 1e4)
      throw new CliProtocolError("Invalid CLI block index");
    return value;
  }
  *text(text) {
    if (!text) return;
    this.produced = true;
    yield { type: "text", text };
  }
};

exports.ClaudeOutputDecoder = ClaudeOutputDecoder;
exports.CliProtocolError = CliProtocolError;
exports.CodexOutputDecoder = CodexOutputDecoder;
