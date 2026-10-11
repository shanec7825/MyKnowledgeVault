'use strict';

var crypto = require('crypto');
var promises = require('fs/promises');
var path = require('path');
var child_process = require('child_process');
var string_decoder = require('string_decoder');
var promises$1 = require('stream/promises');

// src/runtime/isolated.ts

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

// src/runtime/process/process.ts
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
    const decoders = { stdout: new string_decoder.StringDecoder("utf8"), stderr: new string_decoder.StringDecoder("utf8") };
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
      child = child_process.spawn(request.command, [...request.args], {
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
        feeding = promises$1.pipeline(inputSource, output.stdin, {
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

// src/runtime/isolated.ts
var IsolatedCleanupError = class extends Error {
  constructor(identity) {
    super("Isolated execution cleanup could not be verified");
    this.identity = identity;
    this.name = "IsolatedCleanupError";
  }
  identity;
};
var DockerIsolatedRunner = class {
  constructor(dockerCommand = "docker") {
    this.dockerCommand = dockerCommand;
  }
  dockerCommand;
  processRunner = new ProcessRunner();
  async docker(args, signal) {
    let output = "";
    for await (const chunk of this.processRunner.stream({
      command: this.dockerCommand,
      args,
      environment: this.environment(),
      signal,
      timeoutMs: 15e3,
      maxOutputBytes: 64 * 1024
    }))
      if (chunk.channel === "stdout") output += chunk.text;
    return output.trim();
  }
  environment() {
    return { PATH: process.env.PATH, HOME: process.env.HOME };
  }
  async reconcile(identity) {
    if (!/^sidedoor-[a-f0-9-]{36}$/.test(identity.containerName))
      throw new TypeError("Invalid container identity");
    try {
      if (await this.docker(["info", "--format", "{{.ID}}"]) !== identity.daemonId)
        throw new Error("Docker daemon identity changed");
      const listed = await this.docker(["ps", "-aq", "--filter", `name=^/${identity.containerName}$`]);
      if (!listed) return;
      const owner = await this.docker([
        "inspect",
        "--format",
        '{{index .Config.Labels "sidedoor.execution"}}',
        identity.containerName
      ]);
      if (owner !== identity.executionId) throw new Error("Container ownership mismatch");
      await this.docker(["rm", "--force", identity.containerName]);
      if (await this.docker(["ps", "-aq", "--filter", `name=^/${identity.containerName}$`]))
        throw new Error("Container remains");
    } catch {
      throw new IsolatedCleanupError(identity);
    }
  }
  stream(request) {
    request = { ...request, command: [...request.command] };
    return interruptibleStream((signal) => this.execute({ ...request, signal }), {
      signal: request.signal,
      isCleanupError: (error) => error instanceof IsolatedCleanupError
    });
  }
  async *execute(request) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(request.image))
      throw new TypeError("An immutable image digest is required");
    if (!request.executionId || request.executionId.length > 200 || [...request.executionId].some((character) => character.charCodeAt(0) < 32))
      throw new TypeError("Invalid execution identity");
    for (const value of [
      request.timeoutMs,
      request.maxOutputBytes,
      request.memoryMb,
      request.pids,
      request.scratchMb
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0)
        throw new TypeError("Positive integer resource limits are required");
    }
    if (!Number.isFinite(request.cpus) || request.cpus <= 0)
      throw new TypeError("Positive CPU limit required");
    if (!request.command.length || request.command.some((value) => value.includes("\0")))
      throw new TypeError("Invalid command");
    const mounts = [];
    if (request.brokerDirectory) {
      if (process.platform !== "linux") throw new Error("Broker mounts require a local Linux Docker host");
      const endpoint = await this.docker(
        ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
        request.signal
      );
      if (!endpoint.startsWith("unix:///"))
        throw new Error("Broker mounts require a local Unix Docker endpoint");
      const directory = request.brokerDirectory;
      if (!path.isAbsolute(directory) || directory.includes(",") || !(await promises.lstat(directory)).isDirectory())
        throw new TypeError("Invalid broker directory");
      const entries = await promises.readdir(directory);
      if (entries.length !== 1 || entries[0] !== "broker.sock" || !(await promises.lstat(path.join(directory, "broker.sock"))).isSocket())
        throw new TypeError("Broker directory must contain only broker.sock");
      mounts.push("--mount", `type=bind,src=${directory},dst=/broker,readonly`);
    }
    if (await this.docker(["info", "--format", "{{.OSType}}"], request.signal) !== "linux")
      throw new Error("A Linux Docker engine is required");
    const volumes = await this.docker(
      ["image", "inspect", "--format", "{{json .Config.Volumes}}", request.image],
      request.signal
    );
    if (volumes !== "null" && volumes !== "{}") throw new Error("Isolated images cannot declare volumes");
    const daemonId = await this.docker(["info", "--format", "{{.ID}}"], request.signal);
    if (!daemonId) throw new Error("Docker daemon identity is unavailable");
    const identity = {
      executionId: request.executionId,
      containerName: `sidedoor-${crypto.randomUUID()}`,
      daemonId
    };
    await request.recordIdentity(identity);
    let created = false;
    try {
      request.signal?.throwIfAborted();
      await this.docker([
        "create",
        "--pull=never",
        "--name",
        identity.containerName,
        "--label",
        `sidedoor.execution=${identity.executionId}`,
        "--network=none",
        "--user=65532:65532",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit",
        String(request.pids),
        "--memory",
        `${request.memoryMb}m`,
        "--memory-swap",
        `${request.memoryMb}m`,
        "--cpus",
        String(request.cpus),
        "--ulimit",
        "nofile=128:128",
        "--ipc=none",
        "--log-driver=none",
        "--tmpfs",
        `/work:rw,noexec,nosuid,nodev,size=${request.scratchMb}m,uid=65532,gid=65532,mode=700`,
        "--tmpfs",
        "/tmp:rw,noexec,nosuid,nodev,size=16m,uid=65532,gid=65532,mode=700",
        "--env",
        "HOME=/work",
        "--workdir=/work",
        "--interactive",
        ...mounts,
        "--entrypoint",
        request.command[0],
        request.image,
        ...request.command.slice(1)
      ]);
      created = true;
      yield* this.processRunner.stream({
        command: this.dockerCommand,
        args: ["start", "--attach", "--interactive", identity.containerName],
        environment: this.environment(),
        input: request.input,
        signal: request.signal,
        timeoutMs: request.timeoutMs,
        maxOutputBytes: request.maxOutputBytes
      });
      const exit = await this.docker(
        ["inspect", "--format", "{{.State.ExitCode}}", identity.containerName],
        request.signal
      );
      if (exit !== "0")
        throw new Error(`Isolated execution failed with exit code ${/^\d+$/.test(exit) ? exit : "unknown"}`);
    } finally {
      await this.reconcile(identity);
      await this.verifyCreation(created, identity);
      await this.recordCleanup(request, identity);
    }
  }
  async verifyCreation(created, identity) {
    if (!created) throw new IsolatedCleanupError(identity);
  }
  async recordCleanup(request, identity) {
    try {
      await request.recordCleanup(identity);
    } catch {
      throw new IsolatedCleanupError(identity);
    }
  }
};

exports.DockerIsolatedRunner = DockerIsolatedRunner;
exports.IsolatedCleanupError = IsolatedCleanupError;
