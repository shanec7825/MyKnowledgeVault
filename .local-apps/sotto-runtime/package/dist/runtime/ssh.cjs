'use strict';

var fs = require('fs');
var promises = require('fs/promises');
var path$1 = require('path');
var stream = require('stream');
var crypto = require('crypto');
var os = require('os');
var zod = require('zod');
var child_process = require('child_process');
var string_decoder = require('string_decoder');
var promises$1 = require('stream/promises');
var perf_hooks = require('perf_hooks');

// src/runtime/process/environment.ts
function shellQuote(value) {
  if (value.includes("\0")) throw new Error("Shell arguments cannot contain null bytes");
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function agentInvocation(command, args, connection2) {
  if (!connection2) return { command, args: [...args] };
  if (!/^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*@)?[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(connection2.host))
    throw new Error("Invalid SSH host");
  const options = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes"];
  const pin = connection2.pinnedIdentity;
  if (pin) {
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/.test(pin.user) || !/^sidedoor-[a-f0-9]{32}$/.test(pin.alias) || ![
      "ssh-ed25519",
      "ecdsa-sha2-nistp256",
      "ecdsa-sha2-nistp384",
      "ecdsa-sha2-nistp521",
      "rsa-sha2-512,rsa-sha2-256"
    ].includes(pin.algorithms) || !pin.knownHostsFile.startsWith("/") || /[\r\n\0]/.test(pin.knownHostsFile))
      throw new Error("Invalid pinned SSH identity");
    const explicitUser = connection2.host.includes("@") ? connection2.host.split("@")[0] : void 0;
    if (explicitUser !== void 0 && explicitUser !== pin.user) throw new Error("SSH account changed");
    options.push("-l", pin.user);
    for (const option of [
      `HostKeyAlias=${pin.alias}`,
      `UserKnownHostsFile=${JSON.stringify(pin.knownHostsFile.replace(/%/g, "%%"))}`,
      "GlobalKnownHostsFile=/dev/null",
      "KnownHostsCommand=none",
      "VerifyHostKeyDNS=no",
      "UpdateHostKeys=no",
      `HostKeyAlgorithms=${pin.algorithms}`,
      "CheckHostIP=no",
      "ControlMaster=no",
      "ControlPath=none",
      "ControlPersist=no",
      "CanonicalizeHostname=no",
      "ForwardAgent=no",
      "ForwardX11=no",
      "ClearAllForwardings=yes",
      "PermitLocalCommand=no",
      "RemoteCommand=none",
      "RequestTTY=no",
      "StdinNull=no",
      "ForkAfterAuthentication=no"
    ])
      options.push("-o", option);
  }
  if (connection2.identityFile) options.push("-i", connection2.identityFile);
  if (!pin && connection2.knownHostsFile)
    options.push("-o", `UserKnownHostsFile=${connection2.knownHostsFile}`);
  return {
    command: "ssh",
    args: [...options, "-T", "--", connection2.host, [command, ...args].map(shellQuote).join(" ")]
  };
}

