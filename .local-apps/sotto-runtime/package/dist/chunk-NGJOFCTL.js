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
var IncompleteGenerationError = class extends Error {
  constructor(reason, usage) {
    super("AI extraction did not complete. Increase its output limit or shorten the input.");
    this.reason = reason;
    this.name = "IncompleteGenerationError";
    this.usage = Object.freeze(normalizeUsage(usage));
  }
  reason;
  [incompleteGeneration] = true;
  usage;
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
function usageFromGenerationError(error) {
  return reportedUsageFromGenerationError(error) ?? normalizeUsage(void 0);
}
function reportedUsageFromGenerationError(error) {
  if (error !== null && typeof error === "object" && (incompleteGeneration in error && error[incompleteGeneration] === true || reportedGenerationUsage in error && error[reportedGenerationUsage] === true) && "usage" in error)
    return normalizeUsage(error.usage);
  return void 0;
}
function sumTokenUsage(...measurements) {
  return {
    inputTokens: knownTokenSum(...measurements.map((usage) => usage.inputTokens)),
    outputTokens: knownTokenSum(...measurements.map((usage) => usage.outputTokens)),
    cachedInputTokens: knownTokenSum(...measurements.map((usage) => usage.cachedInputTokens)),
    cacheWriteTokens: knownTokenSum(...measurements.map((usage) => usage.cacheWriteTokens)),
    reasoningTokens: knownTokenSum(...measurements.map((usage) => usage.reasoningTokens))
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

export { GenerationUsageError, IncompleteGenerationError, cliTokenUsage, inclusiveTokenTotals, knownTokenSum, reportedUsageFromGenerationError, sumTokenUsage, usageFromGenerationError };
