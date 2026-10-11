'use strict';

var crypto = require('crypto');

// src/storage/sql/optimistic.ts
var OptimisticStateStore = class {
  constructor(options) {
    this.options = options;
    this.attempts = options.maxAttempts ?? 20;
    if (!Number.isSafeInteger(this.attempts) || this.attempts < 1)
      throw new Error("Transaction attempts must be positive");
  }
  options;
  attempts;
  async read() {
    const snapshot = await this.options.backend.read();
    return this.options.parse(snapshot ? snapshot.state : this.options.initial());
  }
  async transact(operation) {
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      const snapshot = await this.options.backend.read();
      const state = this.options.parse(structuredClone(snapshot ? snapshot.state : this.options.initial()));
      const result = operation(state);
      if (result instanceof Promise) throw new Error("State transaction callbacks must be synchronous");
      const detachedResult = structuredClone(result);
      const next = { revision: crypto.randomUUID(), state: this.options.parse(state) };
      if (await this.options.backend.compareAndSwap(snapshot?.revision ?? null, next)) return detachedResult;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, 5 * (attempt + 1))));
    }
    throw new Error("State transaction conflicted with concurrent updates");
  }
};

exports.OptimisticStateStore = OptimisticStateStore;