// src/runtime/remote/remote-session.ts
var remoteSessionSupervisor = String.raw`
import base64, ctypes, errno, fcntl, hashlib, json, os, pwd, re, select, shutil, signal, stat, subprocess, sys, threading, time

child = None
operation = None
locked = False
deadline = time.monotonic() + 30
pending = bytearray()
exit_code = 1
owns_execution_marker = False

def interrupted(*args):
    raise RuntimeError('interrupted')

for event in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT, signal.SIGALRM):
    signal.signal(event, interrupted)
signal.alarm(30)

def cancelled():
    return operation is not None and os.path.exists(os.path.join(operation, 'cancelled'))

def check():
    if time.monotonic() >= deadline: raise RuntimeError('timeout')
    if cancelled(): raise RuntimeError('cancelled')

def read_bytes(count):
    while len(pending) < count:
        check()
        ready, _, _ = select.select([0], [], [], 0.1)
        if not ready: continue
        chunk = os.read(0, min(65536, count - len(pending)))
        if not chunk: raise RuntimeError('incomplete_input')
        pending.extend(chunk)
    result = bytes(pending[:count])
    del pending[:count]
    return result

def header():
    while True:
        position = pending.find(b'\n')
        if position >= 0:
            if position >= 32 * 1024 * 1024: raise RuntimeError('invalid_manifest')
            result = bytes(pending[:position])
            del pending[:position + 1]
            return json.loads(result)
        if len(pending) >= 32 * 1024 * 1024: raise RuntimeError('invalid_manifest')
        check()
        ready, _, _ = select.select([0], [], [], 0.1)
        if not ready: continue
        chunk = os.read(0, 65536)
        if not chunk: raise RuntimeError('incomplete_input')
        pending.extend(chunk)

def emit(value):
    data = memoryview((json.dumps(value, separators=(',', ':')) + '\n').encode())
    until = time.monotonic() + 5
    while data:
        if time.monotonic() >= until: raise RuntimeError('output_disconnected')
        _, ready, _ = select.select([], [1], [], 0.1)
        if not ready: continue
        try: data = data[os.write(1, data):]
        except BlockingIOError: pass

def private_directory(path):
    missing = []
    current = path
    while not os.path.lexists(current):
        missing.append(current)
        current = os.path.dirname(current)
    for current in reversed(missing):
        try: os.mkdir(current, 0o700)
        except FileExistsError: pass
        sync_directory(os.path.dirname(current))
    info = os.lstat(path)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise RuntimeError('unsafe_operation_directory')

def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)

def fence():
    path = os.path.join(operation, 'cancelled')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try: os.fsync(fd)
    finally: os.close(fd)
    sync_directory(operation)

def terminate_group():
    if child is None: return
    try: os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError: pass
    child.wait(timeout=5)
    until = time.monotonic() + 5
    while True:
        if sys.platform.startswith('linux'):
            try:
                while os.waitpid(-1, os.WNOHANG)[0]: pass
            except ChildProcessError: pass
            with open('/proc/self/task/' + str(os.getpid()) + '/children') as children:
                adopted = [int(pid) for pid in children.read().split()]
            for pid in adopted:
                try: os.kill(pid, signal.SIGKILL)
                except ProcessLookupError: pass
            if not adopted: return
            if time.monotonic() >= until: raise RuntimeError('cleanup_failed')
            time.sleep(0.01)
            continue
        try: os.killpg(child.pid, 0)
        except ProcessLookupError: return
        if time.monotonic() >= until: raise RuntimeError('cleanup_failed')
        time.sleep(0.01)

os.set_blocking(1, False)
try:
    manifest = header()
    identifier = manifest['operationId']
    if not isinstance(identifier, str) or re.fullmatch('[a-f0-9]{32}', identifier) is None:
        raise RuntimeError('invalid_manifest')
    timeout = manifest['timeoutMs']
    if type(timeout) is not int or timeout < 1 or timeout > 86400000: raise RuntimeError('invalid_manifest')
    deadline = time.monotonic() + timeout / 1000
    signal.alarm(0)
    root = manifest.get('operationRoot') or os.path.expanduser('~/.local/state/thesidedoor/remote-operations')
    if not os.path.isabs(root): raise RuntimeError('invalid_manifest')
    root = os.path.normpath(root)
    remote_user = pwd.getpwuid(os.getuid()).pw_name
    if manifest.get('remoteUser', remote_user) != remote_user: raise RuntimeError('remote_identity_mismatch')
    private_directory(root)
    operation = os.path.join(root, identifier)
    private_directory(operation)
    sync_directory(root)
    recovery = manifest.get('recover') is True
    if recovery: fence()
    lock = os.open(os.path.join(operation, 'lock'), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    while True:
        if time.monotonic() >= deadline: raise RuntimeError('timeout')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            locked = True
            break
        except BlockingIOError: time.sleep(0.05)
    data_directory = os.path.join(operation, 'data')
    if recovery:
        exit_code = 0
    else:
        check()
        marker = os.open(os.path.join(operation, 'started'), os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        try: os.fsync(marker)
        finally: os.close(marker)
        sync_directory(operation)
        check()
        os.mkdir(data_directory, 0o700)
        paths = []
        for index, entry in enumerate(manifest['files']):
            check()
            size = entry['size']
            extension = entry['extension']
            expected_hash = entry['sha256']
            if not isinstance(expected_hash, str) or re.fullmatch('[a-f0-9]{64}', expected_hash) is None:
                raise RuntimeError('invalid_manifest')
            digest = hashlib.sha256()
            if type(size) is not int or size < 0 or size > 9007199254740991: raise RuntimeError('invalid_manifest')
            if not isinstance(extension, str) or re.fullmatch('[.a-zA-Z0-9]{0,20}', extension) is None:
                raise RuntimeError('invalid_manifest')
            path = os.path.join(data_directory, str(index) + extension)
            check()
            with open(path, 'xb') as destination:
                while size:
                    chunk = read_bytes(min(size, 65536))
                    destination.write(chunk)
                    digest.update(chunk)
                    size -= len(chunk)
            if digest.hexdigest() != expected_hash: raise RuntimeError('attachment_changed')
            paths.append(path)
        if pending: raise RuntimeError('unexpected_input')
        argv = []
        for argument in manifest['argv']:
            if isinstance(argument, str): argv.append(argument)
            elif isinstance(argument, dict) and type(argument.get('file')) is int and 0 <= argument['file'] < len(paths):
                argv.append(paths[argument['file']])
            else: raise RuntimeError('invalid_manifest')
        environment = {key: os.environ[key] for key in manifest['environmentKeys'] if key in os.environ}
        environment.update(manifest['environment'])
        prompt = base64.b64decode(manifest['input'], validate=True)
        if sys.platform.startswith('linux'):
            if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
                raise RuntimeError('supervision_unavailable')
        check()
        execution_marker = os.open(os.path.join(operation, 'execution-pending'), os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        try: os.fsync(execution_marker)
        finally: os.close(execution_marker)
        owns_execution_marker = True
        sync_directory(operation)
        check()
        child = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 start_new_session=True, env=environment)
        def feed():
            try:
                child.stdin.write(prompt)
                child.stdin.close()
            except BrokenPipeError: pass
        threading.Thread(target=feed, daemon=True).start()
        outputs = {child.stdout: 'stdout', child.stderr: 'stderr'}
        while outputs or child.poll() is None:
            check()
            if child.poll() is not None: terminate_group()
            ready, _, _ = select.select([0, *outputs], [], [], 0.1)
            for stream in ready:
                if stream == 0:
                    if not os.read(0, 1): raise RuntimeError('disconnected')
                    raise RuntimeError('unexpected_input')
                chunk = os.read(stream.fileno(), 16384)
                if chunk:
                    emit({'type': 'data', 'channel': outputs[stream], 'data': base64.b64encode(chunk).decode()})
                else:
                    del outputs[stream]
                    stream.close()
        exit_code = child.returncode if child.returncode >= 0 else 128 - child.returncode
except BaseException as error:
    try:
        code = str(error) if isinstance(error, RuntimeError) else 'remote_failed'
        emit({'type': 'failure', 'code': code})
    except BaseException: pass
finally:
    if locked:
        try:
            signal.alarm(15)
            fence()
            execution_marker = os.path.join(operation, 'execution-pending')
            if child is None and not owns_execution_marker and os.path.lexists(execution_marker):
                raise RuntimeError('cleanup_unconfirmed')
            terminate_group()
            if os.path.lexists(execution_marker): os.unlink(execution_marker)
            if os.path.lexists(os.path.join(operation, 'data')):
                shutil.rmtree(os.path.join(operation, 'data'))
            sync_directory(operation)
            emit({'type': 'cleaned', 'operationId': identifier, 'exitCode': exit_code,
                  'remoteUser': remote_user, 'operationRoot': root,
                  'containment': 'descendants' if sys.platform.startswith('linux') else 'process-group'})
        except BaseException:
            exit_code = 70
            try: emit({'type': 'failure', 'code': 'cleanup_failed'})
            except BaseException: pass
        finally:
            signal.alarm(0)
            os.close(lock)
sys.exit(exit_code)
`;

