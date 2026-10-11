'use strict';

var promises = require('timers/promises');

// src/runtime/jobs/task-loop.ts
async function runTaskLoop(options) {
  if (!Number.isInteger(options.intervalMs) || options.intervalMs < 1 || options.intervalMs > 2147483647)
    throw new Error("Task interval must be an integer between 1 and 2147483647 milliseconds");
  while (!options.signal.aborted) {
    try {
      await options.task(options.signal);
    } catch (error) {
      if (!options.signal.aborted) options.onError(error);
    }
    if (options.signal.aborted) return;
    try {
      await promises.setTimeout(options.intervalMs, void 0, { signal: options.signal, ref: false });
    } catch (error) {
      if (!options.signal.aborted) throw error;
      return;
    }
  }
}

exports.runTaskLoop = runTaskLoop;
