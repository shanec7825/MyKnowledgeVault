import { sumTokenUsage } from './chunk-NGJOFCTL.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

function observation(context) {
  const started = performance.now();
  const controller = new AbortController();
  const signal = context.signal ? AbortSignal.any([context.signal, controller.signal]) : controller.signal;
  let firstOutputMs = null;
  let usage = sumTokenUsage({ inputTokens: null, outputTokens: null });
  const observer = {
    signal,
    output() {
      firstOutputMs ??= performance.now() - started;
    },
    usage(value) {
      usage = sumTokenUsage(value);
    }
  };
  return {
    observer,
    abort: () => controller.abort(),
    finish(outcome, cleanupFailed = false) {
      context.collector.record({
        version: 1,
        id: randomUUID(),
        timestamp: Date.now(),
        kind: "execution",
        operation: context.operation,
        provider: context.provider,
        model: context.model,
        consumerId: context.consumerId,
        credentialOwnerId: context.credentialOwnerId,
        outcome,
        durationMs: performance.now() - started,
        firstOutputMs,
        ...usage,
        estimatedCost: null,
        ...cleanupFailed ? { errorCode: "cleanup_failed" } : {}
      });
    }
  };
}
async function observeExecution(context, run) {
  const state = observation(context);
  let outcome = "error";
  try {
    state.observer.signal.throwIfAborted();
    const value = await run(state.observer);
    state.observer.signal.throwIfAborted();
    outcome = "success";
    return value;
  } catch (error) {
    outcome = state.observer.signal.aborted ? "cancelled" : "error";
    throw error;
  } finally {
    state.abort();
    state.finish(outcome);
  }
}
async function closeIterator(iterator, failed, report) {
  try {
    await iterator?.return?.();
  } catch (error) {
    report();
    if (!failed) throw error;
  }
}
function observeStream(context, open, isOutput) {
  const controller = new AbortController();
  const stream = observedStream(
    {
      ...context,
      signal: context.signal ? AbortSignal.any([context.signal, controller.signal]) : controller.signal
    },
    open,
    isOutput
  );
  const finish = stream.return.bind(stream);
  const fail = stream.throw.bind(stream);
  stream.return = (value) => {
    controller.abort();
    return finish(value);
  };
  stream.throw = (error) => {
    controller.abort(error);
    return fail(error);
  };
  return stream;
}
async function* observedStream(context, open, isOutput) {
  const state = observation(context);
  let outcome = "cancelled";
  let iterator;
  let failed = false;
  let exhausted = false;
  let cleanupFailed = false;
  try {
    state.observer.signal.throwIfAborted();
    iterator = open(state.observer)[Symbol.asyncIterator]();
    while (true) {
      state.observer.signal.throwIfAborted();
      const next = await iterator.next();
      state.observer.signal.throwIfAborted();
      if (next.done) {
        exhausted = true;
        outcome = "success";
        return;
      }
      if (isOutput(next.value)) state.observer.output();
      yield next.value;
    }
  } catch (error) {
    failed = true;
    outcome = state.observer.signal.aborted ? "cancelled" : "error";
    throw error;
  } finally {
    state.abort();
    try {
      if (!exhausted)
        await closeIterator(iterator, failed, () => {
          cleanupFailed = true;
          if (!failed) outcome = "error";
        });
    } finally {
      state.finish(outcome, cleanupFailed);
    }
  }
}

// src/observability/index.ts
var identifier = z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/);
var measurement = z.number().finite().nonnegative().nullable();
var metricEventSchema = z.object({
  version: z.literal(1),
  id: identifier,
  timestamp: z.number().int().nonnegative(),
  kind: z.enum(["execution", "access", "setup", "delivery", "health"]),
  operation: identifier,
  outcome: z.enum(["success", "error", "cancelled"]),
  provider: identifier.optional(),
  model: z.string().regex(/^[a-zA-Z0-9_.:/@+-]{1,256}$/).optional(),
  consumerId: identifier.optional(),
  credentialOwnerId: identifier.optional(),
  durationMs: measurement.optional(),
  firstOutputMs: measurement.optional(),
  queueMs: measurement.optional(),
  retryCount: z.number().int().nonnegative().optional(),
  inputTokens: measurement.optional(),
  outputTokens: measurement.optional(),
  cachedInputTokens: measurement.optional(),
  cacheWriteTokens: measurement.optional(),
  reasoningTokens: measurement.optional(),
  audioSeconds: measurement.optional(),
  estimatedCost: measurement.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  pricingVersion: identifier.optional(),
  errorCode: identifier.optional()
});
var MetricCollector = class {
  constructor(options) {
    this.options = options;
    this.capacity = options.capacity ?? 1e3;
    this.batchSize = options.batchSize ?? 100;
    this.timeoutMs = options.timeoutMs ?? 5e3;
    for (const value of [this.capacity, this.batchSize, this.timeoutMs]) {
      if (!Number.isSafeInteger(value) || value < 1)
        throw new Error("Collector limits must be positive integers");
    }
  }
  options;
  pending = [];
  running;
  capacity;
  batchSize;
  timeoutMs;
  dropped = 0;
  rejected = 0;
  failures = 0;
  closed = false;
  record(value) {
    const parsed = metricEventSchema.safeParse(value);
    if (!parsed.success) {
      this.rejected++;
      return false;
    }
    if (this.closed || this.pending.length >= this.capacity) {
      this.dropped++;
      return false;
    }
    this.pending.push(parsed.data);
    return true;
  }
  status() {
    return {
      pending: this.pending.length,
      dropped: this.dropped,
      rejected: this.rejected,
      failures: this.failures,
      closed: this.closed
    };
  }
  flush() {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = void 0;
    });
    return this.running;
  }
  async close() {
    this.closed = true;
    await this.flush();
    if (this.pending.length) await this.flush();
  }
  async drain() {
    let remaining = this.pending.length;
    const deadline = Date.now() + this.timeoutMs;
    while (remaining > 0) {
      if (Date.now() >= deadline) {
        this.pending.splice(0, remaining);
        this.dropped += remaining;
        break;
      }
      const batch = this.pending.splice(0, Math.min(remaining, this.batchSize));
      remaining -= batch.length;
      const controller = new AbortController();
      let timer;
      try {
        await Promise.race([
          this.options.sink.write(batch, controller.signal),
          new Promise((resolve) => {
            timer = setTimeout(
              () => {
                controller.abort(new Error("Telemetry flush timed out"));
                resolve();
              },
              Math.max(1, deadline - Date.now())
            );
          }).then(() => {
            throw controller.signal.reason;
          })
        ]);
      } catch {
        this.failures++;
        this.dropped += batch.length;
      } finally {
        clearTimeout(timer);
      }
    }
  }
};
function sumKnownCosts(events) {
  if (!events.length) return null;
  let total = 0;
  const currency = events[0]?.currency;
  for (const event of events) {
    if (event.estimatedCost === null || event.estimatedCost === void 0 || event.currency !== currency)
      return null;
    total += event.estimatedCost;
  }
  return Number.isFinite(total) ? total : null;
}

export { MetricCollector, metricEventSchema, observeExecution, observeStream, sumKnownCosts };