// src/runtime/remote/remote-requests.ts
var remoteSupervisor = `
import base64, json, os, select, signal, subprocess, sys, threading, time
child = None
terminated = False
def terminate(*args):
    global terminated
    if child is not None and not terminated:
        terminated = True
        try: os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError: pass
def interrupted(*args):
    terminate()
    sys.exit(125)
for event in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
    signal.signal(event, interrupted)
signal.signal(signal.SIGALRM, interrupted)
signal.alarm(30)
line = sys.stdin.buffer.readline(32 * 1024 * 1024 + 1)
if len(line) > 32 * 1024 * 1024 or not line.endswith(b'\\n'): sys.exit(126)
payload = json.loads(line)
timeout = payload['timeoutMs'] / 1000
if timeout <= 0 or timeout > 86400: sys.exit(126)
deadline = time.monotonic() + timeout
signal.alarm(0)
environment = {key: os.environ[key] for key in payload['environmentKeys'] if key in os.environ}
environment.update(payload['environment'])
try:
    child = subprocess.Popen(payload['argv'], stdin=subprocess.PIPE, start_new_session=True, env=environment)
    data = base64.b64decode(payload['input'], validate=True)
    def feed():
        try:
            child.stdin.write(data)
            child.stdin.close()
        except BrokenPipeError: pass
    threading.Thread(target=feed, daemon=True).start()
    while child.poll() is None:
        if time.monotonic() >= deadline:
            terminate()
            sys.exit(124)
        ready, _, _ = select.select([sys.stdin], [], [], 0.1)
        if ready and not os.read(sys.stdin.fileno(), 1):
            terminate()
            sys.exit(125)
    sys.exit(child.returncode if child.returncode >= 0 else 128 - child.returncode)
finally:
    terminate()
    if child is not None:
        try: child.wait(timeout=1)
        except subprocess.TimeoutExpired: pass
`;
function supervisedRemoteRequest(request) {
  const timeoutMs = request.timeoutMs ?? 6e5;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 864e5)
    throw new Error("Remote timeout must be between 1 ms and 24 hours");
  const payload = JSON.stringify({
    argv: [request.command, ...request.args],
    input: Buffer.from(request.input ?? "").toString("base64"),
    timeoutMs,
    environmentKeys: request.remoteEnvironmentKeys,
    environment: request.remoteEnvironment ?? {}
  }) + "\n";
  if (Buffer.byteLength(payload) > 32 * 1024 * 1024) throw new Error("Remote invocation is too large");
  const invocation = agentInvocation("python3", ["-c", remoteSupervisor], request.connection);
  return {
    ...invocation,
    input: payload,
    keepInputOpen: true,
    environment: request.transportEnvironment,
    timeoutMs: timeoutMs + 5e3,
    maxOutputBytes: request.maxOutputBytes,
    signal: request.signal
  };
}
function sessionIdentity(operationId, operationRoot) {
  if (!/^[a-f0-9]{32}$/.test(operationId)) throw new Error("Invalid remote operation identity");
  if (operationRoot !== void 0 && (!operationRoot.startsWith("/") || operationRoot.includes("\0")))
    throw new Error("Remote operation root must be absolute");
}
async function supervisedSessionRequest(request, remainingMs) {
  sessionIdentity(request.operationId, request.operationRoot);
  const base = supervisedRemoteRequest({ ...request, args: [] });
  const files = [];
  for (const path2 of request.files) {
    request.signal?.throwIfAborted();
    const info = await promises.stat(path2);
    if (!info.isFile() || !Number.isSafeInteger(info.size))
      throw new Error("Attachment must be a regular file");
    const extension = path$1.extname(path2);
    if (!/^[.a-zA-Z0-9]{0,20}$/.test(extension)) throw new Error("Invalid attachment extension");
    const hash = crypto.createHash("sha256");
    const source = fs.createReadStream(path2, { highWaterMark: 65536, signal: request.signal });
    let size = 0;
    try {
      for await (const chunk of source) {
        const bytes = chunk;
        size += bytes.length;
        hash.update(bytes);
      }
    } finally {
      source.destroy();
    }
    if (size !== info.size) throw new Error("Attachment changed during preparation");
    files.push({ size, extension, sha256: hash.digest("hex") });
  }
  for (const arg of request.args) {
    if (typeof arg === "string") continue;
    if (!Number.isSafeInteger(arg.file) || arg.file < 0 || arg.file >= files.length)
      throw new Error("Invalid attachment argument");
  }
  const payload = {
    operationId: request.operationId,
    operationRoot: request.operationRoot,
    remoteUser: request.remoteUser,
    timeoutMs: request.timeoutMs ?? 6e5,
    argv: [request.command, ...request.args],
    files,
    input: Buffer.from(request.input ?? "").toString("base64"),
    environmentKeys: request.remoteEnvironmentKeys,
    environment: request.remoteEnvironment ?? {}
  };
  const manifest = JSON.stringify(payload) + "\n";
  if (Buffer.byteLength(manifest) > 32 * 1024 * 1024) throw new Error("Remote manifest is too large");
  const invocation = agentInvocation("python3", ["-c", remoteSessionSupervisor], request.connection);
  return {
    ...base,
    ...invocation,
    input: void 0,
    inputStream: () => stream.Readable.from(
      (async function* () {
        const remaining = remainingMs?.() ?? payload.timeoutMs;
        if (!Number.isSafeInteger(remaining) || remaining < 1 || remaining > payload.timeoutMs)
          throw new Error("Remote operation deadline expired");
        yield Buffer.from(
          remainingMs ? JSON.stringify({ ...payload, timeoutMs: remaining }) + "\n" : manifest
        );
        for (let index = 0; index < request.files.length; index++) {
          const file = request.files[index];
          const expected = files[index].size;
          let received = 0;
          const source = fs.createReadStream(file, { highWaterMark: 65536 });
          try {
            for await (const chunk of source) {
              const bytes = chunk;
              received += bytes.length;
              if (received > expected) throw new Error("Attachment changed during upload");
              yield bytes;
            }
            if (received !== expected) throw new Error("Attachment changed during upload");
          } finally {
            source.destroy();
          }
        }
      })(),
      { objectMode: false, highWaterMark: 65536 }
    )
  };
}
function remoteRecoveryRequest(request) {
  sessionIdentity(request.operationId, request.operationRoot);
  return {
    ...agentInvocation("python3", ["-c", remoteSessionSupervisor], request.connection),
    input: JSON.stringify({
      operationId: request.operationId,
      operationRoot: request.operationRoot,
      remoteUser: request.remoteUser,
      timeoutMs: 3e4,
      recover: true
    }) + "\n",
    keepInputOpen: true,
    environment: request.transportEnvironment,
    timeoutMs: 45e3,
    signal: request.signal
  };
}
var identity = zod.z.string().regex(/^[a-f0-9]{32}$/);
var path = zod.z.string().min(1).max(4096).refine((value) => !value.includes("\0"));
var connection = zod.z.object({
  host: zod.z.string().min(1).max(1024),
  identityFile: path.optional(),
  knownHostsFile: path.optional()
}).strict().refine((value) => {
  try {
    agentInvocation("true", [], value);
    return true;
  } catch {
    return false;
  }
}, "Invalid SSH connection");
var remoteHostKeySchema = zod.z.object({
  algorithm: zod.z.enum([
    "ssh-ed25519",
    "ecdsa-sha2-nistp256",
    "ecdsa-sha2-nistp384",
    "ecdsa-sha2-nistp521",
    "ssh-rsa"
  ]),
  key: zod.z.string().min(16).max(16384).regex(/^[A-Za-z0-9+/]+={0,2}$/)
}).strict();
var reason = zod.z.enum(["transport_failed", "cleanup_failed", "protocol_failed", "insufficient_containment"]);
var binding = zod.z.object({
  connection,
  hostKey: remoteHostKeySchema,
  remoteUser: zod.z.string().regex(/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$/),
  operationRoot: path.refine((value) => value.startsWith("/") && path$1.posix.resolve(value) === value),
  consumer: zod.z.object({ id: zod.z.string().min(1).max(200), generation: zod.z.number().int().nonnegative() }).strict()
}).strict();
var record = binding.extend({
  operationId: identity,
  registrationToken: identity,
  createdAt: zod.z.number().int().nonnegative(),
  cancelAfter: zod.z.number().int().nonnegative(),
  status: zod.z.enum(["prepared", "active", "uncertain"]),
  reason: reason.optional()
}).strict().refine(
  (value) => value.cancelAfter > value.createdAt && (value.status === "uncertain" ? value.reason !== void 0 : value.reason === void 0)
);
var remoteJournalStateSchema = zod.z.object({
  version: zod.z.literal(1),
  operations: zod.z.array(record).max(1e5)
}).strict().refine(
  (value) => new Set(value.operations.map((item) => item.operationId)).size === value.operations.length,
  "Duplicate remote operation identity"
);
var initialRemoteJournalState = () => ({ version: 1, operations: [] });
var RemoteOperationJournal = class {
  constructor(options) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.maximum = options.maxPending ?? 1e4;
    if (!Number.isSafeInteger(this.maximum) || this.maximum < 1 || this.maximum > 1e5)
      throw new Error("Invalid remote operation capacity");
  }
  options;
  now;
  maximum;
  /** The runner must enforce this maximum lifetime, including upload and cleanup allowance. */
  async register(input) {
    const { maximumLifetimeMs, ...details } = input;
    if (!Number.isSafeInteger(maximumLifetimeMs) || maximumLifetimeMs < 1 || maximumLifetimeMs > 8646e4)
      throw new Error("Invalid remote operation lifetime");
    const createdAt = this.now();
    const prepared = record.parse({
      ...binding.parse(details),
      operationId: crypto.randomBytes(16).toString("hex"),
      registrationToken: crypto.randomBytes(16).toString("hex"),
      createdAt,
      cancelAfter: createdAt + maximumLifetimeMs,
      status: "prepared"
    });
    return this.options.store.transact((state) => {
      if (state.operations.length >= this.maximum)
        throw new Error("Unconfirmed remote operation capacity reached");
      if (state.operations.some((item) => item.operationId === prepared.operationId))
        throw new Error("Remote operation identity collision");
      state.operations.push(prepared);
      return prepared;
    });
  }
  async pending() {
    return structuredClone((await this.options.store.read()).operations);
  }
  async current(expected) {
    const current = this.match(await this.options.store.read(), expected);
    return current ? structuredClone(current) : void 0;
  }
  /** Persist before spawning SSH. An uncertain write result must prevent execution. */
  async connecting(expected) {
    await this.options.store.transact((state) => {
      const current = this.match(state, expected);
      if (!current || current.status !== "prepared")
        throw new Error("Remote execution was already admitted or cancelled");
      if (current.cancelAfter <= this.now()) throw new Error("Remote operation deadline expired");
      current.status = "active";
    });
  }
  /** Only a durable pre-connection record can be discarded without a remote receipt. */
  async discardUnstarted(expected) {
    await this.options.store.transact((state) => {
      const current = this.match(state, expected);
      if (!current) return;
      if (current.status !== "prepared") throw new Error("Remote operation may have connected");
      state.operations = state.operations.filter((item) => item.operationId !== current.operationId);
    });
  }
  /** Deadline expiry authorizes timeout cancellation. It does not prove remote termination. */
  async dueForCancellation() {
    const now = this.now();
    return (await this.pending()).filter((item) => item.status === "uncertain" || item.cancelAfter <= now);
  }
  async uncertain(expected, failure) {
    const safe = reason.parse(failure);
    await this.options.store.transact((state) => {
      const current = this.match(state, expected);
      if (!current) return;
      current.status = "uncertain";
      current.reason = safe;
    });
  }
  async acknowledge(expected, receipt) {
    const hostKey = remoteHostKeySchema.parse(receipt.hostKey);
    if (receipt.operationId !== expected.operationId || hostKey.algorithm !== expected.hostKey.algorithm || hostKey.key !== expected.hostKey.key || receipt.remoteUser !== expected.remoteUser || receipt.operationRoot !== expected.operationRoot)
      throw new Error("Remote cleanup identity mismatch");
    if (receipt.containment !== "descendants" && receipt.containment !== "process-group")
      throw new Error("Invalid remote cleanup containment");
    return this.options.store.transact((state) => {
      const current = this.match(state, expected);
      if (!current) return true;
      if (receipt.containment !== "descendants") {
        current.status = "uncertain";
        current.reason = "insufficient_containment";
        return false;
      }
      state.operations = state.operations.filter((item) => item.operationId !== current.operationId);
      return true;
    });
  }
  match(state, expected) {
    const current = state.operations.find((item) => item.operationId === expected.operationId);
    if (!current) return void 0;
    if (current.registrationToken !== expected.registrationToken || JSON.stringify(binding.strip().parse(current)) !== JSON.stringify(binding.strip().parse(expected)))
      throw new Error("Remote operation registration changed");
    return current;
  }
};

