'use strict';

// src/ai/usage.ts
function knownTokenSum(...counts) {
  let total = 0;
  for (const count of counts) {
    if (count === null || count === void 0 || !Number.isSafeInteger(count) || count < 0) return null;
    total += count;
  }
  return Number.isSafeInteger(total) ? total : null;
}

// src/observability/pricing.ts
function estimateTokenCost(usage, pricing) {
  if (!pricing) return null;
  if (Object.values(usage).some((count) => count != null && knownTokenSum(count) === null)) return null;
  if (usage.inputTokens !== null) {
    const cached2 = usage.cachedInputTokens;
    const written2 = usage.cacheWriteTokens;
    if (cached2 != null && cached2 > usage.inputTokens || written2 != null && written2 > usage.inputTokens || cached2 != null && written2 != null && cached2 + written2 > usage.inputTokens)
      return null;
  }
  if (usage.outputTokens !== null && usage.reasoningTokens != null && usage.reasoningTokens > usage.outputTokens)
    return null;
  const rates = [
    pricing.inputPerMillion,
    pricing.outputPerMillion,
    pricing.cachedInputPerMillion,
    pricing.cacheWritePerMillion
  ];
  if (rates.every((rate) => rate === 0)) return 0;
  const input = knownTokenSum(usage.inputTokens);
  const output = knownTokenSum(usage.outputTokens);
  if (input === null || output === null) return null;
  const cached = usage.cachedInputTokens == null && input === 0 ? 0 : knownTokenSum(usage.cachedInputTokens);
  const written = usage.cacheWriteTokens == null && input === 0 ? 0 : knownTokenSum(usage.cacheWriteTokens);
  const uniformInputRate = pricing.inputPerMillion !== null && pricing.inputPerMillion === pricing.cachedInputPerMillion && pricing.inputPerMillion === pricing.cacheWritePerMillion;
  if (cached !== null && cached > input || written !== null && written > input || cached !== null && written !== null && cached + written > input)
    return null;
  if (!uniformInputRate && (cached === null || written === null)) return null;
  const partitions = uniformInputRate ? [
    [input, pricing.inputPerMillion],
    [output, pricing.outputPerMillion]
  ] : [
    [input - cached - written, pricing.inputPerMillion],
    [cached, pricing.cachedInputPerMillion],
    [written, pricing.cacheWritePerMillion],
    [output, pricing.outputPerMillion]
  ];
  let total = 0;
  for (const [tokens, rate] of partitions) {
    if (tokens === 0) continue;
    if (rate == null || !Number.isFinite(rate) || rate < 0) return null;
    total += tokens / 1e6 * rate;
  }
  return Number.isFinite(total) ? total : null;
}

exports.estimateTokenCost = estimateTokenCost;
