import { ProcessRunner } from './chunk-CLWMTL22.js';
import { interruptibleStream } from './chunk-HDHO73O7.js';
import { randomUUID } from 'crypto';
import { lstat, readdir } from 'fs/promises';
import { isAbsolute, join } from 'path';

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
      if (!isAbsolute(directory) || directory.includes(",") || !(await lstat(directory)).isDirectory())
        throw new TypeError("Invalid broker directory");
      const entries = await readdir(directory);
      if (entries.length !== 1 || entries[0] !== "broker.sock" || !(await lstat(join(directory, "broker.sock"))).isSocket())
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
      containerName: `sidedoor-${randomUUID()}`,
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

export { DockerIsolatedRunner, IsolatedCleanupError };