// src/runtime/ssh/ssh-pin.ts
async function removePin(directory, primary) {
  try {
    await promises.rm(directory, { recursive: true, force: true });
  } catch (error) {
    if (primary)
      throw new AggregateError([primary.error, error], "SSH execution and pin cleanup failed", {
        cause: error
      });
    throw error;
  }
}
async function acquirePinnedSshConnection(request) {
  const hostKey = remoteHostKeySchema.parse(request.hostKey);
  const bytes = Buffer.from(hostKey.key, "base64");
  const algorithm = Buffer.from(hostKey.algorithm);
  if (bytes.toString("base64") !== hostKey.key || bytes.length < 4 + algorithm.length || bytes.readUInt32BE(0) !== algorithm.length || !bytes.subarray(4, 4 + algorithm.length).equals(algorithm))
    throw new Error("Invalid SSH host key encoding");
  const directory = await promises.mkdtemp(path$1.join(os.tmpdir(), "sidedoor-ssh-pin-"));
  try {
    const alias = "sidedoor-" + crypto.randomBytes(16).toString("hex");
    const knownHostsFile = path$1.join(directory, "known_hosts");
    await promises.writeFile(knownHostsFile, `${alias} ${hostKey.algorithm} ${hostKey.key}
`, {
      flag: "wx",
      mode: 384
    });
    const connection2 = {
      ...request.connection,
      pinnedIdentity: {
        user: request.remoteUser,
        alias,
        knownHostsFile,
        algorithms: hostKey.algorithm === "ssh-rsa" ? "rsa-sha2-512,rsa-sha2-256" : hostKey.algorithm
      }
    };
    agentInvocation("true", [], connection2);
    let cleanup;
    return {
      connection: connection2,
      release(primary) {
        cleanup ??= removePin(directory, primary);
        return cleanup;
      }
    };
  } catch (error) {
    await removePin(directory, { error });
    throw error;
  }
}
async function withPinnedSshConnection(request, run) {
  const pin = await acquirePinnedSshConnection(request);
  let primary;
  try {
    return await run(pin.connection);
  } catch (error) {
    primary = { error };
    throw error;
  } finally {
    await pin.release(primary);
  }
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
var cleanupSchema = zod.z.object({
  type: zod.z.literal("cleaned"),
  operationId: zod.z.string().regex(/^[a-f0-9]{32}$/),
  remoteUser: zod.z.string().min(1).max(128),
  operationRoot: zod.z.string().min(1).max(4096),
  exitCode: zod.z.number().int().min(0).max(255),
  containment: zod.z.enum(["descendants", "process-group"])
}).strict();
var frameSchema = zod.z.discriminatedUnion("type", [
  cleanupSchema,
  zod.z.object({ type: zod.z.literal("data"), channel: zod.z.enum(["stdout", "stderr"]), data: zod.z.string().max(32768) }).strict(),
  zod.z.object({
    type: zod.z.literal("failure"),
    code: zod.z.enum([
      "interrupted",
      "timeout",
      "cancelled",
      "incomplete_input",
      "invalid_manifest",
      "output_disconnected",
      "unsafe_operation_directory",
      "cleanup_failed",
      "unexpected_input",
      "supervision_unavailable",
      "disconnected",
      "remote_failed",
      "cleanup_unconfirmed",
      "remote_identity_mismatch",
      "attachment_changed"
    ])
  }).strict()
]);
var RemoteProtocolError = class extends Error {
  constructor(code) {
    super(`Remote session ${code}`);
    this.code = code;
  }
  code;
};
var RemoteOutputDecoder = class {
  constructor(expected) {
    this.expected = expected;
    this.maximum = expected.maxOutputBytes ?? 16 * 1024 * 1024;
    this.diagnosticsMaximum = expected.maxDiagnosticBytes ?? 16 * 1024 * 1024;
    if (![this.maximum, this.diagnosticsMaximum].every((value) => Number.isSafeInteger(value) && value > 0))
      throw new Error("Invalid remote output limits");
  }
  expected;
  pending = "";
  bytes = 0;
  diagnosticBytes = 0;
  decoders = { stdout: new string_decoder.StringDecoder("utf8"), stderr: new string_decoder.StringDecoder("utf8") };
  cleanup;
  failures = [];
  finished = false;
  invalid = false;
  maximum;
  diagnosticsMaximum;
  push(chunk) {
    if (this.finished || this.invalid) throw new RemoteProtocolError("protocol_failed");
    try {
      if (chunk.channel === "stderr") {
        this.diagnosticBytes += Buffer.byteLength(chunk.text);
        if (this.diagnosticBytes > this.diagnosticsMaximum) throw new RemoteProtocolError("output_limit");
        return chunk.text ? [{ channel: "transport-stderr", text: chunk.text }] : [];
      }
      for (const character of chunk.text)
        if (character.charCodeAt(0) > 127) throw new RemoteProtocolError("protocol_failed");
      const result = [];
      let offset = 0;
      while (offset < chunk.text.length) {
        const newline = chunk.text.indexOf("\n", offset);
        const end = newline < 0 ? chunk.text.length : newline;
        if (this.pending.length + end - offset > 65536) throw new RemoteProtocolError("protocol_failed");
        this.pending += chunk.text.slice(offset, end);
        offset = end + 1;
        if (newline < 0) break;
        result.push(...this.frame(this.pending));
        this.pending = "";
      }
      return result;
    } catch (error) {
      this.invalid = true;
      if (error instanceof RemoteProtocolError) throw error;
      throw new RemoteProtocolError("protocol_failed");
    }
  }
  /** Call only after stdout EOF and transport settlement. Cleanup never converts execution failure to success. */
  finish(transport) {
    if (this.finished || this.invalid || this.pending) {
      this.invalid = true;
      throw new RemoteProtocolError("protocol_failed");
    }
    this.finished = true;
    return {
      cleanup: this.cleanup ? { ...this.cleanup } : void 0,
      failures: [...this.failures],
      transportError: transport.error
    };
  }
  frame(line) {
    if (this.cleanup) throw new RemoteProtocolError("protocol_failed");
    const frame = frameSchema.parse(JSON.parse(line));
    if (frame.type === "failure") {
      if (this.failures.length >= 32) throw new RemoteProtocolError("protocol_failed");
      this.failures.push(frame.code);
      return [];
    }
    if (frame.type === "cleaned") {
      if (frame.operationId !== this.expected.operationId || frame.remoteUser !== this.expected.remoteUser || frame.operationRoot !== this.expected.operationRoot)
        throw new RemoteProtocolError("protocol_failed");
      this.cleanup = frame;
      return ["stdout", "stderr"].flatMap((channel) => {
        const text2 = this.decoders[channel].end();
        return text2 ? [{ channel, text: text2 }] : [];
      });
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(frame.data))
      throw new RemoteProtocolError("protocol_failed");
    const bytes = Buffer.from(frame.data, "base64");
    if (bytes.toString("base64") !== frame.data) throw new RemoteProtocolError("protocol_failed");
    this.bytes += bytes.length;
    if (this.bytes > this.maximum) throw new RemoteProtocolError("output_limit");
    const text = this.decoders[frame.channel].write(bytes);
    return text ? [{ channel: frame.channel, text }] : [];
  }
};

// src/runtime/remote/remote-recovery.ts
var RemoteCleanupUncertainError = class extends Error {
  constructor(operationId, code, options) {
    super(`Remote cleanup is unconfirmed (${code})`, options);
    this.operationId = operationId;
    this.code = code;
  }
  operationId;
  code;
};
var RemoteOperationRecovery = class {
  constructor(journal, runner = new ProcessRunner()) {
    this.journal = journal;
    this.runner = runner;
  }
  journal;
  runner;
  async recover(operation, options) {
    const expected = await this.journal.current(structuredClone(operation));
    if (!expected) return;
    let confirmed = false;
    try {
      await withPinnedSshConnection(
        { connection: expected.connection, remoteUser: expected.remoteUser, hostKey: expected.hostKey },
        async (connection2) => {
          const decoder = new RemoteOutputDecoder({
            ...expected,
            maxOutputBytes: 65536,
            maxDiagnosticBytes: 65536
          });
          let transportError;
          let diagnostics = "";
          try {
            for await (const chunk of this.runner.stream({
              ...remoteRecoveryRequest({
                ...expected,
                connection: connection2,
                transportEnvironment: options.environment,
                signal: options.signal
              }),
              maxOutputBytes: 1024 * 1024
            })) {
              for (const output of decoder.push(chunk)) {
                if (output.channel !== "transport-stderr") throw new RemoteProtocolError("protocol_failed");
                diagnostics += output.text;
              }
            }
          } catch (error) {
            transportError = error;
            if (error instanceof ProcessExecutionError)
              error.diagnostics = { stdout: "", stderr: diagnostics };
          }
          if (transportError instanceof RemoteProtocolError) throw transportError;
          const outcome = decoder.finish({ error: transportError });
          if (!outcome.cleanup) {
            throw new RemoteCleanupUncertainError(
              expected.operationId,
              outcome.failures.includes("cleanup_failed") ? "cleanup_failed" : "transport_failed",
              { cause: transportError }
            );
          }
          confirmed = await this.journal.acknowledge(expected, {
            operationId: outcome.cleanup.operationId,
            remoteUser: outcome.cleanup.remoteUser,
            operationRoot: outcome.cleanup.operationRoot,
            hostKey: expected.hostKey,
            containment: outcome.cleanup.containment
          });
          if (!confirmed)
            throw new RemoteCleanupUncertainError(expected.operationId, "insufficient_containment");
          if (transportError !== void 0) throw transportError;
          if (outcome.cleanup.exitCode !== 0 || outcome.failures.length)
            throw new ProcessExecutionError("exit_failed", outcome.cleanup.exitCode);
        }
      );
    } catch (error) {
      if (confirmed) throw error;
      const failure = error instanceof RemoteCleanupUncertainError ? error : new RemoteCleanupUncertainError(
        expected.operationId,
        error instanceof RemoteProtocolError ? "protocol_failed" : "transport_failed",
        { cause: error }
      );
      try {
        await this.journal.uncertain(expected, failure.code);
      } catch (journalError) {
        throw new AggregateError([failure, journalError], "Remote recovery and journal persistence failed", {
          cause: journalError
        });
      }
      throw failure;
    }
  }
};
function localCleanupFailed(error) {
  if (error instanceof ProcessExecutionError && error.code === "cleanup_failed") return true;
  return error instanceof AggregateError && error.errors.some(localCleanupFailed);
}
function finishOutput(decoder, transportError) {
  try {
    return decoder.finish({ error: transportError?.error });
  } catch (error) {
    if (transportError)
      throw new AggregateError([transportError.error, error], "Remote transport and protocol failed", {
        cause: error
      });
    throw error;
  }
}
var RemoteSessionRunner = class {
  constructor(journal, runner = new ProcessRunner()) {
    this.journal = journal;
    this.runner = runner;
    this.recovery = new RemoteOperationRecovery(journal, runner);
  }
  journal;
  runner;
  recovery;
  stream(request) {
    const snapshot = {
      ...request,
      connection: { ...request.connection },
      hostKey: { ...request.hostKey },
      consumer: { ...request.consumer },
      files: [...request.files],
      args: request.args.map((arg) => typeof arg === "string" ? arg : { ...arg }),
      transportEnvironment: { ...request.transportEnvironment },
      remoteEnvironment: { ...request.remoteEnvironment },
      remoteEnvironmentKeys: [...request.remoteEnvironmentKeys],
      input: request.input === void 0 ? void 0 : Buffer.from(request.input)
    };
    const cancellation = new AbortController();
    let resolve;
    let reject;
    const settled = new Promise((accept, fail2) => {
      resolve = accept;
      reject = fail2;
    });
    void settled.catch(() => void 0);
    let started = false;
    const stream = this.execute(snapshot, cancellation.signal, { resolve, reject });
    const next = stream.next.bind(stream);
    const finish = stream.return.bind(stream);
    const fail = stream.throw.bind(stream);
    stream.next = (...args) => {
      started = true;
      return next(...args);
    };
    stream.return = async (value) => {
      cancellation.abort(new Error("Remote stream closed"));
      if (!started) resolve();
      const results = await Promise.allSettled([finish(value), started ? settled : Promise.resolve()]);
      if (results[1].status === "rejected") throw results[1].reason;
      if (results[0].status === "rejected") throw results[0].reason;
      return results[0].value;
    };
    stream.throw = async (error) => {
      cancellation.abort(error);
      if (!started) resolve();
      const results = await Promise.allSettled([fail(error), started ? settled : Promise.resolve()]);
      if (results[1].status === "rejected")
        throw new AggregateError(
          [error, results[1].reason],
          "Remote stream interruption and cleanup failed",
          { cause: results[1].reason }
        );
      throw error;
    };
    return stream;
  }
  async *execute(request, cancellation, settled) {
    const started = perf_hooks.performance.now();
    const timeout = request.timeoutMs ?? 6e5;
    const maximum = request.maxOutputBytes ?? 16 * 1024 * 1024;
    const diagnosticMaximum = request.maxDiagnosticBytes ?? 16 * 1024 * 1024;
    const deadline = new AbortController();
    const signal = AbortSignal.any([
      cancellation,
      deadline.signal,
      ...request.signal ? [request.signal] : []
    ]);
    let timer;
    let operation;
    let pin;
    let admissionAttempted = false;
    let confirmed = false;
    let primary;
    try {
      if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 864e5 || ![maximum, diagnosticMaximum].every((value) => Number.isSafeInteger(value) && value > 0) || !Number.isSafeInteger(maximum * 2 + diagnosticMaximum + 65536))
        throw new Error("Invalid remote execution limits");
      signal.throwIfAborted();
      timer = setTimeout(() => deadline.abort(new Error("Remote operation timed out")), timeout);
      operation = await this.journal.register({
        connection: request.connection,
        hostKey: request.hostKey,
        remoteUser: request.remoteUser,
        operationRoot: request.operationRoot,
        consumer: request.consumer,
        maximumLifetimeMs: timeout + 6e4
      });
      signal.throwIfAborted();
      pin = await acquirePinnedSshConnection(request);
      const prepared = await supervisedSessionRequest(
        {
          ...request,
          operationId: operation.operationId,
          connection: pin.connection,
          signal
        },
        () => Math.floor(timeout - (perf_hooks.performance.now() - started))
      );
      signal.throwIfAborted();
      const remaining = Math.floor(timeout - (perf_hooks.performance.now() - started));
      if (remaining < 1) throw new Error("Remote operation deadline expired");
      prepared.timeoutMs = remaining;
      prepared.maxOutputBytes = maximum * 2 + diagnosticMaximum + 65536;
      admissionAttempted = true;
      await this.journal.connecting(operation);
      signal.throwIfAborted();
      const decoder = new RemoteOutputDecoder({
        ...operation,
        maxOutputBytes: maximum,
        maxDiagnosticBytes: diagnosticMaximum
      });
      let transportError;
      try {
        for await (const chunk of this.runner.stream(prepared)) {
          for (const output of decoder.push(chunk)) yield output;
        }
      } catch (error) {
        transportError = { error };
      }
      const outcome = finishOutput(decoder, transportError);
      if (transportError?.error instanceof ProcessExecutionError)
        transportError.error.remoteFailureCodes = [...outcome.failures];
      if (outcome.cleanup)
        confirmed = await this.journal.acknowledge(operation, {
          ...outcome.cleanup,
          hostKey: operation.hostKey
        });
      if (transportError) throw transportError.error;
      if (!confirmed) throw new RemoteProtocolError("protocol_failed");
      if (outcome.failures.length || outcome.cleanup?.exitCode !== 0) {
        const failure = new ProcessExecutionError("exit_failed", outcome.cleanup?.exitCode ?? null);
        failure.remoteFailureCodes = [...outcome.failures];
        throw failure;
      }
    } catch (error) {
      primary = { error };
      throw error;
    } finally {
      clearTimeout(timer);
      await this.close(operation, pin, admissionAttempted, confirmed, request, primary).then(
        settled.resolve,
        (error) => {
          settled.reject(error);
          throw error;
        }
      );
    }
  }
  async close(operation, pin, admissionAttempted, confirmed, request, primary) {
    let cleanup;
    try {
      if (operation && !confirmed) {
        if (!admissionAttempted) await this.journal.discardUnstarted(operation);
        else {
          await this.journal.uncertain(operation, "transport_failed");
          if (localCleanupFailed(primary?.error))
            throw new RemoteCleanupUncertainError(operation.operationId, "cleanup_failed", {
              cause: primary?.error
            });
          await this.recovery.recover(operation, { environment: request.transportEnvironment });
        }
      }
    } catch (error) {
      cleanup = { error };
    }
    try {
      await pin?.release(cleanup ?? primary);
    } catch (error) {
      cleanup = { error };
    }
    if (!cleanup) return;
    if (primary)
      throw new AggregateError([primary.error, cleanup.error], "Remote execution and cleanup failed", {
        cause: cleanup.error
      });
    throw cleanup.error;
  }
};

exports.RemoteCleanupUncertainError = RemoteCleanupUncertainError;
exports.RemoteOperationJournal = RemoteOperationJournal;
exports.RemoteOperationRecovery = RemoteOperationRecovery;
exports.RemoteOutputDecoder = RemoteOutputDecoder;
exports.RemoteProtocolError = RemoteProtocolError;
exports.RemoteSessionRunner = RemoteSessionRunner;
exports.acquirePinnedSshConnection = acquirePinnedSshConnection;
exports.initialRemoteJournalState = initialRemoteJournalState;
exports.remoteHostKeySchema = remoteHostKeySchema;
exports.remoteJournalStateSchema = remoteJournalStateSchema;
exports.remoteRecoveryRequest = remoteRecoveryRequest;
exports.remoteSessionSupervisor = remoteSessionSupervisor;
exports.remoteSupervisor = remoteSupervisor;
exports.supervisedRemoteRequest = supervisedRemoteRequest;
exports.supervisedSessionRequest = supervisedSessionRequest;
exports.withPinnedSshConnection = withPinnedSshConnection;
