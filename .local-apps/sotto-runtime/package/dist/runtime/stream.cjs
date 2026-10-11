'use strict';

// src/runtime/process/abort.ts
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}

// src/runtime/process/response.ts
var ResponseBodyTooLargeError = class extends Error {
  constructor(maxBytes) {
    super("Response body exceeds the allowed size");
    this.maxBytes = maxBytes;
    this.name = "ResponseBodyTooLargeError";
  }
  maxBytes;
};
async function cancelFailedRead(cancel, error) {
  let cleanupFailure;
  try {
    await abortable(cancel(), AbortSignal.timeout(1e3));
  } catch (cleanup) {
    cleanupFailure = { error: cleanup };
  }
  if (cleanupFailure)
    throw new AggregateError([error, cleanupFailure.error], "Response read and cleanup failed", {
      cause: error
    });
  throw error;
}
async function consumeResponse(response, options, append, finish) {
  const { signal, maxBytes } = options;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("Invalid response body limit");
  if (signal.aborted)
    return cancelFailedRead(() => response.body?.cancel(signal.reason) ?? Promise.resolve(), signal.reason);
  const reader = response.body?.getReader();
  if (!reader) return finish();
  let length = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await abortable(reader.read(), signal);
      signal.throwIfAborted();
      if (chunk.done) break;
      if (chunk.value.byteLength > maxBytes - length) throw new ResponseBodyTooLargeError(maxBytes);
      length += chunk.value.byteLength;
      append(chunk.value);
    }
    return finish();
  } catch (error) {
    return await cancelFailedRead(() => reader.cancel(error), error);
  } finally {
    reader.releaseLock();
  }
}
function readResponseText(response, options) {
  const decoder = new TextDecoder();
  const parts = [];
  return consumeResponse(
    response,
    options,
    (chunk) => parts.push(decoder.decode(chunk, { stream: true })),
    () => {
      parts.push(decoder.decode());
      return parts.join("");
    }
  );
}
function readResponseBytes(response, options) {
  const chunks = [];
  let length = 0;
  return consumeResponse(
    response,
    options,
    (chunk) => {
      chunks.push(Uint8Array.from(chunk));
      length += chunk.byteLength;
    },
    () => {
      const result = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return result;
    }
  );
}

// src/runtime/process/stream.ts
function interruptibleStream(open, options) {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  async function* owned() {
    signal.throwIfAborted();
    yield* open(signal);
  }
  const iterator = owned();
  const hasCleanup = (error, seen = /* @__PURE__ */ new Set()) => {
    if (seen.has(error)) return false;
    seen.add(error);
    return options.isCleanupError(error) || error instanceof AggregateError && error.errors.some((nested) => hasCleanup(nested, seen)) || error instanceof Error && error.cause !== void 0 && hasCleanup(error.cause, seen);
  };
  let cleanupFailure;
  const next = iterator.next.bind(iterator);
  const close = iterator.return.bind(iterator);
  const fail = iterator.throw.bind(iterator);
  iterator.next = (...args) => next(...args).catch((error) => {
    if (hasCleanup(error)) cleanupFailure = error;
    throw error;
  });
  iterator.return = async (value) => {
    controller.abort();
    const result = await close(value);
    if (cleanupFailure) throw cleanupFailure;
    return result;
  };
  iterator.throw = async (error) => {
    controller.abort(error);
    try {
      return await fail(error);
    } catch (failure) {
      const cleanup = cleanupFailure ?? (hasCleanup(failure) ? failure : void 0);
      if (cleanup && cleanup !== error)
        throw new AggregateError([error, cleanup], "Stream interruption and cleanup failed", {
          cause: failure
        });
      throw failure;
    }
  };
  return iterator;
}
function guardStream(source, guard) {
  const reader = source.getReader();
  let cancelled = false;
  let disposal;
  function validate() {
    const result = guard.validate();
    if (result !== void 0) {
      void Promise.resolve(result).catch(() => void 0);
      throw new TypeError("Stream validation must be synchronous and return undefined");
    }
  }
  function dispose(cancel, reason) {
    disposal ??= (async () => {
      try {
        if (cancel) await reader.cancel(reason);
      } finally {
        try {
          reader.releaseLock();
        } finally {
          await guard.release();
        }
      }
    })();
    return disposal;
  }
  return new ReadableStream(
    {
      async pull(controller) {
        try {
          validate();
          const result = await reader.read();
          if (cancelled) return;
          validate();
          if (result.done) {
            await dispose(false);
            if (!cancelled) controller.close();
            return;
          }
          controller.enqueue(result.value);
        } catch (error) {
          if (cancelled) return;
          let failure = error;
          try {
            await dispose(true, error);
          } catch (cleanupError) {
            failure = new AggregateError([error, cleanupError], "Stream validation or cleanup failed");
          }
          if (!cancelled) controller.error(failure);
        }
      },
      async cancel(reason) {
        cancelled = true;
        await dispose(true, reason);
      }
    },
    { highWaterMark: 0 }
  );
}

exports.ResponseBodyTooLargeError = ResponseBodyTooLargeError;
exports.abortable = abortable;
exports.guardStream = guardStream;
exports.interruptibleStream = interruptibleStream;
exports.readResponseBytes = readResponseBytes;
exports.readResponseText = readResponseText;
