'use strict';

var zod = require('zod');

// src/observability/store.ts
var identifier = zod.z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/);
var measurement = zod.z.number().finite().nonnegative().nullable();
var metricEventSchema = zod.z.object({
  version: zod.z.literal(1),
  id: identifier,
  timestamp: zod.z.number().int().nonnegative(),
  kind: zod.z.enum(["execution", "access", "setup", "delivery", "health"]),
  operation: identifier,
  outcome: zod.z.enum(["success", "error", "cancelled"]),
  provider: identifier.optional(),
  model: zod.z.string().regex(/^[a-zA-Z0-9_.:/@+-]{1,256}$/).optional(),
  consumerId: identifier.optional(),
  credentialOwnerId: identifier.optional(),
  durationMs: measurement.optional(),
  firstOutputMs: measurement.optional(),
  queueMs: measurement.optional(),
  retryCount: zod.z.number().int().nonnegative().optional(),
  inputTokens: measurement.optional(),
  outputTokens: measurement.optional(),
  cachedInputTokens: measurement.optional(),
  cacheWriteTokens: measurement.optional(),
  reasoningTokens: measurement.optional(),
  audioSeconds: measurement.optional(),
  estimatedCost: measurement.optional(),
  currency: zod.z.string().regex(/^[A-Z]{3}$/).optional(),
  pricingVersion: identifier.optional(),
  errorCode: identifier.optional()
});

// src/observability/store.ts
var metricStateSchema = zod.z.object({ version: zod.z.literal(1), events: zod.z.array(metricEventSchema) });
var initialMetricState = () => ({ version: 1, events: [] });
var LocalMetricStore = class {
  constructor(options) {
    this.options = options;
    this.retention = options.retentionMs ?? 30 * 24 * 60 * 60 * 1e3;
    this.capacity = options.maxEvents ?? 5e4;
    this.now = options.now ?? Date.now;
    if (![this.retention, this.capacity].every((value) => Number.isSafeInteger(value) && value > 0))
      throw new Error("Metric retention and capacity must be positive integers");
  }
  options;
  retention;
  capacity;
  now;
  async write(events, signal) {
    signal.throwIfAborted();
    const safe = events.map((event) => metricEventSchema.parse(event));
    await this.options.store.transact((state) => {
      signal.throwIfAborted();
      const retained = state.events.filter((event) => event.timestamp >= this.now() - this.retention);
      const ids = new Set(retained.map((event) => event.id));
      for (const event of safe) {
        if (ids.has(event.id) || event.timestamp < this.now() - this.retention || event.timestamp > this.now() + 6e4)
          continue;
        retained.push(event);
        ids.add(event.id);
      }
      state.events = retained.sort((a, b) => a.timestamp - b.timestamp).slice(-this.capacity);
    });
  }
  async query(filter = {}) {
    const limit = Math.min(1e4, Math.max(1, filter.limit ?? 1e3));
    const cutoff = Math.max(filter.since ?? 0, this.now() - this.retention);
    return (await this.options.store.read()).events.filter(
      (event) => event.timestamp >= cutoff && (filter.consumerId === void 0 || event.consumerId === filter.consumerId) && (filter.provider === void 0 || event.provider === filter.provider)
    ).slice(-limit);
  }
  async eraseConsumer(consumerId) {
    await this.options.store.transact((state) => {
      state.events = state.events.filter((event) => event.consumerId !== consumerId);
    });
  }
  async prune() {
    await this.options.store.transact((state) => {
      state.events = state.events.filter((event) => event.timestamp >= this.now() - this.retention).slice(-this.capacity);
    });
  }
};

exports.LocalMetricStore = LocalMetricStore;
exports.initialMetricState = initialMetricState;
exports.metricStateSchema = metricStateSchema;
