import { interruptibleStream } from './chunk-HDHO73O7.js';
import { spawn } from 'child_process';
import { StringDecoder } from 'string_decoder';
import { pipeline } from 'stream/promises';

var ProcessExecutionError = class extends Error {
  constructor(code, exitCode = null, options) {
    super(`Agent process ${code}`, options);
    this.code = code;
    this.exitCode = exitCode;
  }
  code;
  exitCode;
  /** Caller-visible diagnostics. Excluded from message and routine telemetry. */
  diagnostics;
  /** Validated supervisor reason codes, without provider content or transport diagnostics. */
  remoteFailureCodes;
};
function stop(child) {
  if (child.pid && process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ESRCH") throw error;
    }
    return;
  }
  child.kill("SIGKILL");
}
async function finishProcess(child, closed, isClosed, terminate) {
  let timer;
  try {
    if (child && !isClosed()) terminate();
    await Promise.race([
      closed,
      new Promise((resolve) => {
        timer = setTimeout(resolve, 1e3);
      })
    ]);
    if (child && !isClosed()) {
      child.stdin?.destroy();
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
      throw new ProcessExecutionError("cleanup_failed");
    }
  } finally {
    clearTimeout(timer);
  }
}
async function finishInput(feeding) {
  if (!feeding) return;
  let timer;
  try {
    await Promise.race([
      feeding,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ProcessExecutionError("cleanup_failed")), 1e3);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
var ProcessRunner = class {
  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent;
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1)
      throw new Error("Process concurrency must be positive");
  }
  maxConcurrent;
  active = 0;
  stream(request) {
    return interruptibleStream((signal) => this.decode({ ...request, signal }), {
      signal: request.signal,
      isCleanupError: (error) => error instanceof ProcessExecutionError && error.code === "cleanup_failed"
    });
  }
  streamBytes(request) {
    return interruptibleStream((signal) => this.run({ ...request, signal }, true), {
      signal: request.signal,
      isCleanupError: (error) => error instanceof ProcessExecutionError && error.code === "cleanup_failed"
    });
  }
  async *decode(request) {
    const decoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
    let failure;
    try {
      for await (const chunk of this.run(request, false)) {
        const text = decoders[chunk.channel].write(Buffer.from(chunk.bytes));
        if (text) yield { channel: chunk.channel, text };
      }
    } catch (error) {
      if (!(error instanceof ProcessExecutionError && error.code === "exit_failed")) throw error;
      failure = error;
    }
    for (const channel of ["stdout", "stderr"]) {
      const text = decoders[channel].end();
      if (text) yield { channel, text };
    }
    if (failure) throw failure;
  }
  async *run(request, binary) {
    const timeout = request.timeoutMs === void 0 ? 6e5 : request.timeoutMs;
    const maximum = request.maxOutputBytes === void 0 ? 16 * 1024 * 1024 : request.maxOutputBytes;
    const channelMaximum = request.maxOutputBytesPerChannel ?? maximum;
    const highWater = request.maxBufferedBytes ?? 1024 * 1024;
    if (!binary && maximum === null || ![
      ...timeout === null ? [] : [timeout],
      ...maximum === null ? [] : [maximum],
      ...channelMaximum === null ? [] : [channelMaximum],
      highWater
    ].every((value) => Number.isSafeInteger(value) && value > 0) || !request.command)
      throw new Error("Invalid process request");
    if (request.input !== void 0 && request.inputStream)
      throw new Error("Choose buffered or streamed process input");
    request.signal?.throwIfAborted();
    if (this.active >= this.maxConcurrent) throw new ProcessExecutionError("busy");
    this.active++;
    const controller = new AbortController();
    const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
    const queue = [];
    let queuedBytes = 0;
    let wake;
    let child;
    let closed;
    let done = false;
    let terminated = false;
    let failure;
    let bytes = 0;
    const channelBytes = { stdout: 0, stderr: 0 };
    const inputController = new AbortController();
    let feeding;
    let inputSource;
    let inputFailure;
    const timer = timeout === null ? void 0 : setTimeout(() => controller.abort(new Error("Agent process timed out")), timeout);
    const notify = () => {
      wake?.();
      wake = void 0;
    };
    const terminate = () => {
      if (!child || terminated) return;
      terminated = true;
      child.stdout?.resume();
      child.stderr?.resume();
      try {
        stop(child);
      } catch (error) {
        failure = new ProcessExecutionError("cleanup_failed", null, { cause: error });
      }
    };
    const abort = () => {
      failure = signal.reason;
      terminate();
      notify();
    };
    try {
      child = spawn(request.command, [...request.args], {
        cwd: request.cwd,
        env: { ...request.environment },
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"]
      });
      const output = child;
      closed = new Promise((resolve) => {
        output.once("error", (error) => {
          failure = new ProcessExecutionError("start_failed", null, { cause: error });
          notify();
        });
        output.once("close", (code) => {
          clearTimeout(timer);
          if (code !== 0 && !failure) failure = new ProcessExecutionError("exit_failed", code);
          done = true;
          notify();
          resolve();
        });
      });
      for (const channel of ["stdout", "stderr"]) {
        output[channel]?.on("data", (chunk) => {
          if (signal.aborted || terminated) return;
          if (maximum !== null) bytes += chunk.length;
          if (channelMaximum !== null) channelBytes[channel] += chunk.length;
          if (maximum !== null && bytes > maximum || channelMaximum !== null && channelBytes[channel] > channelMaximum) {
            controller.abort(new ProcessExecutionError("output_limit"));
            return;
          }
          queue.push({ channel, bytes: Uint8Array.from(chunk) });
          queuedBytes += chunk.length;
          if (binary && queuedBytes >= highWater) {
            output.stdout?.pause();
            output.stderr?.pause();
          }
          notify();
        });
      }
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      output.stdin?.on("error", (error) => {
        if (error.code !== "EPIPE") {
          failure = error;
          controller.abort(error);
        }
      });
      if (request.inputStream && output.stdin) {
        inputSource = request.inputStream();
        feeding = pipeline(inputSource, output.stdin, {
          signal: inputController.signal,
          end: !request.keepInputOpen
        }).catch((error) => {
          if (inputController.signal.aborted) return;
          inputFailure = error;
          controller.abort(error);
        });
      } else if (request.keepInputOpen) {
        if (request.input !== void 0) output.stdin?.write(request.input);
      } else output.stdin?.end(request.input);
      while (true) {
        if (failure && !(failure instanceof ProcessExecutionError && failure.code === "exit_failed"))
          throw failure;
        const chunk = queue.shift();
        if (chunk) {
          queuedBytes -= chunk.bytes.byteLength;
          if (binary && queuedBytes < highWater / 2) {
            output.stdout?.resume();
            output.stderr?.resume();
          }
          yield chunk;
          continue;
        }
        if (done) {
          if (failure) throw failure;
          await finishInput(feeding);
          if (inputFailure) throw inputFailure;
          break;
        }
        await new Promise((resolve) => {
          wake = resolve;
        });
      }
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      inputController.abort();
      inputSource?.destroy();
      try {
        await finishProcess(child, closed, () => done, terminate);
      } finally {
        try {
          await finishInput(feeding);
        } finally {
          this.active--;
        }
      }
    }
  }
  async execute(request) {
    const result = { stdout: "", stderr: "" };
    try {
      for await (const chunk of this.stream(request)) result[chunk.channel] += chunk.text;
    } catch (error) {
      if (error instanceof ProcessExecutionError) error.diagnostics = result;
      throw error;
    }
    return result;
  }
};

export { ProcessExecutionError, ProcessRunner };
