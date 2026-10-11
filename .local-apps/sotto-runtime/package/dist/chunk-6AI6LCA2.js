import { randomUUID } from 'crypto';
import { setTimeout as setTimeout$1 } from 'timers/promises';

// src/runtime/sync/semaphore.ts

// src/runtime/sync/semaphore-connection.ts
async function bounded(operation, ms) {
  let timer;
  try {
    return await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Redis session deadline exceeded")), ms);
      operation.then(resolve, reject);
    });
  } finally {
    clearTimeout(timer);
  }
}
async function openSemaphoreSession(client, options) {
  const { connectMs, commandMs, closeMs } = options;
  for (const value of [connectMs, commandMs, closeMs]) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 6e4)
      throw new Error("Invalid Redis session deadline");
  }
  const connect = client.connect.bind(client);
  const end = client.end.bind(client);
  const evaluate = client.eval.bind(client);
  let failure;
  let closing;
  let releaseConfirmed = false;
  const poison = (error) => {
    failure ??= error;
  };
  async function close() {
    poison(new Error("Redis session is closing"));
    closing ??= connecting.catch(() => void 0).then(end).then(() => {
      removeError();
      removeEnd();
    });
    await bounded(closing, closeMs);
  }
  const lease = new RedisSemaphoreLease(
    {
      async eval(script2, keys, args) {
        if (failure) throw failure;
        try {
          const result = await bounded(
            Promise.resolve().then(() => {
              if (failure) throw failure;
              return evaluate(script2, keys, args);
            }),
            commandMs
          );
          if (failure) throw failure;
          if (args[1] === "release" && result === 1) releaseConfirmed = true;
          return result;
        } catch (error) {
          poison(error instanceof Error ? error : new Error("Redis command failed", { cause: error }));
          try {
            await close();
          } catch (cleanup) {
            throw new SemaphoreCleanupError(lease.key, lease.token, [error, cleanup], { cause: error });
          }
          throw error;
        }
      }
    },
    options
  );
  const removeError = client.onError(poison);
  const removeEnd = client.onEnd(() => poison(new Error("Redis session ended")));
  const connecting = Promise.resolve().then(connect);
  async function release() {
    const errors = [];
    if (!releaseConfirmed) {
      try {
        await lease.release();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new SemaphoreCleanupError(lease.key, lease.token, errors, { cause: errors[0] });
  }
  try {
    await bounded(connecting, connectMs);
    if (failure) throw failure;
  } catch (error) {
    try {
      await close();
    } catch (cleanup) {
      throw new SemaphoreCleanupError(lease.key, lease.token, [error, cleanup], { cause: error });
    }
    throw error;
  }
  return {
    token: lease.token,
    key: lease.key,
    acquire: () => lease.acquire(),
    inspect: () => lease.inspect(),
    renew: () => lease.renew(),
    release,
    async wait(waitOptions) {
      try {
        const acquired = await waitForSemaphore(lease, waitOptions);
        if (!acquired) await close();
        return acquired;
      } catch (error) {
        try {
          await close();
        } catch (cleanup) {
          throw new SemaphoreCleanupError(lease.key, lease.token, [error, cleanup], { cause: error });
        }
        throw error;
      }
    }
  };
}

// src/runtime/sync/semaphore.ts
var script = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local token = ARGV[1]
local operation = ARGV[2]
if operation == 'release' then
  redis.call('ZREM', KEYS[1], token)
  return 1
end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local existing = redis.call('ZSCORE', KEYS[1], token)
if operation == 'inspect' then return existing and tonumber(existing) or 0 end
if operation == 'acquire' and existing then return tonumber(existing) end
if operation == 'renew' and not existing then return 0 end
if operation == 'acquire' and redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
local expires = now + tonumber(ARGV[4])
redis.call('ZADD', KEYS[1], expires, token)
local latest = redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')
redis.call('PEXPIREAT', KEYS[1], latest[2])
return expires
`;
var SemaphoreOperationError = class extends Error {
  constructor(operation, key, token, options) {
    super(`Semaphore ${operation} outcome is unknown`, options);
    this.operation = operation;
    this.key = key;
    this.token = token;
    this.name = "SemaphoreOperationError";
  }
  operation;
  key;
  token;
};
var SemaphoreCleanupError = class extends AggregateError {
  constructor(key, token, errors, options) {
    super(errors, "Semaphore release could not be confirmed", options);
    this.key = key;
    this.token = token;
    this.name = "SemaphoreCleanupError";
  }
  key;
  token;
};
var RedisSemaphoreLease = class {
  token;
  key;
  #redis;
  #limit;
  #ttlMs;
  #released = false;
  #tail = Promise.resolve();
  constructor(redis, options) {
    if (!options.namespace || !options.resource)
      throw new Error("Semaphore namespace and resource are required");
    if (!Number.isSafeInteger(options.limit) || options.limit < 1)
      throw new Error("Semaphore capacity must be a positive integer");
    if (!Number.isSafeInteger(options.ttlMs) || options.ttlMs < 1 || options.ttlMs > 864e5)
      throw new Error("Semaphore lifetime must be between one millisecond and one day");
    const token = options.token ?? randomUUID();
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(token)) throw new Error("Invalid semaphore token");
    this.token = token;
    this.key = `${options.namespace}:semaphore:v1:${Buffer.from(options.resource).toString("base64url")}`;
    this.#redis = { eval: redis.eval.bind(redis) };
    this.#limit = options.limit;
    this.#ttlMs = options.ttlMs;
  }
  #execute(operation) {
    const run = this.#tail.then(async () => {
      if (this.#released && operation !== "release" && operation !== "inspect")
        throw new Error("Released semaphore tokens cannot be acquired or renewed");
      if (operation === "release") this.#released = true;
      try {
        const result = await this.#redis.eval(
          script,
          [this.key],
          [this.token, operation, String(this.#limit), String(this.#ttlMs)]
        );
        if (typeof result !== "number" || !Number.isSafeInteger(result) || result < 0)
          throw new Error("Invalid Redis semaphore response");
        if (operation === "release" && result !== 1)
          throw new Error("Invalid Redis semaphore release acknowledgement");
        return result;
      } catch (error) {
        throw new SemaphoreOperationError(operation, this.key, this.token, { cause: error });
      }
    });
    this.#tail = run.catch(() => void 0);
    return run;
  }
  /** A rejected response can be reconciled by repeating this call with this same token. */
  async acquire() {
    return await this.#execute("acquire") > 0;
  }
  async renew() {
    return await this.#execute("renew") > 0;
  }
  async inspect() {
    const expiresAt = await this.#execute("inspect");
    return expiresAt === 0 ? null : { expiresAt };
  }
  /** Repeat after an unknown response. It can never release another token's slot. */
  async release() {
    await this.#execute("release");
  }
};
async function waitForSemaphore(lease, options) {
  const { signal, shouldStop } = options;
  const delaysMs = [...options.delaysMs];
  try {
    if (delaysMs.some((value) => !Number.isSafeInteger(value) || value < 0))
      throw new Error("Invalid semaphore retry delay");
    for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
      signal?.throwIfAborted();
      if (shouldStop && await shouldStop()) {
        await lease.release();
        return false;
      }
      signal?.throwIfAborted();
      const acquired = await lease.acquire();
      signal?.throwIfAborted();
      if (acquired) return true;
      if (attempt < delaysMs.length) await setTimeout$1(delaysMs[attempt], void 0, { signal });
    }
    await lease.release();
    return false;
  } catch (error) {
    try {
      await lease.release();
    } catch (cleanup) {
      throw new SemaphoreCleanupError(lease.key, lease.token, [error, cleanup], { cause: error });
    }
    throw error;
  }
}

export { RedisSemaphoreLease, SemaphoreCleanupError, SemaphoreOperationError, openSemaphoreSession, waitForSemaphore };
