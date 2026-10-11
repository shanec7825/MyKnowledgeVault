'use strict';

var crypto = require('crypto');
var promises = require('fs/promises');
var fs = require('fs');
var path = require('path');
var module$1 = require('module');
var promises$1 = require('timers/promises');
var zod = require('zod');
var url = require('url');
var stream = require('stream');
var promises$2 = require('stream/promises');
var util = require('util');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
// src/storage/index.ts
var requireNative = module$1.createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('index.cjs', document.baseURI).href)));
var binding;
function lockFile(descriptor, shared) {
  try {
    binding ??= requireNative("thesidedoor-flock");
  } catch (cause) {
    throw new Error(
      "Native file locking is unavailable. Install thesidedoor-flock with a working C++ compiler and node-gyp toolchain.",
      { cause }
    );
  }
  const { LOCK_SH, LOCK_EX, LOCK_NB } = binding.constants;
  binding.flock(descriptor, (shared ? LOCK_SH : LOCK_EX) | LOCK_NB);
}
var FileLockBusyError = class extends Error {
  code = "lock_busy";
  constructor() {
    super("The protected files are busy. Retry the operation.");
  }
};
function withSharedFileLockSync(path, operation) {
  const release = acquireFileLockSync(path, "shared");
  try {
    const result = operation();
    if (result instanceof Promise)
      throw new Error("Synchronous file lock callbacks must not return a promise");
    return result;
  } finally {
    release();
  }
}
function acquireFileLockSync(path$1, mode = "exclusive") {
  const anchor = path.resolve(path$1);
  fs.mkdirSync(path.dirname(anchor), { recursive: true, mode: 448 });
  const descriptor = fs.openSync(anchor, "a", 384);
  try {
    try {
      lockFile(descriptor, mode === "shared");
    } catch (error) {
      if (error instanceof Error && "code" in error && ["EAGAIN", "EWOULDBLOCK"].includes(String(error.code)))
        throw new FileLockBusyError();
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      fs.closeSync(descriptor);
    };
  } catch (error) {
    fs.closeSync(descriptor);
    throw error;
  }
}
async function acquireFileLock(path$1, options = {}) {
  const timeout = options.timeoutMs ?? 1e4;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("Invalid file lock timeout");
  options.signal?.throwIfAborted();
  const anchor = path.resolve(path$1);
  await promises.mkdir(path.dirname(anchor), { recursive: true, mode: 448 });
  const handle = await promises.open(anchor, "a", 384);
  try {
    const deadline = Date.now() + timeout;
    while (true) {
      options.signal?.throwIfAborted();
      try {
        lockFile(handle.fd, options.mode === "shared");
        return () => handle.close();
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || !["EAGAIN", "EWOULDBLOCK"].includes(String(error.code)))
          throw error;
        if (Date.now() >= deadline) throw new FileLockBusyError();
        await promises$1.setTimeout(10, void 0, { signal: options.signal });
      }
    }
  } catch (error) {
    await handle.close();
    throw error;
  }
}
async function withFileLock(path, operation, options = {}) {
  const release = await acquireFileLock(path, options);
  try {
    return await operation();
  } finally {
    await release();
  }
}
function syncDirectory(path) {
  const descriptor = fs.openSync(path, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

// src/storage/registry/key.ts
function localEncryptionKey(path$1, options) {
  if (!fs.statSync(path.dirname(path$1)).isDirectory()) throw new Error("Encryption key parent is not a directory");
  const release = acquireFileLockSync(`${path$1}.guard`, options.create ? "exclusive" : "shared");
  let descriptor;
  try {
    try {
      descriptor = fs.openSync(
        path$1,
        (options.create ? fs.constants.O_RDWR : fs.constants.O_RDONLY) | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK
      );
    } catch (error) {
      if (!options.create || !(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
        throw error;
      descriptor = fs.openSync(
        path$1,
        fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
        384
      );
      fs.writeFileSync(descriptor, crypto.randomBytes(32));
    }
    const file = fs.fstatSync(descriptor);
    if (!file.isFile() || file.size !== 32 || (file.mode & 4095) !== 384)
      throw new Error("Encryption key must be a regular 32-byte file with mode 0600");
    if (options.create) {
      fs.fsyncSync(descriptor);
      syncDirectory(path.dirname(path$1));
    }
    const key = Buffer.alloc(32);
    let offset = 0;
    while (offset < key.length) {
      const bytes = fs.readSync(descriptor, key, offset, key.length - offset, offset);
      if (!bytes) throw new Error("Encryption key changed while reading");
      offset += bytes;
    }
    return key;
  } finally {
    try {
      if (descriptor !== void 0) fs.closeSync(descriptor);
    } finally {
      release();
    }
  }
}
async function sqlStateRows(database, dialect, prefix, after, limit = 100, cursorKind = "digest") {
  zod.z.number().int().min(1).max(100).parse(limit);
  if (!prefix.endsWith(":")) throw new Error("State scan prefix must end with a colon");
  const cursorSchema = cursorKind === "uuid" ? zod.z.uuid() : cursorKind === "compoundDigest" ? zod.z.string().regex(/^[a-f0-9]{64}:[a-f0-9]{64}$/) : zod.z.string().regex(/^[a-f0-9]{64}$/);
  if (after !== null && (!after.startsWith(prefix) || !cursorSchema.safeParse(after.slice(prefix.length)).success))
    throw new Error("State cursor belongs to another namespace");
  const p = (index) => dialect === "postgres" ? `$${index}` : "?";
  const operators = dialect === "postgres" ? { lower: "~>=~", upper: "~<~", after: "~>~", order: " USING ~<~" } : { lower: ">=", upper: "<", after: ">", order: "" };
  return database.query(
    `SELECT "id", "revision", "state" FROM "SidedoorState" WHERE "id" ${operators.lower} ${p(1)} AND "id" ${operators.upper} ${p(2)} AND "id" ${operators.after} ${p(3)} ORDER BY "id"${operators.order} LIMIT ${limit}`,
    [prefix, `${prefix.slice(0, -1)};`, after ?? ""]
  );
}
function sqlStateBackend(database, dialect, id) {
  if (!id || id.length > 200) throw new Error("State namespace must contain 1 to 200 characters");
  const parameter = (index) => dialect === "postgres" ? `$${index}` : "?";
  function snapshot(row) {
    if (typeof row.revision !== "string") throw new Error("Invalid state revision");
    if (dialect === "sqlite" && typeof row.state !== "string") throw new Error("Invalid stored JSON");
    return {
      revision: row.revision,
      state: dialect === "sqlite" ? JSON.parse(row.state) : row.state
    };
  }
  return {
    async read() {
      const rows = await database.query(
        `SELECT "revision", "state" FROM "SidedoorState" WHERE "id" = ${parameter(1)}`,
        [id]
      );
      return rows[0] ? snapshot(rows[0]) : null;
    },
    async compareAndSwap(previous, next) {
      const encoded = JSON.stringify(next.state);
      if (encoded === void 0) throw new Error("State must be JSON serializable");
      const value = dialect === "postgres" ? `${parameter(3)}::jsonb` : parameter(3);
      if (previous === null) {
        const rows2 = await database.query(
          `INSERT INTO "SidedoorState" ("id", "revision", "state") VALUES (${parameter(1)}, ${parameter(2)}, ${value}) ON CONFLICT ("id") DO NOTHING RETURNING "revision"`,
          [id, next.revision, encoded]
        );
        return rows2.length === 1;
      }
      const rows = await database.query(
        `UPDATE "SidedoorState" SET "revision" = ${parameter(1)}, "state" = ${dialect === "postgres" ? `${parameter(2)}::jsonb` : parameter(2)} WHERE "id" = ${parameter(3)} AND "revision" = ${parameter(4)} RETURNING "revision"`,
        [next.revision, encoded, id, previous]
      );
      return rows.length === 1;
    }
  };
}
var StorageReferenceError = class extends Error {
  constructor() {
    super("Storage reference does not identify an object in the selected backend");
    this.name = "StorageReferenceError";
  }
};
function reject() {
  throw new StorageReferenceError();
}
function hasControl(value) {
  return [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
function validateStorageKey(value) {
  if (!value || value.includes("\\") || hasControl(value) || value.split("/").some((part) => !part || part === "." || part === ".."))
    reject();
  return value;
}
function decodedPath(value) {
  return value.split("/").map((part) => {
    let decoded;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      return reject();
    }
    if (decoded.includes("/")) reject();
    return validateStorageKey(decoded);
  }).join("/");
}
function httpLocation(value, rawKey = false) {
  const match = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?$/.exec(value);
  if (!match || value.includes("\\") || hasControl(value)) reject();
  const path = match[2] || "";
  if (path && path !== "/") {
    const content = path.slice(1).replace(/\/$/, "");
    if (rawKey) {
      validateStorageKey(content);
      for (const part of content.split("/")) {
        if (/%(?:2f|5c|00|0[ad])/i.test(part) || /^(?:\.|%2e){1,2}$/i.test(part)) reject();
      }
    } else decodedPath(content);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return reject();
  }
  if (url.username || url.password) reject();
  return { url, path };
}
function storageBackendBinding(backend) {
  let location;
  if (backend.kind === "local") {
    if (!path.isAbsolute(backend.root) || hasControl(backend.root)) reject();
    location = ["local", path.resolve(backend.root)];
  } else {
    const endpoint = httpLocation(backend.endpoint);
    if (!backend.bucket || /[/\\ ]/.test(backend.bucket) || hasControl(backend.bucket)) reject();
    location = ["object", endpoint.url.origin, endpoint.path.replace(/\/$/, ""), backend.bucket];
  }
  return crypto.createHash("sha256").update(JSON.stringify(location)).digest("hex");
}
function normalizeStorageReference(backend, reference, options = {}) {
  storageBackendBinding(backend);
  if (reference.startsWith("file:")) {
    if (backend.kind !== "local" || /[?#\\]/.test(reference) || hasControl(reference)) reject();
    const match = /^file:\/\/([^/]*)(\/.*)$/.exec(reference);
    if (!match || match[1]) reject();
    decodedPath(match[2].slice(1));
    let file;
    try {
      file = url.fileURLToPath(reference);
    } catch {
      return reject();
    }
    const result = path.relative(path.resolve(backend.root), file);
    if (path.isAbsolute(result)) reject();
    return validateStorageKey(result.split(path.sep).join("/"));
  }
  if (reference.startsWith("/")) {
    const prefix = options.localRoutePrefix;
    if (backend.kind !== "local" || !prefix || !prefix.startsWith("/") || prefix.endsWith("/")) reject();
    if (!reference.startsWith(`${prefix}/`) || /[?#]/.test(reference)) reject();
    return decodedPath(reference.slice(prefix.length + 1));
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(reference)) {
    if (backend.kind !== "object" || !options.publicUrl) reject();
    const source = httpLocation(reference, options.publicUrlEncoding !== "percent");
    const alias = httpLocation(options.publicUrl);
    const aliasPath = alias.path.replace(/\/$/, "");
    if (source.url.origin !== alias.url.origin || !source.path.startsWith(`${aliasPath}/`)) reject();
    const suffix = source.path.slice(aliasPath.length + 1);
    return options.publicUrlEncoding === "percent" ? decodedPath(suffix) : validateStorageKey(suffix);
  }
  return validateStorageKey(reference);
}
var digestSchema = zod.z.string().regex(/^[a-f0-9]{64}$/);
var namespaceSchema = zod.z.string().min(1).max(200);
var rootSchema = zod.z.string().refine(
  (root) => path.isAbsolute(root) && path.resolve(root) === root && ![...root].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
);
var decimalSchema = zod.z.string().regex(/^(?:0|[1-9]\d*)$/);
var storageCleanupDescriptorSchema = zod.z.discriminatedUnion("kind", [
  zod.z.object({
    kind: zod.z.literal("local"),
    identity: zod.z.object({ root: rootSchema, device: decimalSchema, inode: decimalSchema, binding: digestSchema }).strict(),
    referenceRoot: rootSchema
  }).strict(),
  zod.z.object({
    kind: zod.z.literal("object"),
    location: zod.z.object({ kind: zod.z.literal("object"), endpoint: zod.z.string().min(1), bucket: zod.z.string().min(1) }).strict(),
    binding: digestSchema,
    access: zod.z.object({
      provider: zod.z.string().min(1).max(100),
      credentialRevision: zod.z.uuid(),
      signingRegion: zod.z.string().min(1).max(100)
    }).strict().nullable().default(null),
    publicUrl: zod.z.string().nullable().default(null),
    referenceEncoding: zod.z.enum(["raw", "percent"]).default("raw")
  }).strict()
]).superRefine((value, context) => {
  try {
    const binding3 = value.kind === "local" ? storageBackendBinding({ kind: "local", root: value.identity.root }) : storageBackendBinding(value.location);
    if (binding3 !== (value.kind === "local" ? value.identity.binding : value.binding))
      throw new Error("Binding mismatch");
    if (value.kind === "object" && value.publicUrl !== null) {
      normalizeStorageReference(
        value.location,
        `${value.publicUrl.replace(/\/$/, "")}/__reference_validation__`,
        {
          publicUrl: value.publicUrl,
          publicUrlEncoding: value.referenceEncoding
        }
      );
    }
  } catch {
    context.addIssue({
      code: "custom",
      message: "Storage descriptor does not match a valid backend location"
    });
  }
});
var registrationSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_backend"),
  namespace: namespaceSchema,
  id: digestSchema,
  binding: digestSchema,
  descriptor: storageCleanupDescriptorSchema
}).strict();
function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function prepareStorageBackend(namespace, input) {
  const descriptor = storageCleanupDescriptorSchema.parse(input);
  return registrationSchema.parse({
    schemaVersion: 1,
    kind: "storage_backend",
    namespace,
    id: digest(JSON.stringify(descriptor)),
    binding: descriptor.kind === "local" ? descriptor.identity.binding : descriptor.binding,
    descriptor
  });
}
var StorageBackendRegistry = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    namespaceSchema.parse(namespace);
    this.namespaceHash = digest(namespace);
  }
  database;
  dialect;
  namespace;
  namespaceHash;
  backend(id) {
    digestSchema.parse(id);
    return sqlStateBackend(this.database, this.dialect, `sd-b:1:${this.namespaceHash}:${id}`);
  }
  validate(input) {
    const registration = registrationSchema.parse(input);
    const canonical = prepareStorageBackend(this.namespace, registration.descriptor);
    if (registration.namespace !== this.namespace || registration.id !== canonical.id || registration.binding !== canonical.binding)
      throw new Error("Storage backend registration identity mismatch");
    return canonical;
  }
  async get(id) {
    const record = await this.backend(id).read();
    if (!record) return null;
    const registration = this.validate(record.state);
    if (registration.id !== id) throw new Error("Storage backend registration identity mismatch");
    return registration;
  }
  async register(prepared) {
    const registration = this.validate(prepared);
    const previous = await this.get(registration.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(registration))
        throw new Error("Storage backend registration changed");
      return;
    }
    if (!await this.backend(registration.id).compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: registration
    }))
      throw new Error("Storage backend registration changed concurrently");
  }
};

// src/storage/execution/write-journal.ts
var identity = zod.z.string().min(1).max(200);
var generation = zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var targetSchema = zod.z.object({
  backendId: zod.z.string().regex(/^[a-f0-9]{64}$/),
  binding: zod.z.string().regex(/^[a-f0-9]{64}$/),
  key: zod.z.string().transform(validateStorageKey)
}).strict();
var evidenceSchema = zod.z.object({ kind: zod.z.enum(["observed_io_completion", "stopped_writer"]), id: identity }).strict();
var intentSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("write"),
  namespace: identity,
  subjectId: identity,
  generation,
  operationId: zod.z.uuid(),
  createdAt: generation,
  target: targetSchema,
  status: zod.z.enum(["active", "settled", "uncertain"]),
  outcome: zod.z.enum(["referenced", "unreferenced", "uncertain"]).optional(),
  resolution: evidenceSchema.optional()
}).strict().refine(
  (value) => value.status === "active" ? value.outcome === void 0 && value.resolution === void 0 : value.status === "uncertain" ? value.outcome === "uncertain" && value.resolution === void 0 : (value.outcome === "referenced" || value.outcome === "unreferenced") && (!value.resolution || value.outcome === "unreferenced")
);
var receiptSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("write_receipt"),
  outcome: zod.z.enum(["referenced", "not_created"]).default("referenced"),
  namespace: identity,
  subjectId: identity,
  generation,
  operationId: zod.z.uuid(),
  digest: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var tombstoneSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("tombstone"),
  namespace: identity,
  subjectId: identity,
  generation,
  jobId: zod.z.uuid(),
  createdAt: generation
}).strict();
function prepareStorageWrite(input) {
  return intentSchema.parse({
    ...input,
    schemaVersion: 1,
    kind: "write",
    operationId: crypto.randomUUID(),
    createdAt: Date.now(),
    status: "active"
  });
}
function prepareStorageTombstone(input) {
  return tombstoneSchema.parse({ ...input, schemaVersion: 1, kind: "tombstone", createdAt: Date.now() });
}
function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function sameIntent(left, right) {
  return left.namespace === right.namespace && left.subjectId === right.subjectId && left.generation === right.generation && left.operationId === right.operationId && left.createdAt === right.createdAt && left.target.backendId === right.target.backendId && left.target.binding === right.target.binding && left.target.key === right.target.key;
}
function intentDigest(intent) {
  return hash(
    JSON.stringify([
      intent.namespace,
      intent.subjectId,
      intent.generation,
      intent.operationId,
      intent.createdAt,
      intent.target.backendId,
      intent.target.binding,
      intent.target.key
    ])
  );
}
var StorageWriteJournal = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    identity.parse(namespace);
    this.namespaceHash = hash(namespace);
  }
  database;
  dialect;
  namespace;
  namespaceHash;
  backendBindings = /* @__PURE__ */ new Map();
  parameter(index) {
    return this.dialect === "postgres" ? `$${index}` : "?";
  }
  tombstoneId(subjectId) {
    return `sd-t:1:${this.namespaceHash}:${hash(subjectId)}`;
  }
  writePrefix(subjectId) {
    return `sd-w:1:${this.namespaceHash}:${hash(subjectId)}:`;
  }
  writeId(intent) {
    return `${this.writePrefix(intent.subjectId)}${intent.operationId}`;
  }
  receiptId(intent) {
    return `sd-r:1:${this.namespaceHash}:${hash(intent.subjectId)}:${intent.operationId}`;
  }
  async readReceipt(intent) {
    const record = await this.backend(this.receiptId(intent)).read();
    if (!record) return null;
    const receipt = receiptSchema.parse(record.state);
    if (receipt.namespace !== intent.namespace || receipt.subjectId !== intent.subjectId || receipt.generation !== intent.generation || receipt.operationId !== intent.operationId || receipt.digest !== intentDigest(intent))
      throw new Error("Storage operation identity was already used");
    return receipt;
  }
  /** Read in the caller's transaction when reconciling an unknown reference commit. */
  async completion(prepared) {
    const intent = this.validateIntent(prepared);
    await this.validateTarget(intent);
    return (await this.readReceipt(intent))?.outcome ?? null;
  }
  backend(id) {
    return sqlStateBackend(this.database, this.dialect, id);
  }
  validateIntent(value) {
    const intent = intentSchema.parse(value);
    if (intent.namespace !== this.namespace) throw new Error("Storage journal namespace mismatch");
    return intent;
  }
  async validateTarget(intent) {
    let binding3 = this.backendBindings.get(intent.target.backendId);
    if (!binding3) {
      const registration = await new StorageBackendRegistry(this.database, this.dialect, this.namespace).get(
        intent.target.backendId
      );
      if (!registration) throw new Error("Storage backend descriptor is missing");
      binding3 = registration.binding;
      this.backendBindings.set(intent.target.backendId, binding3);
    }
    if (binding3 !== intent.target.binding)
      throw new Error("Storage target does not match its backend descriptor");
  }
  async tombstone(subjectId) {
    identity.parse(subjectId);
    const record = await this.backend(this.tombstoneId(subjectId)).read();
    if (!record) return null;
    const value = tombstoneSchema.parse(record.state);
    if (value.namespace !== this.namespace || value.subjectId !== subjectId)
      throw new Error("Storage tombstone identity mismatch");
    return value;
  }
  async forbidWrites(prepared) {
    const value = tombstoneSchema.parse(prepared);
    if (value.namespace !== this.namespace) throw new Error("Storage journal namespace mismatch");
    const previous = await this.tombstone(value.subjectId);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(value))
        throw new Error("Storage subject was already tombstoned");
      return;
    }
    if (!await this.backend(this.tombstoneId(value.subjectId)).compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: value
    }))
      throw new Error("Storage tombstone changed concurrently");
  }
  /**
   * Check each scope before committing references in the same Serializable transaction.
   * This read-only check does not authorize I/O or replace begin's replay protection.
   * Callers still validate parent existence and ownership in that transaction.
   */
  async assertWritable(prepared, currentGeneration) {
    const intent = this.validateIntent(prepared);
    if (intent.status !== "active" || intent.generation !== generation.parse(currentGeneration))
      throw new Error("Storage write generation is no longer current");
    if (await this.tombstone(intent.subjectId)) throw new Error("Storage subject is being erased");
    await this.validateTarget(intent);
  }
  async begin(prepared, currentGeneration) {
    const intent = this.validateIntent(prepared);
    await this.assertWritable(intent, currentGeneration);
    if (await this.readReceipt(intent)) return "already_completed";
    const backend = this.backend(this.writeId(intent));
    const previous = await backend.read();
    if (previous) {
      const existing = this.validateIntent(intentSchema.parse(previous.state));
      if (!sameIntent(existing, intent)) throw new Error("Storage operation identity was already used");
      return "already_started";
    }
    if (!await backend.compareAndSwap(null, { revision: crypto.randomUUID(), state: intent }))
      throw new Error("Storage operation changed concurrently");
    return "created";
  }
  /**
   * Only an observed I/O outcome may settle a write, never a heartbeat timeout.
   * not_created requires proof the original admitted operation never created its
   * destination. A failed retry or an ambiguous remote response is insufficient.
   */
  async finish(prepared, outcome) {
    const intent = this.validateIntent(prepared);
    await this.validateTarget(intent);
    if (outcome.kind === "referenced" && generation.parse(outcome.currentGeneration) !== intent.generation)
      throw new Error("Storage write generation is no longer current");
    const id = this.writeId(intent);
    const backend = this.backend(id);
    const previous = await backend.read();
    if (!previous) {
      const receipt = await this.readReceipt(intent);
      if (receipt) {
        if (outcome.kind !== receipt.outcome)
          throw new Error("Storage completion conflicts with its recorded outcome");
        return "removed";
      }
      throw new Error("Storage operation is missing");
    }
    const current = this.validateIntent(intentSchema.parse(previous.state));
    if (!sameIntent(current, intent)) throw new Error("Storage operation identity mismatch");
    if (current.status !== "active") {
      if (current.outcome !== outcome.kind)
        throw new Error("Storage completion conflicts with its recorded outcome");
      return "retained";
    }
    const tombstone = await this.tombstone(intent.subjectId);
    if (outcome.kind === "not_created" || outcome.kind === "referenced" && !tombstone) {
      const receipt = receiptSchema.parse({
        schemaVersion: 1,
        kind: "write_receipt",
        outcome: outcome.kind,
        namespace: intent.namespace,
        subjectId: intent.subjectId,
        generation: intent.generation,
        operationId: intent.operationId,
        digest: intentDigest(intent)
      });
      if (!await this.backend(this.receiptId(intent)).compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: receipt
      }))
        throw new Error("Storage completion changed concurrently");
      const rows = await this.database.query(
        `DELETE FROM "SidedoorState" WHERE "id" = ${this.parameter(1)} AND "revision" = ${this.parameter(2)} RETURNING "id"`,
        [id, previous.revision]
      );
      if (rows.length !== 1) throw new Error("Storage operation changed concurrently");
      return "removed";
    }
    const next = {
      ...current,
      status: outcome.kind === "uncertain" ? "uncertain" : "settled",
      outcome: outcome.kind
    };
    if (!await backend.compareAndSwap(previous.revision, { revision: crypto.randomUUID(), state: next }))
      throw new Error("Storage operation changed concurrently");
    return "retained";
  }
  /** Caller must authorize and persist evidence of observed completion or a stopped writer. Never infer it from time. */
  async resolveUncertain(prepared, evidence) {
    const intent = this.validateIntent(prepared);
    await this.validateTarget(intent);
    const resolution = evidenceSchema.parse(evidence);
    const backend = this.backend(this.writeId(intent));
    const previous = await backend.read();
    if (!previous) throw new Error("Storage operation is missing");
    const current = this.validateIntent(intentSchema.parse(previous.state));
    if (!sameIntent(current, intent)) throw new Error("Storage operation identity mismatch");
    if (current.status === "settled" && current.resolution?.kind === resolution.kind && current.resolution.id === resolution.id)
      return;
    if (current.status !== "uncertain") throw new Error("Storage operation is not awaiting resolution");
    const next = intentSchema.parse({ ...current, status: "settled", outcome: "unreferenced", resolution });
    if (!await backend.compareAndSwap(previous.revision, { revision: crypto.randomUUID(), state: next }))
      throw new Error("Storage resolution changed concurrently");
  }
  async list(subjectId, options = {}) {
    identity.parse(subjectId);
    const prefix = this.writePrefix(subjectId);
    const limit = zod.z.number().int().min(1).max(1e3).parse(options.limit ?? 100);
    const after = options.after ?? "";
    if (after && (!after.startsWith(prefix) || !zod.z.uuid().safeParse(after.slice(prefix.length)).success))
      throw new Error("Storage journal cursor belongs to another subject");
    const operators = this.dialect === "postgres" ? { lower: "~>=~", upper: "~<~", after: "~>~", order: " USING ~<~" } : { lower: ">=", upper: "<", after: ">", order: "" };
    const upper = `${prefix.slice(0, -1)};`;
    const rows = await this.database.query(
      `SELECT "id", "state" FROM "SidedoorState" WHERE "id" ${operators.lower} ${this.parameter(1)} AND "id" ${operators.upper} ${this.parameter(2)} AND "id" ${operators.after} ${this.parameter(3)} ORDER BY "id"${operators.order} LIMIT ${this.parameter(4)}`,
      [prefix, upper, after, limit]
    );
    const intents = rows.map((row) => {
      const intent = this.validateIntent(
        intentSchema.parse(
          this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
        )
      );
      if (intent.subjectId !== subjectId || row.id !== this.writeId(intent))
        throw new Error("Storage journal record identity mismatch");
      return intent;
    });
    for (const intent of intents) await this.validateTarget(intent);
    return { intents, cursor: rows.length === limit ? String(rows.at(-1).id) : null };
  }
};

// src/storage/sql/instance.ts
var identity2 = zod.z.string().min(1).max(200);
var instance = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_instance"),
  namespace: identity2,
  instanceId: zod.z.uuid()
}).strict();
var allocation = instance.extend({ kind: zod.z.literal("storage_instance_allocation") });
function scope(instanceId) {
  return { instanceId, subjectId: `instance:${zod.z.uuid().parse(instanceId)}`, generation: 0 };
}
var StorageInstanceControl = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    identity2.parse(namespace);
    this.prefix = crypto.createHash("sha256").update(namespace).digest("hex");
  }
  database;
  dialect;
  namespace;
  prefix;
  control() {
    return sqlStateBackend(this.database, this.dialect, `sd-i:1:${this.prefix}`);
  }
  allocated(instanceId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-ia:1:${this.prefix}:${zod.z.uuid().parse(instanceId)}`
    );
  }
  writes() {
    return new StorageWriteJournal(this.database, this.dialect, this.namespace);
  }
  async current() {
    const record = await this.control().read();
    if (!record) throw new Error("Storage instance is not initialized");
    const state = instance.parse(record.state);
    if (state.namespace !== this.namespace) throw new Error("Storage instance namespace mismatch");
    const reserved = await this.allocated(state.instanceId).read();
    if (!reserved) throw new Error("Storage instance allocation is missing");
    const marker = allocation.parse(reserved.state);
    if (marker.namespace !== this.namespace || marker.instanceId !== state.instanceId)
      throw new Error("Storage instance allocation mismatch");
    return { state, revision: record.revision };
  }
  async reserve(instanceId) {
    const target = scope(instanceId);
    if (await this.writes().tombstone(target.subjectId))
      throw new Error("Storage instance was already erased");
    if (!await this.allocated(instanceId).compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: {
        schemaVersion: 1,
        kind: "storage_instance_allocation",
        namespace: this.namespace,
        instanceId
      }
    }))
      throw new Error("Storage instance identity was already allocated");
  }
  /** Prepare the UUID outside retries. Invoke only from explicit bootstrap or migration. */
  async initialize(preparedInstanceId) {
    zod.z.uuid().parse(preparedInstanceId);
    if (await this.control().read()) return this.read();
    await this.reserve(preparedInstanceId);
    if (!await this.control().compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: {
        schemaVersion: 1,
        kind: "storage_instance",
        namespace: this.namespace,
        instanceId: preparedInstanceId
      }
    }))
      throw new Error("Storage instance initialization changed concurrently");
    return scope(preparedInstanceId);
  }
  /** Final reference transactions must compare this ID with the operation's captured ID. */
  async read() {
    return scope((await this.current()).state.instanceId);
  }
  /** Compose with old-instance cleanup registration and tombstoning in the reset transaction. */
  async rotate(expectedInstanceId, preparedInstanceId) {
    zod.z.uuid().parse(expectedInstanceId);
    zod.z.uuid().parse(preparedInstanceId);
    const current = await this.current();
    if (current.state.instanceId !== expectedInstanceId || preparedInstanceId === expectedInstanceId)
      throw new Error("Storage instance changed or replacement identity is not new");
    const previous = scope(expectedInstanceId);
    const tombstone = await this.writes().tombstone(previous.subjectId);
    if (!tombstone || tombstone.generation !== previous.generation)
      throw new Error("Previous storage instance must be tombstoned before rotation");
    await this.reserve(preparedInstanceId);
    if (!await this.control().compareAndSwap(current.revision, {
      revision: crypto.randomUUID(),
      state: { ...current.state, instanceId: preparedInstanceId }
    }))
      throw new Error("Storage instance changed concurrently");
    return scope(preparedInstanceId);
  }
};
var LocalStorageCleanup = class _LocalStorageCleanup {
  constructor(identity9) {
    this.identity = identity9;
  }
  identity;
  activeListings = 0;
  activeDeletions = 0;
  static async capture(root) {
    const resolved = await promises.realpath(root);
    const info = await promises.lstat(resolved, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Storage root is not a directory");
    return new _LocalStorageCleanup(
      Object.freeze({
        root: resolved,
        device: String(info.dev),
        inode: String(info.ino),
        binding: storageBackendBinding({ kind: "local", root: resolved })
      })
    );
  }
  /** Reopen an outbox location only when the original directory still exists. */
  static async restore(identity9) {
    const current = await _LocalStorageCleanup.capture(identity9.root);
    if (current.identity.root !== identity9.root || current.identity.device !== identity9.device || current.identity.inode !== identity9.inode || current.identity.binding !== identity9.binding)
      throw new Error("Storage root changed since cleanup was scheduled");
    return current;
  }
  async verifyRoot() {
    const info = await promises.lstat(this.identity.root, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink() || String(info.dev) !== this.identity.device || String(info.ino) !== this.identity.inode)
      throw new Error("Storage root changed since cleanup was scheduled");
  }
  async verifyAbsence(parent) {
    await this.verifyRoot();
    if (await promises.realpath(parent) !== parent) throw new Error("Storage path changed during cleanup");
    syncDirectory(parent);
    await this.verifyRoot();
  }
  /** Stream exact keys under an owned directory prefix without following links. */
  async *list(prefix) {
    if (this.activeDeletions) throw new Error("Finish deleting before collecting another cleanup manifest");
    this.activeListings++;
    try {
      yield* this.listExact(prefix);
    } finally {
      this.activeListings--;
    }
  }
  async *listExact(prefix) {
    if (!prefix.endsWith("/")) throw new Error("Cleanup listing requires a directory prefix");
    const key = prefix.slice(0, -1);
    const normalized = normalizeStorageReference({ kind: "local", root: this.identity.root }, key);
    if (normalized !== key) throw new Error("Cleanup requires an exact storage prefix");
    await this.verifyRoot();
    let directory = this.identity.root;
    for (const part of key.split("/")) {
      const existingParent = directory;
      directory = path.join(directory, part);
      let info;
      try {
        info = await promises.lstat(directory);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          await this.verifyAbsence(existingParent);
          return;
        }
        throw error;
      }
      if (!info.isDirectory() || info.isSymbolicLink())
        throw new Error("Cleanup prefix is not a regular directory");
    }
    yield* this.walk(directory, prefix, 0);
  }
  async *walk(directory, prefix, depth) {
    if (depth > 128) throw new Error("Storage directory nesting exceeds the cleanup limit");
    await this.verifyRoot();
    if (await promises.realpath(directory) !== directory) throw new Error("Storage path changed during cleanup");
    for await (const entry of await promises.opendir(directory)) {
      if (entry.isSymbolicLink()) throw new Error("Cleanup refuses symbolic links");
      if (entry.isDirectory()) {
        yield* this.walk(path.join(directory, entry.name), `${prefix}${entry.name}/`, depth + 1);
      } else if (entry.isFile()) {
        yield `${prefix}${entry.name}`;
      } else throw new Error("Cleanup target is not a regular file");
    }
  }
  /** Verify one exact regular file, including root-level references. */
  async has(key) {
    if (this.activeDeletions) throw new Error("Finish deleting before collecting another cleanup manifest");
    this.activeListings++;
    try {
      if (normalizeStorageReference({ kind: "local", root: this.identity.root }, key) !== key)
        throw new Error("Cleanup requires an exact storage key");
      await this.verifyRoot();
      const parts = key.split("/");
      let target = this.identity.root;
      for (const [index, part] of parts.entries()) {
        const existingParent = target;
        target = path.join(target, part);
        let info;
        try {
          info = await promises.lstat(target);
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            await this.verifyAbsence(existingParent);
            return false;
          }
          throw error;
        }
        if (info.isSymbolicLink() || (index === parts.length - 1 ? !info.isFile() : !info.isDirectory()))
          throw new Error("Cleanup target is not a regular file");
      }
      if (await promises.realpath(target) !== target) throw new Error("Storage path changed during cleanup");
      await this.verifyRoot();
      return true;
    } finally {
      this.activeListings--;
    }
  }
  /** Exact keys only. Missing objects are already deleted; other failures remain visible. */
  async delete(key) {
    if (this.activeListings) throw new Error("Finish collecting the cleanup manifest before deleting");
    this.activeDeletions++;
    try {
      await this.deleteExact(key);
    } finally {
      this.activeDeletions--;
    }
  }
  async deleteExact(key) {
    const normalized = normalizeStorageReference({ kind: "local", root: this.identity.root }, key);
    if (normalized !== key) throw new Error("Cleanup requires an exact storage key");
    await this.verifyRoot();
    const parts = key.split("/");
    let target = this.identity.root;
    for (const [index, part] of parts.entries()) {
      const existingParent = target;
      target = path.join(target, part);
      let info;
      try {
        info = await promises.lstat(target);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          await this.verifyAbsence(existingParent);
          return;
        }
        throw error;
      }
      if (info.isSymbolicLink()) throw new Error("Cleanup refuses symbolic links");
      if (index < parts.length - 1) {
        if (!info.isDirectory()) throw new Error("Storage key parent is not a directory");
      } else if (!info.isFile()) throw new Error("Cleanup target is not a regular file");
    }
    const parent = target.slice(0, target.lastIndexOf(path.sep));
    if (await promises.realpath(parent) !== parent) throw new Error("Storage path changed during cleanup");
    await this.verifyRoot();
    try {
      await promises.unlink(target);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    syncDirectory(parent);
  }
};

// src/storage/local/local-writer.ts
var LocalStorageWriteError = class extends Error {
  constructor(created, cause) {
    super(
      created ? "Storage write failed after file creation" : "Storage write failed before file creation",
      {
        cause
      }
    );
    this.created = created;
    this.name = "LocalStorageWriteError";
  }
  created;
};
var LocalStorageWriter = class _LocalStorageWriter {
  constructor(identity9) {
    this.identity = identity9;
  }
  identity;
  static async restore(identity9) {
    return new _LocalStorageWriter((await LocalStorageCleanup.restore(identity9)).identity);
  }
  async verifyRoot() {
    await LocalStorageCleanup.restore(this.identity);
  }
  async parentFor(key) {
    if (normalizeStorageReference({ kind: "local", root: this.identity.root }, key) !== key)
      throw new Error("Writing requires an exact storage key");
    await this.verifyRoot();
    let parent = this.identity.root;
    for (const part of key.split("/").slice(0, -1)) {
      const directory = path.join(parent, part);
      try {
        await promises.mkdir(directory, { mode: 448 });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      }
      const info = await promises.lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || await promises.realpath(directory) !== directory)
        throw new Error("Storage key parent is not a regular directory");
      syncDirectory(parent);
      parent = directory;
    }
    await this.verifyRoot();
    return parent;
  }
  async writeImmutable(key, body, signal) {
    let created = false;
    try {
      signal?.throwIfAborted();
      const parent = await this.parentFor(key);
      signal?.throwIfAborted();
      const target = path.join(this.identity.root, key);
      if (path.dirname(target) !== parent) throw new Error("Storage key parent changed");
      const file = await promises.open(target, "wx", 384);
      created = true;
      try {
        if (body instanceof stream.Readable) {
          await promises$2.pipeline(
            body,
            async (source) => {
              for await (const chunk of source) await file.writeFile(chunk, { signal });
            },
            { signal }
          );
        } else {
          await file.writeFile(body, { signal });
        }
        await file.sync();
        syncDirectory(parent);
        await this.verifyRoot();
      } finally {
        await file.close();
      }
    } catch (cause) {
      throw new LocalStorageWriteError(created, cause);
    }
  }
};
var cleanupIdentity = zod.z.string().min(1).max(200);
var cleanupDigest = zod.z.string().regex(/^[a-f0-9]{64}$/);
var counter = zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var cleanupTargetInput = zod.z.object({
  backendId: cleanupDigest,
  binding: cleanupDigest,
  key: zod.z.string().transform((key) => {
    validateStorageKey(key.endsWith("/") ? key.slice(0, -1) : key);
    return key;
  })
}).strict();
var cleanupCollector = zod.z.object({
  id: cleanupIdentity,
  kind: zod.z.enum(["references", "inventory"]),
  backendIds: zod.z.array(cleanupDigest).min(1).max(128),
  scope: zod.z.string().min(1).max(2e3),
  match: zod.z.enum(["prefix", "key"]).default("prefix")
}).strict().refine((value) => new Set(value.backendIds).size === value.backendIds.length).refine((value) => {
  if (value.kind === "references") return true;
  if (value.match === "prefix" && !value.scope.endsWith("/")) return false;
  try {
    validateStorageKey(value.scope.endsWith("/") ? value.scope.slice(0, -1) : value.scope);
    return true;
  } catch {
    return false;
  }
}, "Inventory requires an exact directory prefix");
var cleanupCollectorRecord = cleanupCollector.safeExtend({
  namespace: cleanupIdentity,
  jobId: zod.z.uuid(),
  verification: counter,
  cursor: zod.z.string().max(8192).nullable(),
  complete: zod.z.boolean()
});
var cleanupJob = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_cleanup"),
  namespace: cleanupIdentity,
  subjectId: cleanupIdentity,
  generation: counter,
  id: zod.z.uuid(),
  createdAt: counter,
  epoch: counter,
  phase: zod.z.enum(["preparing", "waiting", "collecting", "ready", "deleting", "verifying", "complete"]),
  drainCursor: zod.z.string().nullable(),
  pending: counter,
  deleted: counter,
  verification: counter,
  collectorCount: counter,
  inventoryCount: counter,
  remainingCollectors: counter,
  manifestCount: counter.default(0),
  unresolvedManifests: counter.default(0),
  retentionPolicy: zod.z.literal("job-id-snapshots-v1").optional()
}).strict();
var cleanupTarget = zod.z.object({
  schemaVersion: zod.z.literal(1),
  namespace: cleanupIdentity,
  jobId: zod.z.uuid(),
  id: cleanupDigest,
  binding: cleanupDigest,
  key: cleanupTargetInput.shape.key,
  backendIds: zod.z.array(cleanupDigest).min(1).max(128),
  status: zod.z.enum(["pending", "deleted"])
}).strict().refine((value) => new Set(value.backendIds).size === value.backendIds.length);
function cleanupHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function prepareStorageCleanup(input) {
  return cleanupJob.parse({
    ...input,
    schemaVersion: 1,
    kind: "storage_cleanup",
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    epoch: 0,
    phase: "preparing",
    drainCursor: null,
    pending: 0,
    deleted: 0,
    verification: 0,
    collectorCount: 0,
    inventoryCount: 0,
    remainingCollectors: 0
  });
}

// src/storage/cleanup/cleanup-collectors.ts
async function cleanupRows(database, dialect, prefix, after, limit = 100, cursorKind = "digest") {
  return sqlStateRows(database, dialect, prefix, after, limit, cursorKind);
}
var CleanupCollectors = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
  }
  database;
  dialect;
  namespace;
  prefix(jobId) {
    return `sd-i:1:${cleanupHash(this.namespace)}:${zod.z.uuid().parse(jobId)}:`;
  }
  id(jobId, id) {
    return `${this.prefix(jobId)}${cleanupHash(id)}`;
  }
  backend(id) {
    return sqlStateBackend(this.database, this.dialect, id);
  }
  registry() {
    return new StorageBackendRegistry(this.database, this.dialect, this.namespace);
  }
  indexId(jobId, binding3, prefix, match) {
    return `sd-p:1:${cleanupHash(this.namespace)}:${zod.z.uuid().parse(jobId)}:${cleanupHash(JSON.stringify([binding3, prefix, match]))}`;
  }
  parse(input, job, id) {
    const collector = cleanupCollectorRecord.parse(input);
    if (collector.namespace !== this.namespace || collector.jobId !== job.id || this.id(job.id, collector.id) !== id || collector.verification > job.verification)
      throw new Error("Storage cleanup collector identity mismatch");
    if (collector.verification < job.verification && collector.kind === "inventory") {
      collector.verification = job.verification;
      collector.cursor = null;
      collector.complete = false;
    }
    return collector;
  }
  async get(job, id) {
    const rowId = this.id(job.id, id);
    const row = await this.backend(rowId).read();
    if (!row) throw new Error("Storage cleanup collector is missing");
    return { collector: this.parse(row.state, job, rowId), revision: row.revision };
  }
  async list(job, after) {
    const rows = await cleanupRows(this.database, this.dialect, this.prefix(job.id), after);
    return {
      collectors: rows.map(
        (row) => this.parse(
          this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state,
          job,
          String(row.id)
        )
      ),
      cursor: rows.length === 100 ? String(rows.at(-1).id) : null
    };
  }
  async save(collector, revision) {
    if (!await this.backend(this.id(collector.jobId, collector.id)).compareAndSwap(revision, {
      revision: crypto.randomUUID(),
      state: cleanupCollectorRecord.parse(collector)
    }))
      throw new Error("Storage cleanup collector changed concurrently");
  }
  async register(job, input) {
    const collector = cleanupCollector.parse(input);
    const rowId = this.id(job.id, collector.id);
    const backend = this.backend(rowId);
    const previous = await backend.read();
    if (previous) {
      const stored = this.parse(previous.state, job, rowId);
      const original = {
        id: stored.id,
        kind: stored.kind,
        backendIds: stored.backendIds,
        scope: stored.scope,
        match: stored.match
      };
      if (JSON.stringify(original) !== JSON.stringify(collector))
        throw new Error("Storage cleanup collector scope is immutable");
      return false;
    }
    for (const id of collector.backendIds) {
      const registration = await this.registry().get(id);
      if (!registration) throw new Error("Storage backend descriptor is missing");
      if (collector.kind !== "inventory") continue;
      const indexId = this.indexId(job.id, registration.binding, collector.scope, collector.match);
      const index = this.backend(indexId);
      if (!await index.read() && !await index.compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: {
          namespace: this.namespace,
          jobId: job.id,
          binding: registration.binding,
          prefix: collector.scope,
          match: collector.match,
          collectorId: collector.id
        }
      }))
        throw new Error("Storage cleanup scope changed concurrently");
    }
    if (!await backend.compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: {
        ...collector,
        namespace: this.namespace,
        jobId: job.id,
        verification: 0,
        cursor: null,
        complete: false
      }
    }))
      throw new Error("Storage cleanup collector changed concurrently");
    return true;
  }
  async covers(job, target) {
    const scopes = [{ scope: target.key, match: "key" }];
    for (let index = target.key.indexOf("/"); index >= 0; index = target.key.indexOf("/", index + 1)) {
      scopes.push({ scope: target.key.slice(0, index + 1), match: "prefix" });
    }
    for (const { scope: prefix, match } of scopes) {
      const row = await this.backend(this.indexId(job.id, target.binding, prefix, match)).read();
      if (!row) continue;
      const value = zod.z.object({
        namespace: zod.z.string(),
        jobId: zod.z.uuid(),
        binding: zod.z.string(),
        prefix: zod.z.string(),
        match: zod.z.enum(["key", "prefix"]),
        collectorId: zod.z.string()
      }).strict().parse(row.state);
      if (value.namespace !== this.namespace || value.jobId !== job.id || value.binding !== target.binding || value.prefix !== prefix || value.match !== match)
        throw new Error("Storage cleanup scope identity mismatch");
      const { collector } = await this.get(job, value.collectorId);
      if (collector.kind !== "inventory" || collector.scope !== prefix || collector.match !== match)
        throw new Error("Storage cleanup scope does not match its collector");
      for (const id of collector.backendIds) {
        if ((await this.registry().get(id))?.binding === target.binding) return true;
      }
      throw new Error("Storage cleanup scope backend does not match");
    }
    return false;
  }
};

// src/storage/registry/reference-registry.ts
var identity3 = zod.z.string().min(1).max(200);
var digest2 = zod.z.string().regex(/^[a-f0-9]{64}$/);
var claimsSchema = zod.z.array(zod.z.object({ consumer: identity3, previousReference: zod.z.string().min(1).nullable() }).strict()).min(1).max(100);
var allocationSchema = zod.z.object({
  kind: zod.z.literal("storage_reference_allocation"),
  namespace: identity3,
  operationId: zod.z.uuid(),
  assetId: digest2,
  claims: claimsSchema
}).strict();
var referenceSchema = zod.z.object({
  namespace: identity3,
  operationId: zod.z.uuid(),
  reference: zod.z.string().min(1),
  localRoutePrefix: zod.z.string().min(1).optional(),
  target: zod.z.object({ backendId: digest2, binding: digest2, key: zod.z.string().transform(validateStorageKey) }).strict(),
  scopes: zod.z.array(zod.z.object({ subjectId: identity3, generation: zod.z.number().int().nonnegative() }).strict()).min(1)
}).strict();
var StorageReferenceConsumerMismatchError = class extends Error {
  constructor() {
    super("Storage reference does not belong to this consumer");
    this.name = "StorageReferenceConsumerMismatchError";
  }
};
var assetSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_asset"),
  id: digest2,
  prepared: referenceSchema,
  consumers: zod.z.array(identity3)
}).strict();
var aliasSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_reference_alias"),
  namespace: identity3,
  reference: zod.z.string().min(1),
  assetId: digest2
}).strict();
var retirementSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_reference_retirement"),
  namespace: identity3,
  operationId: zod.z.uuid(),
  consumer: identity3,
  previousReference: zod.z.string().min(1),
  replacementAssetId: digest2.nullable(),
  attribution: zod.z.object({ assetId: digest2, prepared: referenceSchema }).strict().nullable(),
  status: zod.z.enum(["pending", "unresolved"])
}).strict();
function hash2(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function assetId(prepared) {
  return hash2(JSON.stringify([prepared.target.binding, prepared.target.key]));
}
function storageSnapshotAttribution(input, namespace) {
  const kind = zod.z.object({ kind: zod.z.string() }).passthrough().parse(input).kind;
  if (kind === "storage_asset") {
    const asset = assetSchema.parse(input);
    return { assetId: asset.id, prepared: asset.prepared };
  }
  if (kind === "storage_reference_retirement") {
    const retirement = retirementSchema.parse(input);
    if (retirement.namespace !== namespace) throw new Error("Storage retirement namespace mismatch");
    return retirement.attribution;
  }
  throw new Error("Unsupported storage reference snapshot");
}
function prepareStorageReference(input) {
  return referenceSchema.parse(input);
}
function prepareStorageReferenceClaims(input) {
  const claims = claimsSchema.parse(input).sort((left, right) => left.consumer < right.consumer ? -1 : left.consumer > right.consumer ? 1 : 0);
  if (new Set(claims.map((value) => value.consumer)).size !== claims.length)
    throw new Error("Storage consumers must be distinct");
  return claims;
}
var StorageReferenceRegistry = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    identity3.parse(namespace);
    this.prefix = hash2(namespace);
  }
  database;
  dialect;
  namespace;
  prefix;
  backend(kind, id) {
    return sqlStateBackend(this.database, this.dialect, `sd-${kind}:1:${this.prefix}:${id}`);
  }
  validate(input) {
    const prepared = referenceSchema.parse(input);
    if (prepared.namespace !== this.namespace) throw new Error("Storage reference namespace mismatch");
    return prepared;
  }
  /** Validate captured cleanup attribution even after its asset row was erased. No access grant. */
  async validateRetainedAttribution(input) {
    const id = digest2.parse(input.assetId);
    const prepared = this.validate(input.prepared);
    if (assetId(prepared) !== id) throw new Error("Storage retained attribution identity mismatch");
    const backend = await this.validateBackend(prepared);
    return structuredClone({ assetId: id, prepared, backend });
  }
  /** Retained attribution remains readable after the last application consumer retires. */
  async readAsset(id) {
    digest2.parse(id);
    const row = await this.backend("asset", id).read();
    if (!row) return null;
    const asset = assetSchema.parse(row.state);
    this.validate(asset.prepared);
    if (asset.id !== id || assetId(asset.prepared) !== id) throw new Error("Storage asset identity mismatch");
    const backend = await this.validateBackend(asset.prepared);
    return structuredClone({ asset, backend });
  }
  /** Historical lookup does not grant current consumer ownership or application access. */
  async readReference(reference) {
    zod.z.string().min(1).parse(reference);
    const attributed = await this.attributed(reference);
    if (!attributed) return null;
    const backend = await this.validateBackend(attributed.asset.prepared);
    return structuredClone({ asset: attributed.asset, backend });
  }
  /** Immutable claims captured by the original replacement transaction. */
  async readAllocation(id) {
    digest2.parse(id);
    const row = await this.backend("allocation", id).read();
    if (!row) return null;
    const allocation2 = allocationSchema.parse(row.state);
    if (allocation2.namespace !== this.namespace || allocation2.assetId !== id)
      throw new Error("Storage allocation identity mismatch");
    prepareStorageReferenceClaims(allocation2.claims);
    return structuredClone(allocation2);
  }
  /** Exact replacement evidence. Unknown historical ownership stays explicitly unresolved. */
  async readRetirement(operationId, consumer) {
    zod.z.uuid().parse(operationId);
    identity3.parse(consumer);
    const row = await this.backend("retired", hash2(JSON.stringify([operationId, consumer]))).read();
    if (!row) return null;
    const retirement = retirementSchema.parse(row.state);
    if (retirement.namespace !== this.namespace || retirement.operationId !== operationId || retirement.consumer !== consumer)
      throw new Error("Storage retirement identity mismatch");
    if (retirement.attribution) {
      this.validate(retirement.attribution.prepared);
      if (assetId(retirement.attribution.prepared) !== retirement.attribution.assetId)
        throw new Error("Storage retirement attribution mismatch");
    }
    return structuredClone(retirement);
  }
  /**
   * Scan every page in the caller's Serializable snapshot before removing application rows.
   * Empty consumer lists remain discoverable: retirement does not erase asset ownership scopes.
   * The application determines which scopes belong to its deletion operation.
   */
  async listAssets(after = null) {
    const prefix = `sd-asset:1:${this.prefix}:`;
    const rows = await cleanupRows(this.database, this.dialect, prefix, after);
    const assets = rows.map((row) => {
      const asset = assetSchema.parse(this.decode(row.state));
      this.validate(asset.prepared);
      if (asset.id !== assetId(asset.prepared) || row.id !== `${prefix}${asset.id}`)
        throw new Error("Storage asset identity mismatch");
      return asset;
    });
    return { assets, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  /** Includes unresolved references with no asset row. Consumer ownership is application-defined. */
  async listRetirements(after = null) {
    const prefix = `sd-retired:1:${this.prefix}:`;
    const rows = await cleanupRows(this.database, this.dialect, prefix, after);
    const retirements = rows.map((row) => {
      const retirement = retirementSchema.parse(this.decode(row.state));
      const id = hash2(JSON.stringify([retirement.operationId, retirement.consumer]));
      if (retirement.namespace !== this.namespace || row.id !== `${prefix}${id}`)
        throw new Error("Storage retirement identity mismatch");
      if (retirement.attribution) {
        this.validate(retirement.attribution.prepared);
        if (retirement.attribution.assetId !== assetId(retirement.attribution.prepared))
          throw new Error("Storage retirement attribution mismatch");
      }
      return retirement;
    });
    return { retirements, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  decode(state) {
    return this.dialect === "sqlite" && typeof state === "string" ? JSON.parse(state) : state;
  }
  async attributed(reference) {
    const alias = await this.backend("alias", hash2(reference)).read();
    if (!alias) return null;
    const value = aliasSchema.parse(alias.state);
    if (value.namespace !== this.namespace || value.reference !== reference)
      throw new Error("Storage reference alias mismatch");
    const record = await this.backend("asset", value.assetId).read();
    if (!record) throw new Error("Storage reference attribution is missing");
    const asset = assetSchema.parse(record.state);
    this.validate(asset.prepared);
    if (asset.id !== value.assetId || assetId(asset.prepared) !== asset.id)
      throw new Error("Storage asset identity mismatch");
    return { record, asset };
  }
  async replace(input) {
    return this.replaceMany({
      consumers: [{ consumer: input.consumer, previousReference: input.previousReference }],
      next: input.next
    });
  }
  /** Resolve current consumer attribution in the caller's Serializable snapshot.
   * Unknown references require explicit adoption. This never grants application access.
   */
  async resolve(input) {
    const consumer = identity3.parse(input.consumer);
    const reference = zod.z.string().min(1).parse(input.reference);
    const attributed = await this.attributed(reference);
    if (!attributed) return null;
    const { asset } = attributed;
    const backend = await this.validateBackend(asset.prepared);
    if (!asset.consumers.includes(consumer)) throw new StorageReferenceConsumerMismatchError();
    return structuredClone({ assetId: asset.id, prepared: asset.prepared, backend });
  }
  async validateBackend(next) {
    const registered = await new StorageBackendRegistry(this.database, this.dialect, this.namespace).get(
      next.target.backendId
    );
    if (!registered || registered.binding !== next.target.binding)
      throw new Error("Storage reference backend is missing");
    const descriptor = registered.descriptor;
    const key = descriptor.kind === "local" ? normalizeStorageReference({ kind: "local", root: descriptor.referenceRoot }, next.reference, {
      localRoutePrefix: next.localRoutePrefix
    }) : normalizeStorageReference(descriptor.location, next.reference, {
      ...descriptor.publicUrl ? { publicUrl: descriptor.publicUrl } : {},
      publicUrlEncoding: descriptor.referenceEncoding
    });
    if (key !== next.target.key) throw new Error("Storage reference does not address its attributed key");
    return registered;
  }
  /** Allocate one immutable asset for all of its application references in the caller's transaction. */
  async replaceMany(input) {
    const replacements = prepareStorageReferenceClaims(input.consumers);
    const consumers = replacements.map((value) => value.consumer).sort();
    const next = this.validate(input.next);
    await this.validateBackend(next);
    const id = assetId(next);
    const assetBackend = this.backend("asset", id);
    const previousAsset = await assetBackend.read();
    const allocationBackend = this.backend("allocation", id);
    const allocation2 = allocationSchema.parse({
      kind: "storage_reference_allocation",
      namespace: this.namespace,
      operationId: next.operationId,
      assetId: id,
      claims: replacements
    });
    const priorAllocation = await allocationBackend.read();
    if (priorAllocation) {
      if (!util.isDeepStrictEqual(allocationSchema.parse(priorAllocation.state), allocation2))
        throw new Error("Storage allocation replacement claims changed");
    } else {
      if (previousAsset) throw new Error("Storage allocation replacement claims are missing");
      if (!await allocationBackend.compareAndSwap(null, { revision: crypto.randomUUID(), state: allocation2 }))
        throw new Error("Storage allocation claims changed concurrently");
    }
    if (previousAsset) {
      const existing = assetSchema.parse(previousAsset.state);
      if (!util.isDeepStrictEqual(existing.prepared, next) || !util.isDeepStrictEqual([...existing.consumers].sort(), consumers))
        throw new Error("Storage asset allocation is already in use");
    } else if (!await assetBackend.compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: assetSchema.parse({
        schemaVersion: 1,
        kind: "storage_asset",
        id,
        prepared: next,
        consumers
      })
    }))
      throw new Error("Storage asset allocation changed concurrently");
    const aliasBackend = this.backend("alias", hash2(next.reference));
    const previousAlias = await aliasBackend.read();
    const alias = aliasSchema.parse({
      schemaVersion: 1,
      kind: "storage_reference_alias",
      namespace: this.namespace,
      reference: next.reference,
      assetId: id
    });
    if (previousAlias) {
      if (JSON.stringify(aliasSchema.parse(previousAlias.state)) !== JSON.stringify(alias))
        throw new Error("Storage reference alias is already in use");
    } else if (!await aliasBackend.compareAndSwap(null, { revision: crypto.randomUUID(), state: alias }))
      throw new Error("Storage reference alias changed concurrently");
    for (const replacement of replacements) {
      if (replacement.previousReference === null || replacement.previousReference === next.reference)
        continue;
      await this.retireReference({
        operationId: next.operationId,
        consumer: replacement.consumer,
        previousReference: replacement.previousReference,
        replacementAssetId: id
      });
    }
  }
  /** Commit with removal of the application's reference, including selection of a bundled asset. */
  async retire(input) {
    await this.retireReference({
      operationId: zod.z.uuid().parse(input.operationId),
      consumer: identity3.parse(input.consumer),
      previousReference: zod.z.string().min(1).parse(input.previousReference),
      replacementAssetId: null
    });
  }
  async retireReference(input) {
    const { consumer } = input;
    const prior = await this.attributed(input.previousReference);
    const owned = prior?.asset.consumers.includes(consumer) ? prior : null;
    const retirement = retirementSchema.parse({
      schemaVersion: 1,
      kind: "storage_reference_retirement",
      namespace: this.namespace,
      operationId: input.operationId,
      consumer,
      previousReference: input.previousReference,
      replacementAssetId: input.replacementAssetId,
      attribution: owned ? { assetId: owned.asset.id, prepared: owned.asset.prepared } : null,
      status: owned ? "pending" : "unresolved"
    });
    const retirementBackend = this.backend("retired", hash2(JSON.stringify([input.operationId, consumer])));
    const existingRetirement = await retirementBackend.read();
    if (existingRetirement) {
      const existing = retirementSchema.parse(existingRetirement.state);
      if (existing.namespace !== this.namespace || existing.operationId !== input.operationId || existing.consumer !== consumer || existing.previousReference !== input.previousReference || existing.replacementAssetId !== input.replacementAssetId)
        throw new Error("Storage retirement identity mismatch");
      return;
    }
    if (owned) {
      const updated = {
        ...owned.asset,
        consumers: owned.asset.consumers.filter((value) => value !== consumer)
      };
      if (!await this.backend("asset", owned.asset.id).compareAndSwap(owned.record.revision, {
        revision: crypto.randomUUID(),
        state: updated
      }))
        throw new Error("Storage reference ownership changed concurrently");
    }
    if (!await retirementBackend.compareAndSwap(null, { revision: crypto.randomUUID(), state: retirement }))
      throw new Error("Storage retirement changed concurrently");
  }
};

// src/runtime/process/abort.ts
function abortable(work, signal) {
  return new Promise((resolve6, reject2) => {
    const aborted = () => reject2(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    work.then(resolve6, reject2).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}

// src/storage/local/owned-copy.ts
var StorageReadCleanupError = class extends Error {
  constructor(options) {
    super("Storage read cleanup could not be confirmed", options);
    this.name = "StorageReadCleanupError";
  }
};
async function copyOwnedBytesToFile(options) {
  const { openSource, destination, signal = new AbortController().signal } = options;
  const digest5 = crypto.createHash("sha256");
  let totalBytes = 0;
  signal.throwIfAborted();
  let source;
  let target;
  let reading;
  let writing;
  let primary;
  const settled = (work) => work?.then(
    () => void 0,
    () => void 0
  );
  try {
    source = Promise.resolve().then(openSource);
    const reader = await abortable(source, signal);
    signal.throwIfAborted();
    target = promises.open(destination, "wx", 384);
    const file = await abortable(target, signal);
    while (true) {
      signal.throwIfAborted();
      const next = reader.read();
      reading = next;
      const value = await abortable(next, signal);
      signal.throwIfAborted();
      if (value === null) break;
      if (!(value instanceof Uint8Array) || value.byteLength === 0)
        throw new Error("Storage source returned invalid bytes");
      const bytes = Uint8Array.from(value);
      if (!Number.isSafeInteger(totalBytes + bytes.byteLength))
        throw new Error("Storage copy byte count exceeds its safe integer limit");
      for (let offset = 0; offset < bytes.byteLength; ) {
        signal.throwIfAborted();
        const write = file.write(bytes, offset, bytes.byteLength - offset, null);
        writing = write;
        const { bytesWritten } = await abortable(write, signal);
        if (!Number.isSafeInteger(bytesWritten) || bytesWritten <= 0 || bytesWritten > bytes.byteLength - offset)
          throw new Error("Storage destination did not make valid write progress");
        offset += bytesWritten;
      }
      digest5.update(bytes);
      totalBytes += bytes.byteLength;
    }
  } catch (error) {
    primary = { error };
  }
  const sourceClose = source?.then(
    (reader) => reader.close(),
    () => void 0
  );
  const targetClose = target?.then(
    async (file) => {
      await settled(writing);
      await file.close();
    },
    () => void 0
  );
  const cleanup = Promise.allSettled([sourceClose, targetClose, settled(reading)]);
  let timer;
  let cleanupFailure;
  try {
    const results = await Promise.race([
      cleanup,
      new Promise((_, reject2) => {
        timer = setTimeout(() => reject2(new Error("Storage read cleanup timed out")), 1e3);
      })
    ]);
    const errors = results.flatMap(
      (result) => result.status === "rejected" ? [result.reason] : []
    );
    if (errors.length)
      cleanupFailure = { error: new AggregateError(errors, "Storage resources could not be closed") };
  } catch (error) {
    cleanupFailure = { error };
  } finally {
    clearTimeout(timer);
  }
  if (cleanupFailure) {
    const error = new StorageReadCleanupError({ cause: cleanupFailure.error });
    if (primary)
      throw new AggregateError([primary.error, error], "Storage read and cleanup failed", {
        cause: cleanupFailure.error
      });
    throw error;
  }
  if (primary) throw primary.error;
  signal.throwIfAborted();
  return { sha256: digest5.digest("hex"), bytes: totalBytes };
}

// src/storage/local/owned-readable.ts
function ownReadable(stream) {
  const failures = stream.errored ? [stream.errored] : [];
  let failureCount = failures.length;
  const onError = (error) => {
    if (failures.includes(error)) return;
    failureCount = Math.min(Number.MAX_SAFE_INTEGER, failureCount + 1);
    if (failures.length < 8) failures.push(error);
  };
  stream.on("error", onError);
  const closed = stream.closed ? Promise.resolve() : new Promise((resolve6) => stream.once("close", resolve6));
  let iterator;
  let closing;
  return {
    read: async () => {
      iterator ??= stream.iterator({ destroyOnReturn: false });
      const next = await iterator.next();
      if (next.done) return null;
      if (!(next.value instanceof Uint8Array)) throw new Error("Storage stream returned non-binary data");
      return next.value;
    },
    close: () => {
      closing ??= (async () => {
        try {
          stream.destroy();
        } catch (error) {
          onError(error);
        }
        await closed;
        await new Promise((resolve6) => process.nextTick(resolve6));
        stream.off("error", onError);
        if (failureCount)
          throw new AggregateError(
            failures,
            `Storage stream closure includes ${failureCount} unresolved errors`
          );
      })();
      return closing;
    }
  };
}
async function withOwnedReadables(streams, run) {
  const sources = [...new Set(streams)].map(ownReadable);
  let result;
  let primary;
  try {
    result = await run();
  } catch (error) {
    primary = { error };
  }
  const failures = [];
  const closing = Promise.all(
    sources.map(async (source) => {
      try {
        await source.close();
      } catch (error) {
        failures.push(error);
      }
    })
  );
  let timer;
  let cleanup;
  try {
    await Promise.race([
      closing,
      new Promise((_, reject2) => {
        timer = setTimeout(() => reject2(new Error("Storage stream cleanup timed out")), 1e3);
      })
    ]);
    if (failures.length) cleanup = { error: new AggregateError(failures, "Storage source closure failed") };
  } catch (error) {
    cleanup = { error: new AggregateError([...failures, error], "Storage source closure is unconfirmed") };
  } finally {
    clearTimeout(timer);
  }
  if (cleanup) {
    const error = new StorageReadCleanupError({ cause: cleanup.error });
    if (primary)
      throw new AggregateError([primary.error, error], "Storage operation and source cleanup failed", {
        cause: error
      });
    throw error;
  }
  if (primary) throw primary.error;
  return result;
}
async function copyOwnedReadableToFile(options) {
  const { openSource, destination, signal } = options;
  return copyOwnedBytesToFile({
    destination,
    signal,
    openSource: async () => ownReadable(await openSource())
  });
}

// src/storage/execution/write-set.ts
var errorBrand = /* @__PURE__ */ Symbol.for("thesidedoor.storage.reference-set.error");
var ReferenceSetError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
  [errorBrand] = true;
};
function isReferenceSetError(error) {
  return error instanceof Error && error[errorBrand] === true;
}
var name = zod.z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
var scope2 = zod.z.object({
  subjectId: zod.z.string().min(1).max(200),
  generation: zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();
async function writeReferenceSet(options) {
  const streams = options.artifacts.map((artifact) => artifact.body).filter((body) => body instanceof stream.Readable);
  return withOwnedReadables(streams, () => writeOwnedReferenceSet(options));
}
async function writeOwnedReferenceSet(options) {
  const verifyArtifact = options.verifyArtifact;
  try {
    zod.z.string().min(1).max(200).parse(options.namespace);
    if (options.artifacts.length < 1 || options.artifacts.length > 10)
      throw new ReferenceSetError("invalid", "A storage reference set requires between 1 and 10 artifacts");
    const artifacts = options.artifacts.map((artifact) => {
      name.parse(artifact.name);
      validateStorageKey(artifact.prefix);
      if (!/^[a-z0-9]{1,12}$/.test(artifact.extension) || !artifact.contentType.trim() || artifact.contentType.length > 200)
        throw new ReferenceSetError("invalid", "Invalid storage artifact metadata");
      return { ...artifact, operationId: crypto.randomUUID() };
    });
    if (new Set(artifacts.map((artifact) => artifact.name)).size !== artifacts.length)
      throw new ReferenceSetError("invalid", "Storage artifact names must be distinct");
    const streams = artifacts.map((artifact) => artifact.body).filter((body) => body instanceof stream.Readable);
    if (new Set(streams).size !== streams.length)
      throw new ReferenceSetError("invalid", "Each storage artifact must own a distinct stream");
    options.signal.throwIfAborted();
    const instance2 = (tx) => new StorageInstanceControl(options.executor(tx), options.dialect, options.namespace);
    const writes = (tx) => new StorageWriteJournal(options.executor(tx), options.dialect, options.namespace);
    const captured = await options.transaction(async (tx) => {
      const admission = structuredClone(await options.captureAdmission(tx));
      const current = await instance2(tx).read();
      const scopes = zod.z.array(scope2).min(2).max(1e3).parse(admission.scopes);
      if (admission.instanceId !== current.instanceId || new Set(scopes.map((item) => item.subjectId)).size !== scopes.length || !scopes.some((item) => item.subjectId === current.subjectId && item.generation === current.generation))
        throw new ReferenceSetError("conflict", "Storage admission does not match the current instance");
      return admission;
    });
    const claims = artifacts.map(
      (artifact) => prepareStorageReferenceClaims(artifact.consumers(structuredClone(captured.snapshot)))
    );
    const retirements = zod.z.array(
      zod.z.object({ consumer: zod.z.string().min(1).max(200), previousReference: zod.z.string().min(1).max(8192) }).strict()
    ).max(100).parse(options.retirements?.(structuredClone(captured.snapshot)) ?? []).map((entry) => ({ ...entry, operationId: crypto.randomUUID() }));
    const consumers = [
      ...claims.flatMap((group) => group.map((entry) => entry.consumer)),
      ...retirements.map((entry) => entry.consumer)
    ];
    if (new Set(consumers).size !== consumers.length)
      throw new ReferenceSetError(
        "invalid",
        "Storage consumers must be distinct across replacements and retirements"
      );
    if (consumers.some((consumer) => !consumer.trim()))
      throw new ReferenceSetError("conflict", "Storage consumers cannot be blank");
    const prepared = [];
    for (const [index, artifact] of artifacts.entries()) {
      options.signal.throwIfAborted();
      const writer = await artifact.captureWriter();
      const backend = prepareStorageBackend(options.namespace, writer.descriptor);
      const key = `${artifact.prefix}/${captured.instanceId}/${artifact.operationId}.${artifact.extension}`;
      const intents = captured.scopes.map(
        (item) => prepareStorageWrite({
          namespace: options.namespace,
          ...item,
          target: { backendId: backend.id, binding: backend.binding, key }
        })
      );
      prepared.push({ artifact, writer, backend, key, intents, consumers: claims[index] });
    }
    async function validate(tx, published2) {
      if (!published2) options.signal.throwIfAborted();
      await options.validateAdmission(
        tx,
        structuredClone(captured),
        published2 && Object.freeze({ ...published2 })
      );
      if (!published2) options.signal.throwIfAborted();
      if ((await instance2(tx).read()).instanceId !== captured.instanceId)
        throw new ReferenceSetError("conflict", "Storage instance changed during upload");
      for (const item of prepared)
        for (const intent of item.intents) await writes(tx).assertWritable(intent, intent.generation);
      if (!published2) options.signal.throwIfAborted();
    }
    await options.transaction(async (tx) => {
      const registry = new StorageBackendRegistry(options.executor(tx), options.dialect, options.namespace);
      for (const item of prepared) await registry.register(item.backend);
      await validate(tx);
      for (const item of prepared)
        for (const intent of item.intents)
          if (await writes(tx).begin(intent, intent.generation) !== "created")
            throw new ReferenceSetError("conflict", "Storage artifact operation has already started");
    });
    const urls = {};
    for (const [index, item] of prepared.entries()) {
      try {
        options.signal.throwIfAborted();
      } catch (error) {
        await settle(index, "not_created", error);
        throw error;
      }
      try {
        urls[item.artifact.name] = await item.writer.write(
          item.key,
          item.artifact.body,
          item.artifact.contentType,
          options.signal
        );
      } catch (error) {
        const outcome = item.backend.descriptor.kind === "local" && error instanceof LocalStorageWriteError ? error.created ? "unreferenced" : "not_created" : "uncertain";
        await settle(index, outcome, error);
        throw error;
      }
      if (verifyArtifact) {
        try {
          options.signal.throwIfAborted();
          await verifyArtifact(
            structuredClone({
              name: item.artifact.name,
              operationId: item.artifact.operationId,
              reference: urls[item.artifact.name],
              target: { backendId: item.backend.id, binding: item.backend.binding, key: item.key },
              descriptor: item.backend.descriptor
            }),
            options.signal
          );
          options.signal.throwIfAborted();
        } catch (error) {
          await settle(index, "unreferenced", error);
          throw error;
        }
      }
    }
    async function settle(failedIndex, failedOutcome, originalError) {
      await options.transaction(async (tx) => {
        for (const [index, item] of prepared.entries()) {
          const kind = index < failedIndex ? "unreferenced" : index === failedIndex ? failedOutcome : "not_created";
          for (const intent of item.intents) await writes(tx).finish(intent, { kind });
        }
      }).catch((settlementError) => {
        throw new AggregateError(
          [originalError, settlementError],
          "Storage failure settlement could not commit",
          { cause: originalError }
        );
      });
    }
    const published = Object.freeze({ ...urls });
    try {
      await options.transaction(async (tx) => {
        await validate(tx);
        const registry = new StorageReferenceRegistry(
          options.executor(tx),
          options.dialect,
          options.namespace
        );
        for (const item of prepared) {
          const reference = prepareStorageReference({
            namespace: options.namespace,
            operationId: item.artifact.operationId,
            reference: published[item.artifact.name],
            ...item.writer.localRoutePrefix ? { localRoutePrefix: item.writer.localRoutePrefix } : {},
            target: { backendId: item.backend.id, binding: item.backend.binding, key: item.key },
            scopes: [...captured.scopes]
          });
          await registry.replaceMany({ consumers: item.consumers, next: reference });
        }
        for (const retirement of retirements) await registry.retire(retirement);
        options.signal.throwIfAborted();
        await options.commit(tx, published, structuredClone(captured.snapshot));
        options.signal.throwIfAborted();
        for (const item of prepared)
          for (const intent of item.intents)
            if (await writes(tx).finish(intent, {
              kind: "referenced",
              currentGeneration: intent.generation
            }) !== "removed")
              throw new ReferenceSetError("conflict", "Storage ownership changed during publication");
        options.signal.throwIfAborted();
      });
    } catch (error) {
      const committed = await options.transaction(async (tx) => {
        const receipts = [];
        for (const item of prepared)
          for (const intent of item.intents) receipts.push(await writes(tx).completion(intent));
        if (receipts.every((receipt) => receipt === "referenced")) {
          await validate(tx, published);
          return true;
        }
        if (receipts.some((receipt) => receipt !== null))
          throw new Error("Storage set commit outcome is inconsistent");
        for (const item of prepared)
          for (const intent of item.intents) await writes(tx).finish(intent, { kind: "unreferenced" });
        return false;
      }).catch((recoveryError) => {
        throw new AggregateError(
          [error, recoveryError],
          "Storage publication outcome could not be reconciled",
          { cause: error }
        );
      });
      if (!committed) throw error;
    }
    return published;
  } finally {
    for (const artifact of options.artifacts) if (artifact.body instanceof stream.Readable) artifact.body.destroy();
  }
}

// src/runtime/process/json.ts
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

// src/storage/cleanup/cleanup-manifests.ts
var json = zod.z.json();
var MAX_MANIFEST_BYTES = 1024 * 1024;
var MANIFEST_LIMIT_ERROR = /* @__PURE__ */ Symbol.for("thesidedoor.storage.manifest-limit");
var StorageManifestLimitError = class extends Error {
  [MANIFEST_LIMIT_ERROR] = true;
  constructor() {
    super("Storage manifest exceeds its byte limit");
    this.name = "StorageManifestLimitError";
  }
};
function isStorageManifestLimitError(error) {
  return error instanceof Error && error[MANIFEST_LIMIT_ERROR] === true;
}
var entryResolution = zod.z.discriminatedUnion("kind", [
  zod.z.object({
    index: zod.z.number().int().min(0).max(99),
    kind: zod.z.literal("storage"),
    targets: zod.z.array(cleanupTargetInput).max(100),
    collectorIds: zod.z.array(cleanupIdentity).min(1).max(100).optional()
  }).strict(),
  zod.z.object({
    index: zod.z.number().int().min(0).max(99),
    kind: zod.z.literal("non_storage"),
    reason: zod.z.string().min(1).max(1e3)
  }).strict()
]);
var manifestResolution = zod.z.object({
  resolver: cleanupIdentity,
  entries: zod.z.array(entryResolution).min(1).max(100)
}).strict().refine(
  (resolution) => resolution.entries.every(
    (entry) => entry.kind !== "storage" || entry.targets.length + (entry.collectorIds?.length ?? 0) > 0
  ),
  "Storage resolution needs targets or inventory collectors"
).refine(
  (resolution) => resolution.entries.reduce(
    (total, entry) => total + (entry.kind === "storage" ? entry.targets.length + (entry.collectorIds?.length ?? 0) : 0),
    0
  ) <= 1e3,
  "Storage resolution exceeds its target and collector limit"
);
var manifestInput = zod.z.object({
  id: cleanupIdentity,
  entries: zod.z.array(json).min(1).max(100)
}).strict();
var manifestSchema = manifestInput.extend({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_cleanup_manifest"),
  namespace: cleanupIdentity,
  jobId: zod.z.uuid(),
  digest: zod.z.string().regex(/^[a-f0-9]{64}$/),
  resolution: manifestResolution.nullable()
});
function bounded(value) {
  const encoded = canonicalJson(json.parse(value));
  if (Buffer.byteLength(encoded) > MAX_MANIFEST_BYTES) throw new StorageManifestLimitError();
  return encoded;
}
function* prepareStorageManifestPages(groupId, input) {
  const group = cleanupHash(cleanupIdentity.parse(groupId));
  let entries = [];
  let bytes = 2;
  let page = 0;
  for (const value of input) {
    const entry = structuredClone(json.parse(value));
    const size = Buffer.byteLength(canonicalJson(entry));
    if (size + 2 > MAX_MANIFEST_BYTES) throw new StorageManifestLimitError();
    const separator = entries.length ? 1 : 0;
    if (entries.length === 100 || bytes + separator + size > MAX_MANIFEST_BYTES) {
      yield { id: `${group}:${page++}`, entries };
      entries = [];
      bytes = 2;
    }
    bytes += (entries.length ? 1 : 0) + size;
    entries.push(entry);
  }
  if (entries.length) yield { id: `${group}:${page}`, entries };
}
var CleanupManifests = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
  }
  database;
  dialect;
  namespace;
  prefix(job) {
    return `sd-m:1:${cleanupHash(this.namespace)}:${job.id}:`;
  }
  rowId(job, id) {
    return `${this.prefix(job)}${cleanupHash(cleanupIdentity.parse(id))}`;
  }
  backend(id) {
    return sqlStateBackend(this.database, this.dialect, id);
  }
  parse(job, rowId, input) {
    const page = manifestSchema.parse(input);
    if (page.namespace !== this.namespace || page.jobId !== job.id || rowId !== this.rowId(job, page.id) || page.digest !== cleanupHash(bounded(page.entries)))
      throw new Error("Storage manifest identity mismatch");
    if (page.resolution) this.validateResolution(page.entries.length, page.resolution);
    return page;
  }
  async get(job, id) {
    const rowId = this.rowId(job, id);
    const record = await this.backend(rowId).read();
    if (!record) throw new Error("Storage manifest is missing");
    return { page: this.parse(job, rowId, record.state), revision: record.revision };
  }
  async status(job, id) {
    const rowId = this.rowId(job, id);
    const record = await this.backend(rowId).read();
    if (!record) return null;
    return { resolved: this.parse(job, rowId, record.state).resolution !== null };
  }
  async register(job, input) {
    const page = manifestInput.parse(input);
    const encoded = bounded(page.entries);
    const rowId = this.rowId(job, page.id);
    const previous = await this.backend(rowId).read();
    if (previous) {
      const stored = this.parse(job, rowId, previous.state);
      if (bounded(stored.entries) !== encoded) throw new Error("Storage manifest payload is immutable");
      return false;
    }
    if (!await this.backend(rowId).compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: {
        ...page,
        schemaVersion: 1,
        kind: "storage_cleanup_manifest",
        namespace: this.namespace,
        jobId: job.id,
        digest: cleanupHash(encoded),
        resolution: null
      }
    }))
      throw new Error("Storage manifest changed concurrently");
    return true;
  }
  async list(job, after) {
    const rows = await cleanupRows(this.database, this.dialect, this.prefix(job), after, 2);
    return {
      pages: rows.slice(0, 1).map(
        (row) => this.parse(
          job,
          String(row.id),
          this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
        )
      ),
      cursor: rows.length > 1 ? String(rows[0].id) : null
    };
  }
  validateResolution(count, input) {
    const resolution = manifestResolution.parse(input);
    bounded(resolution);
    const indices = new Set(resolution.entries.map((entry) => entry.index));
    if (indices.size !== count || resolution.entries.length !== count || [...indices].some((index) => index >= count))
      throw new Error("Storage manifest resolution must account for every entry exactly once");
    return resolution;
  }
  async resolve(job, id, input) {
    const { page, revision } = await this.get(job, id);
    const resolution = this.validateResolution(page.entries.length, input);
    if (page.resolution) {
      if (bounded(page.resolution) !== bounded(resolution))
        throw new Error("Storage manifest resolution is immutable");
      return false;
    }
    if (!await this.backend(this.rowId(job, id)).compareAndSwap(revision, {
      revision: crypto.randomUUID(),
      state: { ...page, resolution }
    }))
      throw new Error("Storage manifest changed concurrently");
    return true;
  }
};
var retentionPolicy = "job-id-snapshots-v1";
var retentionStateSchema = zod.z.object({
  kind: zod.z.literal("job_retention"),
  policy: zod.z.literal(retentionPolicy),
  binding: zod.z.string().regex(/^[a-f0-9]{64}$/),
  phase: zod.z.enum(["backfill", "jobs", "complete"]),
  cursor: zod.z.uuid().nullable(),
  activeId: zod.z.uuid().nullable()
}).strict();
function retentionBinding(job) {
  return crypto.createHash("sha256").update(
    canonicalJson({
      id: job.id,
      namespace: job.namespace,
      subjectId: job.subjectId,
      generation: job.generation,
      policy: retentionPolicy
    })
  ).digest("hex");
}
function retentionBackend(database, dialect, namespace, id) {
  const digest5 = crypto.createHash("sha256").update(zod.z.string().min(1).max(200).parse(namespace)).digest("hex");
  return sqlStateBackend(database, dialect, `sd-jr:1:${digest5}:${zod.z.uuid().parse(id)}`);
}
var identity4 = zod.z.string().min(1).max(200);
var metadataSchema = zod.z.object({
  kind: zod.z.literal("snapshot"),
  binding: identity4,
  pages: zod.z.number().int().nonnegative().safe(),
  sealed: zod.z.boolean(),
  erasureCursor: zod.z.number().int().nonnegative().safe().optional(),
  erased: zod.z.boolean().optional()
}).strict();
var pageSchema = zod.z.object({
  kind: zod.z.literal("snapshot_page"),
  binding: identity4,
  index: zod.z.number().int().nonnegative().safe(),
  items: zod.z.array(zod.z.json()).min(1).max(100)
}).strict();
var JobSnapshot = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.prefix = `sd-js:1:${crypto.createHash("sha256").update(identity4.parse(namespace)).digest("hex")}:`;
  }
  database;
  dialect;
  prefix;
  backend(id, page) {
    const suffix = page === void 0 ? "meta" : String(zod.z.number().int().nonnegative().safe().parse(page));
    return sqlStateBackend(this.database, this.dialect, `${this.prefix}${zod.z.uuid().parse(id)}:${suffix}`);
  }
  async metadata(id, binding3) {
    identity4.parse(binding3);
    const row = await this.backend(id).read();
    if (!row) throw new Error("Snapshot is missing");
    const state = metadataSchema.parse(row.state);
    if (state.binding !== binding3) throw new Error("Snapshot binding mismatch");
    if ((state.erasureCursor ?? 0) > state.pages || state.erased && state.pages !== 0)
      throw new Error("Snapshot erasure cursor is invalid");
    return { row, state };
  }
  async create(id, binding3) {
    const backend = this.backend(id);
    const state = metadataSchema.parse({ kind: "snapshot", binding: binding3, pages: 0, sealed: false });
    if (!await backend.compareAndSwap(null, { revision: crypto.randomUUID(), state }))
      throw new Error("Snapshot identity already exists");
  }
  /** The retention policy fixes snapshot identity to its owning job, with no independent ID. */
  async createForJob(job) {
    const owner = zod.z.object({ id: zod.z.uuid(), fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(job);
    await this.create(owner.id, owner.fingerprint);
  }
  async append(id, binding3, index, items) {
    const page = pageSchema.parse({ kind: "snapshot_page", binding: binding3, index, items });
    if (Buffer.byteLength(canonicalJson(page)) > 1048576) throw new Error("Snapshot page exceeds one MiB");
    const { row, state } = await this.metadata(id, binding3);
    if (state.erasureCursor !== void 0 || state.erased) throw new Error("Snapshot is being erased");
    if (state.sealed || state.pages !== index) throw new Error("Snapshot page is not the next writable page");
    if (!await this.backend(id, index).compareAndSwap(null, { revision: crypto.randomUUID(), state: page }))
      throw new Error("Snapshot page already exists");
    if (!await this.backend(id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...state, pages: state.pages + 1 }
    }))
      throw new Error("Concurrent snapshot append; retry the complete transaction");
  }
  async seal(id, binding3) {
    const { row, state } = await this.metadata(id, binding3);
    if (state.erasureCursor !== void 0 || state.erased) throw new Error("Snapshot is being erased");
    if (!state.sealed && !await this.backend(id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...state, sealed: true }
    }))
      throw new Error("Concurrent snapshot seal; retry the complete transaction");
    return state.pages;
  }
  async read(id, binding3, index) {
    zod.z.number().int().nonnegative().safe().parse(index);
    const { state } = await this.metadata(id, binding3);
    if (state.erasureCursor !== void 0 || state.erased) throw new Error("Snapshot is being erased");
    if (!state.sealed) throw new Error("Snapshot is not sealed");
    if (index >= state.pages) return { items: [], pages: state.pages, next: null };
    const row = await this.backend(id, index).read();
    if (!row) throw new Error("Sealed snapshot page is missing");
    const page = pageSchema.parse(row.state);
    if (Buffer.byteLength(canonicalJson(page)) > 1048576) throw new Error("Snapshot page exceeds one MiB");
    if (page.binding !== binding3 || page.index !== index) throw new Error("Snapshot page identity mismatch");
    return { items: page.items, pages: state.pages, next: index + 1 < state.pages ? index + 1 : null };
  }
  /**
   * Caller must prove authorization and exact parent binding before each transaction.
   * Deletes at most ten pages atomically with the cursor. Captured worker memory is not
   * revoked; workers must still recheck deletion admission before committing effects.
   */
  async eraseNext(id, binding3) {
    identity4.parse(binding3);
    const backend = this.backend(id);
    if (!await backend.read()) {
      if (!await backend.compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: { kind: "snapshot", binding: binding3, pages: 0, sealed: true, erasureCursor: 0, erased: true }
      }))
        throw new Error("Concurrent snapshot creation; retry the complete transaction");
      return { complete: true };
    }
    const { row, state } = await this.metadata(id, binding3);
    if (state.erased) return { complete: true };
    const end = Math.min(state.pages, (state.erasureCursor ?? 0) + 10);
    const p = this.dialect === "postgres" ? "$1" : "?";
    for (let page = state.erasureCursor ?? 0; page < end; page++) {
      await this.database.query(`DELETE FROM "SidedoorState" WHERE "id" = ${p} RETURNING "id"`, [
        `${this.prefix}${zod.z.uuid().parse(id)}:${page}`
      ]);
    }
    const complete = end === state.pages;
    const next = complete ? { kind: "snapshot", binding: binding3, pages: 0, sealed: true, erasureCursor: 0, erased: true } : { ...state, erasureCursor: end };
    if (!await this.backend(id).compareAndSwap(row.revision, { revision: crypto.randomUUID(), state: next }))
      throw new Error("Concurrent snapshot erasure; retry the complete transaction");
    return { complete };
  }
};
var identity5 = zod.z.object({
  root: zod.z.string().min(1),
  device: zod.z.string().regex(/^\d+$/),
  inode: zod.z.string().regex(/^\d+$/),
  binding: zod.z.string().min(1)
}).strict();
var executionWorkspacePlanSchema = zod.z.object({
  locationId: zod.z.uuid(),
  executionId: zod.z.uuid(),
  root: identity5
}).strict();
var executionWorkspaceSchema = executionWorkspacePlanSchema.extend({
  directory: identity5
}).strict().refine((value) => value.directory.root === path.join(value.root.root, `execution-${value.executionId}`), {
  message: "Execution workspace directory identity mismatch"
});
async function planExecutionWorkspace(root, locationId, executionId) {
  return executionWorkspacePlanSchema.parse({
    locationId,
    executionId,
    root: (await LocalStorageCleanup.capture(root)).identity
  });
}
function workspacePath(plan) {
  return path.join(plan.root.root, `execution-${plan.executionId}`);
}
async function createExecutionWorkspace(input) {
  const plan = executionWorkspacePlanSchema.parse(input);
  await LocalStorageCleanup.restore(plan.root);
  const path = workspacePath(plan);
  await promises.mkdir(path, { mode: 448 });
  const directory = (await LocalStorageCleanup.capture(path)).identity;
  if (directory.root !== path) throw new Error("Execution workspace path changed during creation");
  await LocalStorageCleanup.restore(plan.root);
  syncDirectory(plan.root.root);
  return { ...plan, directory };
}
async function recoverExecutionWorkspace(input, locationId) {
  const plan = executionWorkspacePlanSchema.parse(input);
  if (zod.z.uuid().parse(locationId) !== plan.locationId)
    throw new Error("Execution workspace belongs to another location");
  await LocalStorageCleanup.restore(plan.root);
  const path = workspacePath(plan);
  let info;
  try {
    info = await promises.lstat(path, { bigint: true });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    syncDirectory(plan.root.root);
    await LocalStorageCleanup.restore(plan.root);
    return null;
  }
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Execution workspace is not a regular directory");
  const directory = (await LocalStorageCleanup.capture(path)).identity;
  if (directory.root !== path || directory.device !== String(info.dev) || directory.inode !== String(info.ino))
    throw new Error("Execution workspace changed during recovery");
  await LocalStorageCleanup.restore(plan.root);
  return { ...plan, directory };
}
async function removeExecutionWorkspace(input, locationId) {
  const workspace = executionWorkspaceSchema.parse(input);
  if (zod.z.uuid().parse(locationId) !== workspace.locationId)
    throw new Error("Execution workspace belongs to another location");
  const path = workspacePath(workspace);
  if (workspace.directory.root !== path) throw new Error("Execution workspace directory identity mismatch");
  await LocalStorageCleanup.restore(workspace.root);
  try {
    await promises.lstat(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    syncDirectory(workspace.root.root);
    await LocalStorageCleanup.restore(workspace.root);
    return;
  }
  await LocalStorageCleanup.restore(workspace.directory);
  await promises.rm(path, { recursive: true });
  syncDirectory(workspace.root.root);
  await LocalStorageCleanup.restore(workspace.root);
}

// src/runtime/jobs/execution-journal.ts
var digest3 = zod.z.string().regex(/^[a-f0-9]{64}$/);
var binding2 = zod.z.object({
  id: zod.z.uuid(),
  parentId: zod.z.uuid(),
  fingerprint: digest3,
  executorId: zod.z.uuid()
}).strict();
var recordSchema = binding2.extend({
  kind: zod.z.literal("job_execution"),
  scopeDigests: zod.z.array(digest3).min(1).max(100),
  status: zod.z.enum(["active", "cleanup-unconfirmed", "settled"]),
  workspace: zod.z.union([executionWorkspaceSchema, executionWorkspacePlanSchema]).optional()
}).strict();
var gateSchema = zod.z.object({ id: zod.z.uuid(), fingerprint: digest3, settled: zod.z.boolean() }).strict();
var hash3 = (value) => crypto.createHash("sha256").update(value).digest("hex");
var JobExecutionAdmissionConflict = class extends Error {
  constructor(message) {
    super(message);
    this.name = "JobExecutionAdmissionConflict";
  }
};
var JobExecutionJournal = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.prefix = hash3(zod.z.string().min(1).max(200).parse(namespace));
  }
  database;
  dialect;
  namespace;
  prefix;
  backend(id) {
    return sqlStateBackend(this.database, this.dialect, `sd-je:1:${this.prefix}:${zod.z.uuid().parse(id)}`);
  }
  gate(parentId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-jeg:1:${this.prefix}:${zod.z.uuid().parse(parentId)}`
    );
  }
  scopePrefix(scopeDigest) {
    return `sd-jes:1:${this.prefix}:${digest3.parse(scopeDigest)}:`;
  }
  async owned(input) {
    const expected = binding2.parse(input);
    const row = await this.backend(expected.id).read();
    if (!row) throw new Error("Execution does not exist");
    const record = recordSchema.parse(row.state);
    if (canonicalJson(
      binding2.parse({
        id: record.id,
        parentId: record.parentId,
        fingerprint: record.fingerprint,
        executorId: record.executorId
      })
    ) !== canonicalJson(expected))
      throw new Error("Execution identity mismatch");
    return { row, record };
  }
  async begin(input, workspaceInput) {
    const captured = binding2.parse(input);
    const workspace = workspaceInput === void 0 ? void 0 : executionWorkspacePlanSchema.parse(workspaceInput);
    if (workspace && workspace.executionId !== captured.id)
      throw new Error("Execution workspace identity mismatch");
    const parent = await new JobOutbox(this.database, this.dialect, this.namespace).read(captured.parentId);
    if (!parent || parent.complete || parent.fingerprint !== captured.fingerprint)
      throw new Error("Execution requires matching pending work");
    const writes = new StorageWriteJournal(this.database, this.dialect, this.namespace);
    for (const scope5 of parent.job.scopes)
      if (await writes.tombstone(scope5.subjectId)) throw new Error("Execution scope is being erased");
    const gate = this.gate(captured.parentId);
    const prior = await gate.read();
    if (prior) {
      const state = gateSchema.parse(prior.state);
      if (state.fingerprint !== captured.fingerprint) throw new Error("Execution parent identity mismatch");
      if (!state.settled) throw new JobExecutionAdmissionConflict("Previous execution cleanup is unresolved");
    }
    const record = {
      ...captured,
      kind: "job_execution",
      scopeDigests: parent.job.scopes.map((scope5) => hash3(canonicalJson(scope5))),
      status: "active",
      ...workspace ? { workspace } : {}
    };
    if (!await this.backend(captured.id).compareAndSwap(null, { revision: crypto.randomUUID(), state: record }))
      throw new Error("Execution identity already exists");
    if (!await gate.compareAndSwap(prior?.revision ?? null, {
      revision: crypto.randomUUID(),
      state: { id: captured.id, fingerprint: captured.fingerprint, settled: false }
    }))
      throw new JobExecutionAdmissionConflict(
        "Concurrent execution admission; retry the complete transaction"
      );
    for (const scopeDigest of record.scopeDigests) {
      const index = sqlStateBackend(
        this.database,
        this.dialect,
        `${this.scopePrefix(scopeDigest)}${record.id}`
      );
      if (!await index.compareAndSwap(null, { revision: crypto.randomUUID(), state: captured }))
        throw new Error("Execution scope index already exists");
    }
    return structuredClone(record);
  }
  async read(input) {
    return (await this.owned(input)).record;
  }
  /** Attach only the identity created from the admitted intent, before any child effects. */
  async attachWorkspace(input, workspaceInput) {
    const workspace = executionWorkspaceSchema.parse(workspaceInput);
    const { row, record } = await this.owned(input);
    if (record.status !== "active" || !record.workspace)
      throw new Error("Execution workspace is not pending");
    const plan = {
      locationId: workspace.locationId,
      executionId: workspace.executionId,
      root: workspace.root
    };
    const previous = record.workspace;
    if (canonicalJson(plan) !== canonicalJson({
      locationId: previous.locationId,
      executionId: previous.executionId,
      root: previous.root
    }))
      throw new Error("Execution workspace intent changed");
    if ("directory" in previous) {
      if (canonicalJson(previous) !== canonicalJson(workspace))
        throw new Error("Execution workspace directory changed");
      return;
    }
    if (!await this.backend(record.id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...record, workspace }
    }))
      throw new Error("Concurrent workspace attachment; retry the complete transaction");
  }
  /**
   * Record verified removal only after the exact executor and its I/O have stopped.
   * After a lost commit response, read the exact execution: absent workspace confirms
   * release. Do not blindly replay this operation or recapture an attached identity.
   */
  async releaseWorkspace(input, expectedInput) {
    const expected = zod.z.union([executionWorkspaceSchema, executionWorkspacePlanSchema]).parse(expectedInput);
    const { row, record } = await this.owned(input);
    if (expected.executionId !== record.id) throw new Error("Execution workspace identity mismatch");
    if (!record.workspace) throw new Error("Execution workspace is not pending");
    if (canonicalJson(record.workspace) !== canonicalJson(expected))
      throw new Error("Execution workspace identity mismatch");
    const next = { ...record };
    delete next.workspace;
    if (!await this.backend(record.id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: next
    }))
      throw new Error("Concurrent workspace release; retry the complete transaction");
  }
  async markCleanupUnconfirmed(input) {
    const { row, record } = await this.owned(input);
    if (record.status === "settled") throw new Error("Settled execution cannot become uncertain");
    if (record.status === "cleanup-unconfirmed") return;
    if (!await this.backend(record.id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...record, status: "cleanup-unconfirmed" }
    }))
      throw new Error("Concurrent execution update; retry the complete transaction");
  }
  /**
   * Call only after all owned processes, streams and temporary resources have settled.
   * Recovery callers must verify the exact supervisor instance and containment scope.
   * Local cancellation alone does not establish remote provider termination.
   */
  async settle(input) {
    const { row, record } = await this.owned(input);
    if (record.workspace) throw new Error("Execution workspace cleanup is unresolved");
    if (record.status === "settled") return;
    const gate = this.gate(record.parentId);
    const previous = await gate.read();
    if (!previous) throw new Error("Execution parent gate is missing");
    const state = gateSchema.parse(previous.state);
    if (state.id !== record.id || state.fingerprint !== record.fingerprint || state.settled)
      throw new Error("Execution parent gate changed");
    if (!await this.backend(record.id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...record, status: "settled" }
    }))
      throw new Error("Concurrent execution settlement; retry the complete transaction");
    if (!await gate.compareAndSwap(previous.revision, {
      revision: crypto.randomUUID(),
      state: { ...state, settled: true }
    }))
      throw new Error("Concurrent execution settlement; retry the complete transaction");
    const p = this.dialect === "postgres" ? "$1" : "?";
    for (const scopeDigest of record.scopeDigests)
      await this.database.query(`DELETE FROM "SidedoorState" WHERE "id" = ${p} RETURNING "id"`, [
        `${this.scopePrefix(scopeDigest)}${record.id}`
      ]);
  }
  async requireParentDrained(parentId, fingerprint) {
    digest3.parse(fingerprint);
    const row = await this.gate(parentId).read();
    if (!row) return;
    const state = gateSchema.parse(row.state);
    if (state.fingerprint !== fingerprint) throw new Error("Execution parent identity mismatch");
    if (!state.settled) throw new Error("Execution cleanup is unresolved");
  }
  async blockingStatus(parentId, fingerprint) {
    digest3.parse(fingerprint);
    const gate = await this.gate(parentId).read();
    if (!gate) return null;
    const state = gateSchema.parse(gate.state);
    if (state.fingerprint !== fingerprint) throw new Error("Execution parent identity mismatch");
    if (state.settled) return null;
    const row = await this.backend(state.id).read();
    if (!row) throw new Error("Execution parent gate references a missing execution");
    const record = recordSchema.parse(row.state);
    if (record.parentId !== parentId || record.fingerprint !== fingerprint)
      throw new Error("Execution parent gate conflicts with execution");
    if (record.status === "settled") throw new Error("Execution parent gate is unresolved after settlement");
    return record.status;
  }
  /** Bounded scan across attempts. Retry and deletion admission must check all relevant scopes. */
  async listUnresolved(scope5, after = null) {
    const captured = zod.z.object({ subjectId: zod.z.string().min(1).max(200), generation: zod.z.number().int().nonnegative().safe() }).strict().parse(scope5);
    const scopeDigest = hash3(canonicalJson(captured));
    const prefix = this.scopePrefix(scopeDigest);
    const rows = await sqlStateRows(
      this.database,
      this.dialect,
      prefix,
      after === null ? null : `${prefix}${zod.z.uuid().parse(after)}`,
      100,
      "uuid"
    );
    const executions = [];
    for (const row of rows) {
      const entry = binding2.parse(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
      );
      if (row.id !== `${prefix}${entry.id}`) throw new Error("Execution scope index identity mismatch");
      const record = await this.read(entry);
      if (record.status === "settled" || !record.scopeDigests.includes(scopeDigest))
        throw new Error("Execution scope index conflicts with execution");
      executions.push(record);
    }
    return { executions, cursor: executions.length === 100 ? executions.at(-1).id : null };
  }
};

// src/storage/probe-errors.ts
var StorageProbeCleanupError = class extends AggregateError {
  constructor(cleanupJobId, errors, message) {
    super(errors, `${message} (${cleanupJobId})`, { cause: errors[0] });
    this.cleanupJobId = cleanupJobId;
    this.name = "StorageProbeCleanupError";
  }
  cleanupJobId;
};
var identity6 = zod.z.string().min(1).max(200);
var scope3 = zod.z.object({ subjectId: identity6, generation: zod.z.number().int().nonnegative().safe() }).strict();
var jobSchema = zod.z.object({
  id: zod.z.uuid(),
  namespace: identity6,
  handler: identity6,
  version: zod.z.number().int().positive().safe(),
  payload: zod.z.json(),
  scopes: zod.z.array(scope3).min(1).max(100),
  delivery: zod.z.object({
    attempts: zod.z.number().int().min(1).max(100),
    priority: zod.z.number().int().min(0).max(2097152),
    availableAt: zod.z.number().int().nonnegative().safe()
  }).strict()
}).strict();
var recordSchema2 = zod.z.object({
  kind: zod.z.literal("outbox_job"),
  job: jobSchema,
  fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/),
  delivered: zod.z.boolean(),
  complete: zod.z.boolean()
}).strict();
var pendingSchema = zod.z.object({
  kind: zod.z.literal("outbox_pending"),
  namespace: identity6,
  id: zod.z.uuid(),
  fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var erasedSchema = zod.z.object({
  kind: zod.z.literal("outbox_erased"),
  namespace: identity6,
  id: zod.z.uuid(),
  handler: identity6,
  version: zod.z.number().int().positive().safe(),
  fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/),
  scopeDigests: zod.z.array(zod.z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(100)
}).strict();
var JobErasedError = class extends Error {
  constructor(receipt) {
    super("Job payload was erased");
    this.receipt = receipt;
    this.name = "JobErasedError";
  }
  receipt;
};
function hash4(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function prepareJob(input) {
  const job = jobSchema.parse({ ...input, id: input.id ?? crypto.randomUUID() });
  if (new Set(job.scopes.map((item) => item.subjectId)).size !== job.scopes.length)
    throw new Error("Job scopes must have distinct subjects");
  if (Buffer.byteLength(canonicalJson(job)) > 1048576) throw new Error("Job exceeds the one MiB limit");
  return structuredClone(job);
}
var JobOutbox = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.prefix = hash4(identity6.parse(namespace));
  }
  database;
  dialect;
  namespace;
  prefix;
  key(id, index = null) {
    return `sd-${index === "pending" ? "jp" : index === "incomplete" ? "ji" : "j"}:1:${this.prefix}:${zod.z.uuid().parse(id)}`;
  }
  backend(id) {
    return sqlStateBackend(this.database, this.dialect, this.key(id));
  }
  scopePrefix(subjectId, generation3) {
    const validated = scope3.parse({ subjectId, generation: generation3 });
    return `sd-jsc:1:${this.prefix}:${hash4(canonicalJson(validated))}:`;
  }
  validate(job) {
    const prepared = prepareJob(job);
    if (prepared.namespace !== this.namespace) throw new Error("Job namespace mismatch");
    return prepared;
  }
  parse(value, id) {
    const erased = erasedSchema.safeParse(value);
    if (erased.success) {
      if (erased.data.namespace !== this.namespace || erased.data.id !== id)
        throw new Error("Erased job identity mismatch");
      throw new JobErasedError(erased.data);
    }
    const record = recordSchema2.parse(value);
    this.validate(record.job);
    if (record.job.id !== id || hash4(canonicalJson(record.job)) !== record.fingerprint)
      throw new Error("Job identity mismatch");
    return record;
  }
  async read(id) {
    const row = await this.backend(id).read();
    return row ? this.parse(row.state, id) : null;
  }
  /** Parent cancellation is terminal, but never evidence that its application work succeeded. */
  async readParent(id, expected) {
    const contract = zod.z.object({
      fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/),
      handler: identity6,
      version: zod.z.number().int().positive().safe(),
      scopes: zod.z.array(scope3).min(1).max(100)
    }).strict().parse(expected);
    if (new Set(contract.scopes.map((item) => item.subjectId)).size !== contract.scopes.length)
      throw new Error("Parent scopes must have distinct subjects");
    let record;
    try {
      record = await this.read(id);
    } catch (error) {
      if (!(error instanceof JobErasedError)) throw error;
      const receipt = error.receipt;
      if (receipt.fingerprint !== contract.fingerprint || receipt.handler !== contract.handler || receipt.version !== contract.version || canonicalJson([...receipt.scopeDigests].sort()) !== canonicalJson(contract.scopes.map((item) => hash4(canonicalJson(item))).sort()))
        throw new Error("Erased parent does not match expected work", { cause: error });
      return { status: "erased" };
    }
    if (!record || record.fingerprint !== contract.fingerprint || record.job.handler !== contract.handler || record.job.version !== contract.version || canonicalJson([...record.job.scopes].sort((a, b) => a.subjectId.localeCompare(b.subjectId))) !== canonicalJson([...contract.scopes].sort((a, b) => a.subjectId.localeCompare(b.subjectId))))
      throw new Error("Parent does not match expected work");
    return { status: record.complete ? "complete" : "pending", record };
  }
  /** A terminal erased receipt is distinct from successful application completion. */
  async receipt(id) {
    try {
      const record = await this.read(id);
      if (!record) return null;
      return {
        status: record.complete ? "complete" : "pending",
        id: record.job.id,
        handler: record.job.handler,
        version: record.job.version,
        fingerprint: record.fingerprint
      };
    } catch (error) {
      if (!(error instanceof JobErasedError)) throw error;
      return {
        status: "erased",
        id: error.receipt.id,
        handler: error.receipt.handler,
        version: error.receipt.version,
        fingerprint: error.receipt.fingerprint
      };
    }
  }
  /** Caller must drain writers and cancel dependent work before erasing retained payloads. */
  async erase(id, fingerprint, captured) {
    scope3.parse(captured);
    await new JobExecutionJournal(this.database, this.dialect, this.namespace).requireParentDrained(
      id,
      fingerprint
    );
    const tombstone = await new StorageWriteJournal(this.database, this.dialect, this.namespace).tombstone(
      captured.subjectId
    );
    if (!tombstone || tombstone.generation !== captured.generation)
      throw new Error("Job payload erasure requires matching deletion admission");
    const deletion = await new StorageCleanupJournal(this.database, this.dialect, this.namespace).get(
      tombstone.jobId
    );
    if (deletion.subjectId !== captured.subjectId || deletion.generation !== captured.generation || deletion.namespace !== this.namespace)
      throw new Error("Job payload erasure cleanup identity mismatch");
    const backend = this.backend(id);
    const row = await backend.read();
    if (!row) throw new Error("Job does not exist");
    let record;
    try {
      record = this.parse(row.state, id);
    } catch (error) {
      if (!(error instanceof JobErasedError)) throw error;
      if (error.receipt.fingerprint !== fingerprint || !error.receipt.scopeDigests.includes(hash4(canonicalJson(captured))))
        throw new Error("Erased job acknowledgement identity mismatch", { cause: error });
      return;
    }
    if (!record.complete || record.fingerprint !== fingerprint || !record.job.scopes.some(
      (item) => item.subjectId === captured.subjectId && item.generation === captured.generation
    ))
      throw new Error("Job payload erasure requires matching completed work");
    const erased = {
      kind: "outbox_erased",
      namespace: this.namespace,
      id,
      fingerprint,
      handler: record.job.handler,
      version: record.job.version,
      scopeDigests: record.job.scopes.map((item) => hash4(canonicalJson(item)))
    };
    if (!await backend.compareAndSwap(row.revision, { revision: crypto.randomUUID(), state: erased }))
      throw new Error("Concurrent job erasure; retry the complete transaction");
    const p = this.dialect === "postgres" ? "$1" : "?";
    for (const index of ["pending", "incomplete"])
      await this.database.query(`DELETE FROM "SidedoorState" WHERE "id" = ${p} RETURNING "id"`, [
        this.key(id, index)
      ]);
  }
  async enqueue(input) {
    const job = this.validate(input);
    const fingerprint = hash4(canonicalJson(job));
    const backend = this.backend(job.id);
    const existing = await backend.read();
    if (existing) {
      let record2;
      try {
        record2 = this.parse(existing.state, job.id);
      } catch (error) {
        if (!(error instanceof JobErasedError)) throw error;
        if (error.receipt.fingerprint !== fingerprint)
          throw new Error("Job operation was already used for different work", { cause: error });
        throw error;
      }
      if (record2.fingerprint !== fingerprint)
        throw new Error("Job operation was already used for different work");
      return record2;
    }
    const writes = new StorageWriteJournal(this.database, this.dialect, this.namespace);
    for (const captured of job.scopes)
      if (await writes.tombstone(captured.subjectId)) throw new Error("Job scope is being erased");
    const record = { kind: "outbox_job", job, fingerprint, delivered: false, complete: false };
    if (!await backend.compareAndSwap(null, { revision: crypto.randomUUID(), state: record }))
      throw new Error("Concurrent job enqueue; retry the complete transaction");
    const pending = { kind: "outbox_pending", namespace: this.namespace, id: job.id, fingerprint };
    for (const index of ["pending", "incomplete"]) {
      if (!await sqlStateBackend(this.database, this.dialect, this.key(job.id, index)).compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: pending
      }))
        throw new Error("Job index already exists");
    }
    await this.indexScopes(record);
    return structuredClone(record);
  }
  async indexScopes(record) {
    const { job, fingerprint } = record;
    const pending = { kind: "outbox_pending", namespace: this.namespace, id: job.id, fingerprint };
    for (const captured of job.scopes) {
      const key = `${this.scopePrefix(captured.subjectId, captured.generation)}${job.id}`;
      const backend = sqlStateBackend(this.database, this.dialect, key);
      const existing = await backend.read();
      if (existing) {
        const entry = pendingSchema.parse(existing.state);
        if (canonicalJson(entry) !== canonicalJson(pending))
          throw new Error("Job scope index conflicts with captured work");
        continue;
      }
      if (!await backend.compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: pending
      }))
        throw new Error("Concurrent scope indexing; retry the complete transaction");
    }
  }
  /** Backfill old retained work. Persist the returned cursor in this same transaction. */
  async backfillScopeIndex(after = null) {
    const prefix = `sd-j:1:${this.prefix}:`;
    const rows = await sqlStateRows(
      this.database,
      this.dialect,
      prefix,
      after === null ? null : `${prefix}${zod.z.uuid().parse(after)}`,
      10,
      "uuid"
    );
    let last = null;
    for (const row of rows) {
      if (typeof row.id !== "string" || !row.id.startsWith(prefix))
        throw new Error("Job backfill namespace mismatch");
      const id = zod.z.uuid().parse(row.id.slice(prefix.length));
      try {
        const record = this.parse(
          this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state,
          id
        );
        await this.indexScopes(record);
      } catch (error) {
        if (!(error instanceof JobErasedError)) throw error;
      }
      last = id;
    }
    return { indexed: rows.length, cursor: rows.length === 10 ? last : null };
  }
  /** Ten validated jobs per page, including completed work and retained erased receipts. */
  async listForScope(subjectId, generation3, after = null) {
    const prefix = this.scopePrefix(subjectId, generation3);
    const rows = await sqlStateRows(
      this.database,
      this.dialect,
      prefix,
      after === null ? null : `${prefix}${zod.z.uuid().parse(after)}`,
      10,
      "uuid"
    );
    const jobs = [];
    for (const row of rows) {
      const entry = pendingSchema.parse(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
      );
      if (entry.namespace !== this.namespace || row.id !== `${prefix}${entry.id}`)
        throw new Error("Job scope index identity mismatch");
      try {
        const record = await this.read(entry.id);
        if (!record || record.fingerprint !== entry.fingerprint || !record.job.scopes.some(
          (captured) => captured.subjectId === subjectId && captured.generation === generation3
        ))
          throw new Error("Job scope index does not match captured work");
      } catch (error) {
        if (!(error instanceof JobErasedError)) throw error;
        if (error.receipt.fingerprint !== entry.fingerprint || !error.receipt.scopeDigests.includes(hash4(canonicalJson({ subjectId, generation: generation3 }))))
          throw new Error("Job scope index does not match erased work", { cause: error });
      }
      jobs.push({ id: entry.id, fingerprint: entry.fingerprint });
    }
    return { jobs, cursor: jobs.length === 10 ? jobs.at(-1).id : null };
  }
  async list(index, after) {
    const prefix = `sd-${index === "pending" ? "jp" : "ji"}:1:${this.prefix}:`;
    const rows = await sqlStateRows(
      this.database,
      this.dialect,
      prefix,
      after === null ? null : `${prefix}${zod.z.uuid().parse(after)}`,
      100,
      "uuid"
    );
    const jobs = rows.map((row) => {
      const pending = pendingSchema.parse(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
      );
      if (pending.namespace !== this.namespace || this.key(pending.id, index) !== row.id)
        throw new Error("Job pending index identity mismatch");
      return { id: pending.id, fingerprint: pending.fingerprint };
    });
    return { jobs, cursor: jobs.length === 100 ? jobs.at(-1).id : null };
  }
  /** Only identifiers are paged, so large payloads never multiply the page memory bound. */
  listPending(after = null) {
    return this.list("pending", after);
  }
  /** Reconcile these operations with the queue even after acceptance, including after Redis data loss. */
  listIncomplete(after = null) {
    return this.list("incomplete", after);
  }
  async update(id, fingerprint, field) {
    const backend = this.backend(id);
    const row = await backend.read();
    if (!row) throw new Error("Job does not exist");
    const record = this.parse(row.state, id);
    if (record.fingerprint !== fingerprint) throw new Error("Job acknowledgement identity mismatch");
    if (record[field]) return false;
    record[field] = true;
    if (!await backend.compareAndSwap(row.revision, { revision: crypto.randomUUID(), state: record }))
      throw new Error("Concurrent job update; retry the complete transaction");
    const p = this.dialect === "postgres" ? "$1" : "?";
    await this.database.query(`DELETE FROM "SidedoorState" WHERE "id" = ${p} RETURNING "id"`, [
      this.key(id, "pending")
    ]);
    if (field === "complete")
      await this.database.query(`DELETE FROM "SidedoorState" WHERE "id" = ${p} RETURNING "id"`, [
        this.key(id, "incomplete")
      ]);
    return true;
  }
  /** Call only after observing acceptance of this exact immutable operation by the queue. */
  acknowledgeDelivery(id, fingerprint) {
    return this.update(id, fingerprint, "delivered");
  }
  /** Permanent receipt prevents duplicate final application commits after queue retention expires. */
  complete(id, fingerprint) {
    return this.update(id, fingerprint, "complete");
  }
};

// src/runtime/jobs/retention.ts
var JobRetentionCleanup = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
  }
  database;
  dialect;
  namespace;
  async admission(id) {
    const job = await new StorageCleanupJournal(this.database, this.dialect, this.namespace).get(id);
    if (job.retentionPolicy !== retentionPolicy)
      throw new Error("Cleanup retention policy is not registered");
    const tombstone = await new StorageWriteJournal(this.database, this.dialect, this.namespace).tombstone(
      job.subjectId
    );
    if (!tombstone || tombstone.jobId !== job.id || tombstone.generation !== job.generation)
      throw new Error("Cleanup retention requires matching deletion admission");
    return job;
  }
  async step(id) {
    const job = await this.admission(id);
    if (!["collecting", "ready", "deleting", "verifying", "complete"].includes(job.phase))
      throw new Error("Cleanup retention must run after writer drain and before completion");
    const backend = retentionBackend(this.database, this.dialect, this.namespace, id);
    const row = await backend.read();
    const state = row ? retentionStateSchema.parse(row.state) : {
      kind: "job_retention",
      policy: retentionPolicy,
      binding: retentionBinding(job),
      phase: "backfill",
      cursor: null,
      activeId: null
    };
    if (state.binding !== retentionBinding(job)) throw new Error("Cleanup retention identity mismatch");
    if (state.phase === "complete") return { complete: true };
    if (job.phase === "complete") throw new Error("Completed cleanup has no terminal retention proof");
    const next = { ...state };
    const outbox = new JobOutbox(this.database, this.dialect, this.namespace);
    if (state.phase === "backfill") {
      const page = await outbox.backfillScopeIndex(state.cursor);
      next.cursor = page.cursor;
      if (page.cursor === null) next.phase = "jobs";
    } else {
      const page = await outbox.listForScope(job.subjectId, job.generation, state.cursor);
      if (state.activeId !== null && page.jobs[0]?.id !== state.activeId)
        throw new Error("Cleanup retention active job changed");
      for (const entry of page.jobs) {
        const receipt = await outbox.receipt(entry.id);
        if (!receipt || receipt.fingerprint !== entry.fingerprint)
          throw new Error("Cleanup retention job identity mismatch");
        await new JobExecutionJournal(this.database, this.dialect, this.namespace).requireParentDrained(
          entry.id,
          entry.fingerprint
        );
        if (!(await new JobSnapshot(this.database, this.dialect, this.namespace).eraseNext(
          entry.id,
          entry.fingerprint
        )).complete) {
          next.activeId = entry.id;
          break;
        }
        if (receipt.status !== "erased") {
          if (receipt.status === "pending") await outbox.complete(entry.id, entry.fingerprint);
          await outbox.erase(entry.id, entry.fingerprint, {
            subjectId: job.subjectId,
            generation: job.generation
          });
        }
        next.cursor = entry.id;
        next.activeId = null;
      }
      if (next.activeId === null && page.cursor === null) {
        next.phase = "complete";
        next.cursor = null;
      }
    }
    if (!await backend.compareAndSwap(row?.revision ?? null, { revision: crypto.randomUUID(), state: next }))
      throw new Error("Concurrent retention cleanup; retry the complete transaction");
    return { complete: next.phase === "complete" };
  }
};

// src/storage/cleanup/cleanup-journal.ts
var StorageCleanupJournal = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    cleanupIdentity.parse(namespace);
    this.namespaceHash = cleanupHash(namespace);
  }
  database;
  dialect;
  namespace;
  namespaceHash;
  jobId(id) {
    return `sd-c:1:${this.namespaceHash}:${zod.z.uuid().parse(id)}`;
  }
  targetPrefix(jobId) {
    return `sd-d:1:${this.namespaceHash}:${zod.z.uuid().parse(jobId)}:`;
  }
  targetId(target) {
    return `${this.targetPrefix(target.jobId)}${target.id}`;
  }
  backend(id) {
    return sqlStateBackend(this.database, this.dialect, id);
  }
  async readOptional(id) {
    const record = await this.backend(this.jobId(id)).read();
    if (!record) return null;
    const job = cleanupJob.parse(record.state);
    if (job.namespace !== this.namespace || job.id !== id)
      throw new Error("Storage cleanup job identity mismatch");
    return { job, revision: record.revision };
  }
  async read(id, epoch) {
    const record = await this.readOptional(id);
    if (!record) throw new Error("Storage cleanup job is missing");
    if (epoch !== void 0 && epoch !== record.job.epoch) throw new Error("Storage cleanup phase changed");
    return record;
  }
  async save(job, revision) {
    const state = cleanupJob.parse(job);
    if (!await this.backend(this.jobId(state.id)).compareAndSwap(revision, { revision: crypto.randomUUID(), state }))
      throw new Error("Storage cleanup changed concurrently");
  }
  collectors() {
    return new CleanupCollectors(this.database, this.dialect, this.namespace);
  }
  manifests() {
    return new CleanupManifests(this.database, this.dialect, this.namespace);
  }
  registry() {
    return new StorageBackendRegistry(this.database, this.dialect, this.namespace);
  }
  writes() {
    return new StorageWriteJournal(this.database, this.dialect, this.namespace);
  }
  async validateBackend(target) {
    const backend = await this.registry().get(target.backendId);
    if (!backend || backend.binding !== target.binding)
      throw new Error("Storage cleanup target backend does not match");
    if (backend.descriptor.kind === "local" && target.key.endsWith("/"))
      throw new Error("Local cleanup cannot delete directory markers");
  }
  validateTarget(input, jobId, rowId) {
    const target = cleanupTarget.parse(input);
    if (target.namespace !== this.namespace || target.jobId !== jobId || target.id !== cleanupHash(JSON.stringify([target.binding, target.key])) || this.targetId(target) !== rowId)
      throw new Error("Storage cleanup target identity mismatch");
    return target;
  }
  async get(id) {
    return (await this.read(id)).job;
  }
  /** Missing is distinct from malformed state or a failed database read. */
  async find(id) {
    return (await this.readOptional(id))?.job ?? null;
  }
  /** A single bounded page. Public cursors contain only the last validated job UUID. */
  async listJobs(after = null) {
    const prefix = `sd-c:1:${this.namespaceHash}:`;
    const rows = await cleanupRows(
      this.database,
      this.dialect,
      prefix,
      after === null ? null : `${prefix}${zod.z.uuid().parse(after)}`,
      100,
      "uuid"
    );
    const jobs = rows.map((row) => {
      const job = cleanupJob.parse(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
      );
      if (job.namespace !== this.namespace || row.id !== this.jobId(job.id))
        throw new Error("Storage cleanup job identity mismatch");
      return job;
    });
    return { jobs, cursor: jobs.length === 100 ? jobs.at(-1).id : null };
  }
  async manifestStatus(id, pageId) {
    return this.manifests().status((await this.read(id)).job, pageId);
  }
  /** Commit with authority removal and reference collection, before application cascades erase references. */
  async createJob(prepared) {
    const job = cleanupJob.parse(prepared);
    if (job.namespace !== this.namespace || job.phase !== "preparing" || job.epoch !== 0 || job.drainCursor !== null || job.pending !== 0 || job.deleted !== 0 || job.verification !== 0 || job.collectorCount !== 0 || job.inventoryCount !== 0 || job.remainingCollectors !== 0 || job.manifestCount !== 0 || job.unresolvedManifests !== 0)
      throw new Error("Storage cleanup must start with an empty prepared job");
    await this.writes().forbidWrites({
      schemaVersion: 1,
      kind: "tombstone",
      namespace: job.namespace,
      subjectId: job.subjectId,
      generation: job.generation,
      jobId: job.id,
      createdAt: job.createdAt
    });
    const backend = this.backend(this.jobId(job.id));
    const previous = await backend.read();
    if (previous) {
      if (JSON.stringify(cleanupJob.parse(previous.state)) !== JSON.stringify(job))
        throw new Error("Storage cleanup job already exists");
      return;
    }
    if (!await backend.compareAndSwap(null, { revision: crypto.randomUUID(), state: job }))
      throw new Error("Storage cleanup changed concurrently");
  }
  /** Register bounded pages before freezing the scope set. No fixed limit on a job's scopes. */
  async registerCollectors(id, epoch, collectors) {
    const { job, revision } = await this.read(id, epoch);
    if (job.phase !== "preparing") throw new Error("Storage cleanup collector scopes are frozen");
    if (collectors.length > 1e3) throw new Error("Storage cleanup page exceeds its limit");
    for (const collector of collectors) {
      if (!await this.collectors().register(job, collector)) continue;
      job.collectorCount++;
      job.remainingCollectors++;
      if (collector.kind === "inventory") job.inventoryCount++;
    }
    await this.save(job, revision);
    return job;
  }
  async listCollectors(id, after = null) {
    const { job } = await this.read(id);
    return this.collectors().list(job, after);
  }
  /** Persist raw pre-cascade references. Unknown attribution remains unresolved and prevents cleanup. */
  async recordManifestPage(id, epoch, input) {
    const { job, revision } = await this.read(id, epoch);
    if (job.phase !== "preparing") throw new Error("Storage cleanup manifests are frozen");
    if (await this.manifests().register(job, input)) {
      job.manifestCount++;
      job.unresolvedManifests++;
      await this.save(job, revision);
    }
    return job;
  }
  async listManifests(id, after = null) {
    return this.manifests().list((await this.read(id)).job, after);
  }
  /**
   * The app proves ownership and classifies every raw entry. This transaction persists exact
   * targets under registered verification inventories together with immutable resolution provenance.
   * A non-storage classification must carry an explicit reason; unknown attribution is not one.
   */
  async resolveManifest(id, epoch, pageId, input) {
    const { job, revision } = await this.read(id, epoch);
    if (job.phase !== "preparing") throw new Error("Storage cleanup manifests are frozen");
    const manifests = this.manifests();
    const { page } = await manifests.get(job, pageId);
    const resolution = manifests.validateResolution(page.entries.length, input);
    if (page.resolution) {
      await manifests.resolve(job, pageId, resolution);
      return job;
    }
    for (const entry of resolution.entries) {
      if (entry.kind !== "storage") continue;
      for (const collectorId of entry.collectorIds ?? []) {
        const { collector } = await this.collectors().get(job, collectorId);
        if (collector.kind !== "inventory")
          throw new Error("Storage manifest requires verification inventory collectors");
      }
      for (const target of entry.targets) await this.addTarget(job, target);
    }
    await manifests.resolve(job, pageId, resolution);
    job.unresolvedManifests--;
    await this.save(job, revision);
    return job;
  }
  /** Stop the previous iterator and all page processing first. A new iterator restarts from the beginning. */
  async restartCollector(id, epoch, collectorId) {
    const { job } = await this.read(id, epoch);
    const { collector, revision } = await this.collectors().get(job, collectorId);
    if (!["collecting", "verifying"].includes(job.phase) || collector.kind !== "inventory" || collector.complete)
      throw new Error("Storage cleanup collector cannot restart in this phase");
    collector.cursor = null;
    await this.collectors().save(collector, revision);
  }
  async addTarget(job, input) {
    const value = cleanupTargetInput.parse(input);
    await this.validateBackend(value);
    if (!await this.collectors().covers(job, value))
      throw new Error("Storage cleanup target has no verification inventory");
    const id = cleanupHash(JSON.stringify([value.binding, value.key]));
    const rowId = this.targetId({ jobId: job.id, id });
    const backend = this.backend(rowId);
    const previous = await backend.read();
    let target;
    if (previous) {
      target = this.validateTarget(previous.state, job.id, rowId);
      if (!target.backendIds.includes(value.backendId)) target.backendIds.push(value.backendId);
      if (target.status === "deleted") {
        if (job.phase !== "verifying")
          throw new Error("Deleted storage target was rediscovered outside verification");
        target.status = "pending";
        job.pending++;
        job.deleted--;
      }
    } else {
      target = {
        schemaVersion: 1,
        namespace: this.namespace,
        jobId: job.id,
        id,
        binding: value.binding,
        key: value.key,
        backendIds: [value.backendId],
        status: "pending"
      };
      job.pending++;
    }
    if (!await backend.compareAndSwap(previous?.revision ?? null, {
      revision: crypto.randomUUID(),
      state: cleanupTarget.parse(target)
    }))
      throw new Error("Storage cleanup target changed concurrently");
  }
  /** No elapsed-time shortcut: active and uncertain writes keep the job waiting. */
  async recordDrainedIntents(id, epoch, after) {
    const { job, revision } = await this.read(id, epoch);
    if (job.phase !== "waiting" || job.drainCursor !== after)
      throw new Error("Storage cleanup drain position changed");
    const tombstone = await this.writes().tombstone(job.subjectId);
    if (!tombstone || tombstone.jobId !== job.id || tombstone.generation !== job.generation)
      throw new Error("Storage cleanup requires its permanent write tombstone");
    const page = await this.writes().list(job.subjectId, { after: after ?? void 0, limit: 100 });
    if (page.intents.some((intent) => intent.status !== "settled"))
      throw new Error("Storage cleanup is waiting for write completion");
    for (const intent of page.intents) await this.addTarget(job, intent.target);
    job.drainCursor = page.cursor;
    if (page.cursor === null) {
      job.phase = "collecting";
      job.epoch++;
    }
    await this.save(job, revision);
    return job;
  }
  /** Inventory starts after drain. Reference snapshots may be saved with the initial deletion transaction. */
  async recordCollectorPage(input) {
    const { job, revision } = await this.read(input.jobId, input.epoch);
    const { collector, revision: collectorRevision } = await this.collectors().get(job, input.collectorId);
    if (!collector || collector.complete || collector.cursor !== input.after)
      throw new Error("Storage cleanup collector position changed");
    if (!["collecting", "verifying"].includes(job.phase) && !(["preparing", "waiting"].includes(job.phase) && collector.kind === "references"))
      throw new Error("Storage cleanup collector cannot run in this phase");
    if (job.phase === "verifying" && collector.kind !== "inventory")
      throw new Error("Storage cleanup verification requires backend inventory");
    if (input.next !== null && (!input.next || input.next === input.after || input.next.length > 8192))
      throw new Error("Storage cleanup collector did not advance");
    if (input.targets.length > 1e3) throw new Error("Storage cleanup page exceeds its limit");
    for (const target of input.targets) {
      if (!collector.backendIds.includes(target.backendId))
        throw new Error("Storage cleanup target is outside its collector backend scope");
      if (collector.kind === "inventory" && (collector.match === "key" ? target.key !== collector.scope : !target.key.startsWith(collector.scope)))
        throw new Error("Storage cleanup target is outside its inventory prefix");
      await this.addTarget(job, target);
    }
    collector.cursor = input.next;
    collector.complete = input.next === null;
    if (collector.complete) job.remainingCollectors--;
    await this.collectors().save(collector, collectorRevision);
    await this.save(job, revision);
    return job;
  }
  /** Each phase change invalidates deletion tickets from previous passes. */
  async transition(id, epoch) {
    const { job, revision } = await this.read(id, epoch);
    if (job.phase === "preparing") {
      if (job.unresolvedManifests !== 0)
        throw new Error("Storage cleanup has unresolved reference manifests");
      if (job.inventoryCount === 0) throw new Error("Storage cleanup requires a verification inventory");
      job.phase = "waiting";
    } else if (job.phase === "collecting") {
      if (job.remainingCollectors !== 0) throw new Error("Storage cleanup discovery is incomplete");
      job.phase = "ready";
    } else if (job.phase === "ready") {
      job.phase = "deleting";
    } else if (job.phase === "verifying") {
      if (job.remainingCollectors !== 0) throw new Error("Storage cleanup verification is incomplete");
      if (job.pending === 0 && job.retentionPolicy) {
        await new JobRetentionCleanup(this.database, this.dialect, this.namespace).step(job.id);
        const proof = await retentionBackend(this.database, this.dialect, this.namespace, job.id).read();
        const state = proof ? retentionStateSchema.parse(proof.state) : null;
        if (!state || state.binding !== retentionBinding(job) || state.policy !== job.retentionPolicy)
          throw new Error("Storage cleanup retention proof is invalid");
        if (state.phase !== "complete") {
          job.epoch++;
          await this.save(job, revision);
          return job;
        }
        if (state.cursor !== null || state.activeId !== null)
          throw new Error("Storage cleanup retention cursor is incomplete");
      }
      job.phase = job.pending === 0 ? "complete" : "deleting";
    } else throw new Error("Storage cleanup cannot advance in this phase");
    job.epoch++;
    await this.save(job, revision);
    return job;
  }
  async beginVerification(id, epoch) {
    const { job, revision } = await this.read(id, epoch);
    if (job.phase !== "deleting" || job.pending !== 0)
      throw new Error("Storage cleanup still has pending targets");
    if (job.inventoryCount === 0) throw new Error("Storage cleanup requires a verification inventory");
    job.phase = "verifying";
    job.epoch++;
    job.verification++;
    job.remainingCollectors = job.inventoryCount;
    await this.save(job, revision);
    return job;
  }
  /** Cursor advances across all rows, including acknowledged targets, to bound each database read. */
  async pendingTargets(id, epoch, after = null) {
    const { job } = await this.read(id, epoch);
    if (job.phase !== "deleting") throw new Error("Storage cleanup is not deleting");
    const prefix = this.targetPrefix(id);
    const rows = await cleanupRows(this.database, this.dialect, prefix, after);
    const tickets = [];
    for (const row of rows) {
      const target = this.validateTarget(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state,
        id,
        String(row.id)
      );
      if (typeof row.revision !== "string") throw new Error("Invalid storage cleanup target revision");
      if (target.status === "pending") tickets.push({ jobId: id, epoch, target, revision: row.revision });
    }
    return { tickets, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  /** Call only after observed successful deletion, while retaining backend ownership. */
  async acknowledgeTarget(ticket) {
    const { job, revision } = await this.read(ticket.jobId, ticket.epoch);
    if (job.phase !== "deleting") throw new Error("Storage cleanup is not deleting");
    const rowId = this.targetId(ticket.target);
    const backend = this.backend(rowId);
    const previous = await backend.read();
    if (!previous || previous.revision !== ticket.revision)
      throw new Error("Storage cleanup deletion ticket is stale");
    const target = this.validateTarget(previous.state, job.id, rowId);
    if (JSON.stringify(target) !== JSON.stringify(cleanupTarget.parse(ticket.target)) || target.status !== "pending")
      throw new Error("Storage cleanup deletion ticket does not match");
    if (!await backend.compareAndSwap(previous.revision, {
      revision: crypto.randomUUID(),
      state: { ...target, status: "deleted" }
    }))
      throw new Error("Storage cleanup target changed concurrently");
    job.pending--;
    job.deleted++;
    await this.save(job, revision);
  }
};

// src/storage/local/relocation.ts
var digest4 = zod.z.string().regex(/^[a-f0-9]{64}$/);
var identity7 = zod.z.string().min(1).max(200);
var contentSchema = zod.z.object({ sha256: digest4, bytes: zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
var proofSchema = contentSchema.extend({ assetId: digest4 }).strict();
var scopeSchema = zod.z.object({ subjectId: identity7, generation: zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
var inputSchema = zod.z.object({
  operationId: zod.z.uuid(),
  sourceAssetId: digest4,
  destinationAssetId: digest4,
  consumers: zod.z.array(identity7).min(1).max(100),
  sourceRead: proofSchema,
  destinationRead: proofSchema
}).strict();
var receiptSchema2 = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("storage_relocation"),
  namespace: identity7,
  operationId: zod.z.uuid(),
  sourceAssetId: digest4,
  destinationAssetId: digest4,
  consumers: zod.z.array(identity7).min(1).max(100),
  content: contentSchema,
  scopes: zod.z.array(scopeSchema).min(1).max(2e3)
}).strict();
var successorSchema = zod.z.object({ operationId: zod.z.uuid() }).strict();
var allocationSchema2 = zod.z.object({ schemaVersion: zod.z.literal(1), kind: zod.z.literal("storage_relocation_allocation") }).strict();
var scopeIndexSchema = scopeSchema.extend({ namespace: identity7, operationId: zod.z.uuid() }).strict();
function hash5(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function combinedScopes(scopes) {
  const values = /* @__PURE__ */ new Map();
  for (const scope5 of scopes) {
    if (values.has(scope5.subjectId) && values.get(scope5.subjectId) !== scope5.generation)
      throw new Error("Storage relocation ownership generations conflict");
    values.set(scope5.subjectId, scope5.generation);
  }
  return [...values].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([subjectId, generation3]) => ({ subjectId, generation: generation3 }));
}
var StorageRelocationRegistry = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.prefix = hash5(identity7.parse(namespace));
    this.references = new StorageReferenceRegistry(database, dialect, namespace);
    this.writes = new StorageWriteJournal(database, dialect, namespace);
  }
  database;
  dialect;
  namespace;
  prefix;
  references;
  writes;
  receipt(operationId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-rel:1:${this.prefix}:${zod.z.uuid().parse(operationId)}`
    );
  }
  allocation(operationId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-rel-allocation:1:${this.prefix}:${zod.z.uuid().parse(operationId)}`
    );
  }
  successor(assetId2, consumer) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-rels:1:${this.prefix}:${hash5(JSON.stringify([assetId2, consumer]))}`
    );
  }
  scopePrefix(subjectId) {
    return `sd-rel-scope:1:${this.prefix}:${hash5(identity7.parse(subjectId))}:`;
  }
  async remove(id, revision) {
    const parameter = (position) => this.dialect === "postgres" ? `$${position}` : "?";
    const rows = await this.database.query(
      `DELETE FROM "SidedoorState" WHERE "id" = ${parameter(1)} AND "revision" = ${parameter(2)} RETURNING "id"`,
      [id, revision]
    );
    if (rows.length !== 1) throw new Error("Storage relocation changed during erasure");
  }
  /** Retain cleanup dependencies and erase one bounded page in the caller's Serializable transaction. */
  async eraseForSubject(input) {
    const value = zod.z.object({
      subjectId: identity7,
      generation: scopeSchema.shape.generation,
      jobId: zod.z.uuid(),
      epoch: scopeSchema.shape.generation,
      after: zod.z.string().nullable().optional()
    }).strict().parse(input);
    const journal = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const job = await journal.get(value.jobId);
    const tombstone = await this.writes.tombstone(value.subjectId);
    if (job.subjectId !== value.subjectId || job.generation !== value.generation || job.epoch !== value.epoch || job.phase !== "preparing" || job.retentionPolicy !== "job-id-snapshots-v1" || tombstone?.jobId !== job.id || tombstone.generation !== value.generation)
      throw new Error("Storage relocation erasure does not match the cleanup authority");
    const page = await this.listForSubject(value.subjectId, value.after ?? null);
    const manifests = new CleanupManifests(this.database, this.dialect, this.namespace);
    let erased = 0;
    for (const receipt of page.receipts) {
      if (!receipt.scopes.some(
        (scope5) => scope5.subjectId === value.subjectId && scope5.generation === value.generation
      ))
        continue;
      const allocation2 = await this.allocation(receipt.operationId).read();
      if (!allocation2) throw new Error("Storage relocation allocation evidence is missing");
      allocationSchema2.parse(allocation2.state);
      const entries = [];
      for (const [role, assetId2] of [
        ["source", receipt.sourceAssetId],
        ["destination", receipt.destinationAssetId]
      ]) {
        const asset = await this.references.readAsset(assetId2);
        entries.push(
          zod.z.json().parse({
            kind: "storage_relocation_dependency",
            operationId: receipt.operationId,
            role,
            assetId: assetId2,
            scopes: receipt.scopes,
            prepared: asset?.asset.prepared ?? null
          })
        );
      }
      for (const manifest of prepareStorageManifestPages(`relocation:${receipt.operationId}`, entries)) {
        await journal.recordManifestPage(job.id, job.epoch, manifest);
        const saved2 = await manifests.get(job, manifest.id);
        if (!util.isDeepStrictEqual(saved2.page.entries, manifest.entries))
          throw new Error("Storage relocation cleanup dependencies do not match");
      }
      for (const scope5 of receipt.scopes) {
        const id = `${this.scopePrefix(scope5.subjectId)}${receipt.operationId}`;
        const row = await sqlStateBackend(this.database, this.dialect, id).read();
        if (!row || !util.isDeepStrictEqual(scopeIndexSchema.parse(row.state), {
          namespace: this.namespace,
          operationId: receipt.operationId,
          ...scope5
        }))
          throw new Error("Storage relocation scope index does not match during erasure");
        await this.remove(id, row.revision);
      }
      for (const consumer of receipt.consumers) {
        const row = await this.successor(receipt.sourceAssetId, consumer).read();
        if (row && successorSchema.parse(row.state).operationId === receipt.operationId)
          await this.remove(
            `sd-rels:1:${this.prefix}:${hash5(JSON.stringify([receipt.sourceAssetId, consumer]))}`,
            row.revision
          );
      }
      const saved = await this.receipt(receipt.operationId).read();
      if (!saved || !util.isDeepStrictEqual(receiptSchema2.parse(saved.state), receipt))
        throw new Error("Storage relocation receipt changed during erasure");
      await this.remove(`sd-rel:1:${this.prefix}:${receipt.operationId}`, saved.revision);
      erased++;
    }
    return { erased, cursor: page.cursor };
  }
  /** Bounded discovery remains available after tombstoning for the owning erasure workflow. */
  async listForSubject(subjectId, after = null) {
    const prefix = this.scopePrefix(subjectId);
    const rows = await cleanupRows(this.database, this.dialect, prefix, after, 100, "uuid");
    const receipts = [];
    for (const row of rows) {
      const index = scopeIndexSchema.parse(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
      );
      if (index.namespace !== this.namespace || index.subjectId !== subjectId || row.id !== `${prefix}${index.operationId}`)
        throw new Error("Storage relocation scope index does not match");
      const saved = await this.receipt(index.operationId).read();
      if (!saved) throw new Error("Storage relocation scope has no receipt");
      const receipt = receiptSchema2.parse(saved.state);
      if (receipt.namespace !== this.namespace || receipt.operationId !== index.operationId || !receipt.scopes.some(
        (scope5) => scope5.subjectId === subjectId && scope5.generation === index.generation
      ))
        throw new Error("Storage relocation scope attribution does not match");
      receipts.push(receipt);
    }
    return { receipts, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  async validate(receipt) {
    if (receipt.namespace !== this.namespace || receipt.sourceAssetId === receipt.destinationAssetId || new Set(receipt.consumers).size !== receipt.consumers.length)
      throw new Error("Storage relocation identity is invalid");
    const source = await this.references.readAsset(receipt.sourceAssetId);
    const destination = await this.references.readAsset(receipt.destinationAssetId);
    if (!source || !destination || destination.asset.prepared.operationId !== receipt.operationId)
      throw new Error("Storage relocation assets do not match the operation");
    if (!util.isDeepStrictEqual(
      receipt.scopes,
      combinedScopes([...source.asset.prepared.scopes, ...destination.asset.prepared.scopes])
    ))
      throw new Error("Storage relocation scope evidence does not match its assets");
    const allocation2 = await this.references.readAllocation(receipt.destinationAssetId);
    const claims = receipt.consumers.map((consumer) => ({
      consumer,
      previousReference: source.asset.prepared.reference
    }));
    if (!allocation2 || allocation2.operationId !== receipt.operationId || !util.isDeepStrictEqual(allocation2.claims, claims))
      throw new Error("Storage relocation replacement claims do not match");
    for (const scope5 of source.asset.prepared.scopes)
      if (!destination.asset.prepared.scopes.some((value) => util.isDeepStrictEqual(value, scope5)))
        throw new Error("Storage relocation dropped an ownership scope");
    for (const scope5 of [...source.asset.prepared.scopes, ...destination.asset.prepared.scopes])
      if (await this.writes.tombstone(scope5.subjectId))
        throw new Error("Storage relocation ownership was erased");
    for (const consumer of receipt.consumers) {
      const retirement = await this.references.readRetirement(receipt.operationId, consumer);
      if (!retirement || retirement.status !== "pending" || retirement.replacementAssetId !== receipt.destinationAssetId || retirement.previousReference !== source.asset.prepared.reference || retirement.attribution?.assetId !== receipt.sourceAssetId || !util.isDeepStrictEqual(retirement.attribution.prepared, source.asset.prepared))
        throw new Error("Storage relocation has no exact source retirement");
    }
    return { source, destination };
  }
  async record(input) {
    const value = inputSchema.parse(input);
    value.consumers.sort();
    if (value.sourceRead.assetId !== value.sourceAssetId || value.destinationRead.assetId !== value.destinationAssetId || value.sourceRead.sha256 !== value.destinationRead.sha256 || value.sourceRead.bytes !== value.destinationRead.bytes)
      throw new Error("Storage relocation readback does not match the captured source");
    const original = await this.references.readAsset(value.sourceAssetId);
    const replacement = await this.references.readAsset(value.destinationAssetId);
    if (!original || !replacement) throw new Error("Storage relocation assets are missing");
    const receipt = receiptSchema2.parse({
      schemaVersion: 1,
      kind: "storage_relocation",
      namespace: this.namespace,
      operationId: value.operationId,
      sourceAssetId: value.sourceAssetId,
      destinationAssetId: value.destinationAssetId,
      consumers: value.consumers,
      content: { sha256: value.sourceRead.sha256, bytes: value.sourceRead.bytes },
      scopes: combinedScopes([...original.asset.prepared.scopes, ...replacement.asset.prepared.scopes])
    });
    const backend = this.receipt(value.operationId);
    const existing = await backend.read();
    const allocation2 = this.allocation(value.operationId);
    const allocated = await allocation2.read();
    if (allocated) allocationSchema2.parse(allocated.state);
    if (existing && !allocated) throw new Error("Storage relocation allocation evidence is missing");
    if (allocated && !existing) throw new Error("Storage relocation operation was already allocated");
    if (existing && !util.isDeepStrictEqual(receiptSchema2.parse(existing.state), receipt))
      throw new Error("Storage relocation receipt already records different evidence");
    const { source, destination } = await this.validate(receipt);
    if (!existing && (source.asset.consumers.length !== 0 || !util.isDeepStrictEqual([...destination.asset.consumers].sort(), receipt.consumers)))
      throw new Error("Storage relocation must transfer the complete captured consumer set");
    for (const consumer of receipt.consumers) {
      const successor = this.successor(receipt.sourceAssetId, consumer);
      const row = await successor.read();
      if (row) {
        if (successorSchema.parse(row.state).operationId !== receipt.operationId)
          throw new Error("Storage relocation has a conflicting successor");
      } else if (existing) throw new Error("Storage relocation successor evidence is missing");
      else if (!await successor.compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: { operationId: receipt.operationId }
      }))
        throw new Error("Storage relocation successor changed concurrently");
    }
    for (const scope5 of receipt.scopes) {
      const indexBackend = sqlStateBackend(
        this.database,
        this.dialect,
        `${this.scopePrefix(scope5.subjectId)}${receipt.operationId}`
      );
      const index = { namespace: this.namespace, operationId: receipt.operationId, ...scope5 };
      const row = await indexBackend.read();
      if (row) {
        if (!util.isDeepStrictEqual(scopeIndexSchema.parse(row.state), index))
          throw new Error("Storage relocation scope index changed");
      } else if (existing) throw new Error("Storage relocation scope index is missing");
      else if (!await indexBackend.compareAndSwap(null, { revision: crypto.randomUUID(), state: index }))
        throw new Error("Storage relocation scope index changed concurrently");
    }
    if (!existing && !await backend.compareAndSwap(null, { revision: crypto.randomUUID(), state: receipt }))
      throw new Error("Storage relocation receipt changed concurrently");
    if (!allocated && !await allocation2.compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: { schemaVersion: 1, kind: "storage_relocation_allocation" }
    }))
      throw new Error("Storage relocation allocation changed concurrently");
  }
  /** Ordinary replacements have no relocation edge and never prove equivalent content. */
  async resolve(input) {
    const maxHops = zod.z.number().int().min(1).max(1e4).parse(input.maxHops);
    const requiredOperation = inputSchema.pick({ operationId: true, sourceAssetId: true, destinationAssetId: true }).optional().parse(input.requiredOperation);
    let matchedOperation = requiredOperation === void 0;
    const signal = input.signal;
    signal?.throwIfAborted();
    const consumer = identity7.parse(input.consumer);
    const originalReference = zod.z.string().min(1).parse(input.originalReference);
    const currentReference = zod.z.string().min(1).parse(input.currentReference);
    const current = await this.references.resolve({ consumer, reference: currentReference });
    signal?.throwIfAborted();
    if (!current) return null;
    const original = await this.references.readReference(originalReference);
    signal?.throwIfAborted();
    if (!original) return null;
    let assetId2 = original.asset.id;
    let content = null;
    const visited = /* @__PURE__ */ new Set();
    while (assetId2 !== current.assetId) {
      signal?.throwIfAborted();
      if (visited.has(assetId2)) throw new Error("Storage relocation chain contains a cycle");
      if (visited.size >= maxHops)
        throw new Error("Storage relocation chain exceeds the configured traversal limit");
      visited.add(assetId2);
      const successor = await this.successor(assetId2, consumer).read();
      signal?.throwIfAborted();
      if (!successor) return null;
      const edge = successorSchema.parse(successor.state);
      const row = await this.receipt(edge.operationId).read();
      if (!row) throw new Error("Storage relocation receipt is missing");
      const receipt = receiptSchema2.parse(row.state);
      if (receipt.operationId !== edge.operationId || receipt.sourceAssetId !== assetId2 || !receipt.consumers.includes(consumer))
        throw new Error("Storage relocation chain identity does not match");
      await this.validate(receipt);
      if (requiredOperation && receipt.operationId === requiredOperation.operationId && receipt.sourceAssetId === requiredOperation.sourceAssetId && receipt.destinationAssetId === requiredOperation.destinationAssetId)
        matchedOperation = true;
      if (content && !util.isDeepStrictEqual(content, receipt.content))
        throw new Error("Storage relocation chain content changed");
      content = receipt.content;
      assetId2 = receipt.destinationAssetId;
    }
    for (const scope5 of current.prepared.scopes)
      if (await this.writes.tombstone(scope5.subjectId))
        throw new Error("Storage relocation ownership was erased");
    signal?.throwIfAborted();
    if (!matchedOperation) return null;
    return { originalAssetId: original.asset.id, current, content };
  }
};
var locationSchema = zod.z.object({
  version: zod.z.literal(1),
  locationId: zod.z.uuid(),
  root: zod.z.object({ root: zod.z.string(), device: zod.z.string(), inode: zod.z.string(), binding: zod.z.string() }).strict()
}).strict();
async function openExecutionLocation(input, options = {}) {
  const requested = path.resolve(input);
  const { create = false, signal } = options;
  signal?.throwIfAborted();
  const parent = await LocalStorageCleanup.capture(path.dirname(requested));
  const path$1 = path.join(parent.identity.root, path.basename(requested));
  return withFileLock(
    `${path$1}.guard`,
    async () => {
      await LocalStorageCleanup.restore(parent.identity);
      signal?.throwIfAborted();
      let created = false;
      if (create) {
        try {
          await promises.mkdir(path$1, { mode: 448 });
          created = true;
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        }
      }
      const info = await promises.lstat(path$1);
      if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 4095) !== 448)
        throw new Error("Execution location must be a private regular directory");
      const root = (await LocalStorageCleanup.capture(path$1)).identity;
      const marker = path.join(path$1, "location.json");
      const file = await promises.open(
        marker,
        (created ? fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL : fs.constants.O_RDONLY) | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
        384
      );
      let result;
      let failure;
      try {
        if (created) {
          await file.writeFile(JSON.stringify({ version: 1, locationId: crypto.randomUUID(), root }));
          await file.sync();
          syncDirectory(path$1);
          syncDirectory(parent.identity.root);
        }
        const stat = await file.stat();
        if (!stat.isFile() || (stat.mode & 4095) !== 384 || stat.size < 1 || stat.size > 4096)
          throw new Error("Execution location marker must be a private bounded regular file");
        const bytes = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < bytes.length) {
          const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
          if (!bytesRead) throw new Error("Execution location marker changed while reading");
          offset += bytesRead;
        }
        const location = locationSchema.parse(JSON.parse(bytes.toString("utf8")));
        await LocalStorageCleanup.restore(location.root);
        if (location.root.root !== root.root || location.root.device !== root.device || location.root.inode !== root.inode || location.root.binding !== root.binding)
          throw new Error("Execution location marker belongs to another root");
        await LocalStorageCleanup.restore(parent.identity);
        signal?.throwIfAborted();
        result = { locationId: location.locationId, root };
      } catch (error) {
        failure = { error };
      }
      try {
        await file.close();
      } catch (error) {
        const cleanup = new StorageReadCleanupError({ cause: error });
        if (failure)
          throw new AggregateError([failure.error, cleanup], "Execution location read and cleanup failed", {
            cause: error
          });
        throw cleanup;
      }
      if (failure) throw failure.error;
      return result;
    },
    { signal }
  );
}
var LocalStorageReader = class _LocalStorageReader {
  constructor(identity9) {
    this.identity = identity9;
  }
  identity;
  static async restore(identity9) {
    return new _LocalStorageReader((await LocalStorageCleanup.restore(identity9)).identity);
  }
  async copyToFile(key, destination, signal) {
    signal?.throwIfAborted();
    validateStorageKey(key);
    const root = await LocalStorageCleanup.restore(this.identity);
    if (!await root.has(key)) throw new Error("Storage source does not exist");
    const source = path.join(this.identity.root, key);
    return copyOwnedBytesToFile({
      destination,
      signal,
      openSource: async () => {
        const buffer = Buffer.allocUnsafe(65536);
        const file = await promises.open(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        let validated = false;
        return {
          close: () => file.close(),
          read: async () => {
            if (!validated) {
              const opened = await file.stat({ bigint: true });
              const current = await promises.lstat(source, { bigint: true });
              if (!opened.isFile() || current.isSymbolicLink() || opened.dev !== current.dev || opened.ino !== current.ino)
                throw new Error("Storage source changed while opening");
              if (!await root.has(key)) throw new Error("Storage source disappeared while opening");
              await LocalStorageCleanup.restore(this.identity);
              signal?.throwIfAborted();
              validated = true;
            }
            const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
            if (bytesRead) return buffer.subarray(0, bytesRead);
            await LocalStorageCleanup.restore(this.identity);
            return null;
          }
        };
      }
    });
  }
};
var identity8 = zod.z.string().min(1).max(200);
var generation2 = zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var scope4 = zod.z.object({ subjectId: identity8, generation: generation2 }).strict();
var dependency = zod.z.object({
  kind: zod.z.literal("storage_relocation_dependency"),
  operationId: zod.z.uuid(),
  role: zod.z.enum(["source", "destination"]),
  assetId: zod.z.string().regex(/^[a-f0-9]{64}$/),
  scopes: zod.z.array(scope4).min(1).max(2e3),
  prepared: zod.z.unknown()
}).strict();
var StorageCleanupAttribution = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
  }
  database;
  dialect;
  namespace;
  async inspectPage(input) {
    const value = zod.z.object({ jobId: zod.z.uuid(), epoch: generation2, subjectId: identity8, generation: generation2, pageId: identity8 }).strict().parse(input);
    const journal = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const job = await journal.get(value.jobId);
    const tombstone = await new StorageWriteJournal(this.database, this.dialect, this.namespace).tombstone(
      value.subjectId
    );
    if (job.epoch !== value.epoch || job.subjectId !== value.subjectId || job.generation !== value.generation || job.phase !== "preparing" || job.retentionPolicy !== "job-id-snapshots-v1" || tombstone?.jobId !== job.id || tombstone.generation !== value.generation)
      throw new Error("Storage attribution does not match cleanup authority");
    const { page } = await new CleanupManifests(this.database, this.dialect, this.namespace).get(
      job,
      value.pageId
    );
    const references = new StorageReferenceRegistry(this.database, this.dialect, this.namespace);
    const entries = [];
    for (const [index, entry] of page.entries.entries()) {
      const kind = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.kind : void 0;
      let attribution;
      if (kind === "storage_asset" || kind === "storage_reference_retirement") {
        attribution = storageSnapshotAttribution(entry, this.namespace);
      } else if (kind === "storage_relocation_dependency") {
        const saved = dependency.parse(entry);
        if (!saved.scopes.some(
          (item) => item.subjectId === job.subjectId && item.generation === job.generation
        ) || new Set(saved.scopes.map((item) => item.subjectId)).size !== saved.scopes.length)
          throw new Error("Storage relocation dependency ownership mismatch");
        if (saved.prepared === null) {
          entries.push({ index, status: "unresolved", reason: "missing_attribution" });
          continue;
        }
        const prepared = prepareStorageReference(
          saved.prepared
        );
        if (saved.role === "destination" && prepared.operationId !== saved.operationId)
          throw new Error("Storage relocation destination operation mismatch");
        if (prepared.scopes.some(
          (item) => !saved.scopes.some(
            (other) => other.subjectId === item.subjectId && other.generation === item.generation
          )
        ))
          throw new Error("Storage relocation dependency scopes mismatch");
        attribution = { assetId: saved.assetId, prepared };
      } else {
        entries.push({ index, status: "unresolved", reason: "unsupported_entry" });
        continue;
      }
      if (!attribution) {
        entries.push({ index, status: "unresolved", reason: "missing_attribution" });
        continue;
      }
      const validated = await references.validateRetainedAttribution(attribution);
      if (!validated.prepared.scopes.some(
        (item) => item.subjectId === job.subjectId && item.generation === job.generation
      ))
        throw new Error("Storage attribution does not belong to the cleanup subject");
      const current = await references.readAsset(validated.assetId);
      if (current?.asset.consumers.length) {
        entries.push({ index, status: "unresolved", reason: "live_consumers" });
        continue;
      }
      entries.push({
        index,
        status: "attributed",
        target: validated.prepared.target,
        backend: validated.backend
      });
    }
    return { pageId: page.id, entries };
  }
};
var PostgresConnectionCleanupError = class extends Error {
  constructor(options) {
    super("PostgreSQL session closure is unconfirmed", options);
    this.name = "PostgresConnectionCleanupError";
  }
};
async function bounded2(operation, ms, message) {
  let timer;
  try {
    return await new Promise((resolve6, reject2) => {
      timer = setTimeout(() => reject2(new Error(message)), ms);
      operation.then(resolve6, reject2);
    });
  } finally {
    clearTimeout(timer);
  }
}
async function openPostgresDedicatedConnection(client, timeouts) {
  const limits = zod.z.object({
    connectMs: zod.z.number().int().min(1).max(6e4),
    queryMs: zod.z.number().int().min(1).max(6e4),
    closeMs: zod.z.number().int().min(1).max(6e4)
  }).strict().parse(timeouts);
  const connect = client.connect.bind(client);
  const query = client.query.bind(client);
  const end = client.end.bind(client);
  const listeners = /* @__PURE__ */ new Set();
  let failure;
  let closing;
  function lose(error) {
    if (failure) return;
    failure = error;
    for (const listener of listeners) listener(error);
  }
  const removeError = client.onError(lose);
  const removeEnd = client.onEnd(() => lose(new Error("PostgreSQL session ended")));
  const connecting = Promise.resolve().then(connect);
  async function close() {
    if (!closing) {
      lose(new Error("PostgreSQL session is closing"));
      closing = connecting.catch(() => void 0).then(end).then(() => {
        removeError();
        removeEnd();
      });
    }
    try {
      await bounded2(closing, limits.closeMs, "PostgreSQL close deadline expired");
    } catch (error) {
      throw new PostgresConnectionCleanupError({ cause: error });
    }
  }
  async function fail(error) {
    lose(error instanceof Error ? error : new Error("PostgreSQL operation failed", { cause: error }));
    try {
      await close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "PostgreSQL operation and cleanup failed", {
        cause: closeError
      });
    }
    throw error;
  }
  try {
    await bounded2(connecting, limits.connectMs, "PostgreSQL connect deadline expired");
    if (failure) throw failure;
  } catch (error) {
    return fail(error);
  }
  return {
    onLoss(listener) {
      listeners.add(listener);
      if (failure) listener(failure);
      return () => {
        listeners.delete(listener);
      };
    },
    async query(sql, values) {
      if (failure) throw failure;
      const parameters = [...values];
      try {
        const rows = await bounded2(
          Promise.resolve().then(() => {
            if (failure) throw failure;
            return query(sql, parameters);
          }),
          limits.queryMs,
          "PostgreSQL query deadline expired"
        );
        if (failure) throw failure;
        return rows;
      } catch (error) {
        return fail(error);
      }
    },
    close
  };
}
async function acquirePostgresBackendLock(options) {
  const namespace = zod.z.string().min(1).max(200).parse(options.namespace);
  const binding3 = zod.z.string().regex(/^[a-f0-9]{64}$/).parse(options.binding);
  const acquisitionSignal = options.signal;
  const openConnection = options.openConnection;
  acquisitionSignal?.throwIfAborted();
  const key = crypto.createHash("sha256").update(JSON.stringify(["sidedoor-cleanup", namespace, binding3])).digest().readBigInt64BE().toString();
  const connection = await openConnection();
  const lifetime = new AbortController();
  let unsubscribe;
  let closing;
  function release() {
    if (closing) return closing;
    lifetime.abort(new Error("Backend lock was released"));
    closing = (async () => {
      await connection.close();
      unsubscribe?.();
    })();
    return closing;
  }
  try {
    unsubscribe = connection.onLoss((error) => lifetime.abort(error));
    acquisitionSignal?.throwIfAborted();
    lifetime.signal.throwIfAborted();
    const rows = await connection.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [key]);
    acquisitionSignal?.throwIfAborted();
    lifetime.signal.throwIfAborted();
    if (rows.length !== 1 || rows[0]?.acquired !== true)
      throw new Error("Storage backend is owned by another cleanup connection");
    return {
      signal: lifetime.signal,
      assertHeld: () => lifetime.signal.throwIfAborted(),
      release
    };
  } catch (error) {
    try {
      await release();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "Backend lock acquisition and closure failed", {
        cause: closeError
      });
    }
    throw error;
  }
}
var bindingSchema = zod.z.object({
  executionId: zod.z.uuid(),
  executorId: zod.z.uuid(),
  jobId: zod.z.uuid(),
  backendBinding: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var evidenceSchema2 = zod.z.object({
  id: zod.z.uuid(),
  kind: zod.z.enum(["remote-operations-settled", "stopped-before-dispatch"])
}).strict();
var recordSchema3 = bindingSchema.extend({
  status: zod.z.enum(["active", "unconfirmed", "settled"]),
  resolution: evidenceSchema2.optional()
}).strict();
var gateSchema2 = zod.z.object({ executionId: zod.z.uuid(), settled: zod.z.boolean() }).strict();
var backendBindingSchema = zod.z.string().regex(/^[a-f0-9]{64}$/);
var CleanupExecutionJournal = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.prefix = cleanupHash(zod.z.string().min(1).max(200).parse(namespace));
  }
  database;
  dialect;
  namespace;
  prefix;
  execution(id) {
    return sqlStateBackend(this.database, this.dialect, `sd-ce:1:${this.prefix}:${zod.z.uuid().parse(id)}`);
  }
  gate(backendBinding) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-ceg:1:${this.prefix}:${backendBindingSchema.parse(backendBinding)}`
    );
  }
  async read(input) {
    const binding3 = bindingSchema.parse(input);
    const row = await this.execution(binding3.executionId).read();
    if (!row) return null;
    const record = recordSchema3.parse(row.state);
    for (const field of Object.keys(binding3))
      if (record[field] !== binding3[field]) throw new Error("Cleanup execution identity does not match");
    return record;
  }
  async assertOwned(input) {
    const binding3 = bindingSchema.parse(input);
    const record = await this.read(binding3);
    const row = await this.gate(binding3.backendBinding).read();
    const gate = row ? gateSchema2.parse(row.state) : null;
    if (!record || record.status !== "active" || !gate || gate.settled || gate.executionId !== binding3.executionId)
      throw new Error("Cleanup execution no longer owns this backend");
  }
  /** Read the execution holding a physical backend gate, including unresolved recovery state. */
  async current(backendBinding) {
    const binding3 = backendBindingSchema.parse(backendBinding);
    const row = await this.gate(binding3).read();
    if (!row) return null;
    const gate = gateSchema2.parse(row.state);
    const execution = await this.execution(gate.executionId).read();
    if (!execution) throw new Error("Cleanup execution gate has no execution record");
    const record = recordSchema3.parse(execution.state);
    if (record.backendBinding !== binding3) throw new Error("Cleanup execution gate identity does not match");
    if (gate.settled !== (record.status === "settled"))
      throw new Error("Cleanup execution gate state does not match");
    return record;
  }
  /** Check ownership and persist observed deletion in this same Serializable transaction. */
  async acknowledgeTarget(input, ticket) {
    const binding3 = bindingSchema.parse(input);
    if (binding3.jobId !== ticket.jobId || binding3.backendBinding !== ticket.target.binding)
      throw new Error("Cleanup execution does not own this deletion ticket");
    await this.assertOwned(binding3);
    await new StorageCleanupJournal(this.database, this.dialect, this.namespace).acknowledgeTarget(ticket);
  }
  /** All registered backend destinations must have active ownership before a phase can advance. */
  async transition(jobId, epoch, inputs) {
    const bindings = zod.z.array(bindingSchema).min(1).max(1e3).parse(inputs);
    if (bindings.some((binding3) => binding3.jobId !== jobId) || new Set(bindings.map((binding3) => binding3.backendBinding)).size !== bindings.length)
      throw new Error("Cleanup phase ownership does not match the job");
    for (const binding3 of bindings) await this.assertOwned(binding3);
    const cleanup = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const registry = new StorageBackendRegistry(this.database, this.dialect, this.namespace);
    const covered = new Set(bindings.map((binding3) => binding3.backendBinding));
    let cursor = null;
    do {
      const page = await cleanup.listCollectors(jobId, cursor);
      for (const collector of page.collectors) {
        for (const id of collector.backendIds) {
          const backend = await registry.get(id);
          if (!backend || !covered.has(backend.binding))
            throw new Error("Cleanup phase requires ownership of every registered backend");
        }
      }
      cursor = page.cursor;
    } while (cursor !== null);
    return cleanup.transition(jobId, epoch);
  }
  /** Repeated admission recovers ownership only. It never authorizes repeating external I/O. */
  async begin(input) {
    const binding3 = bindingSchema.parse(input);
    const previous = await this.read(binding3);
    if (previous) {
      await this.assertOwned(binding3);
      return previous;
    }
    const cleanup = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const job = await cleanup.get(binding3.jobId);
    if (job.phase === "complete") throw new Error("Completed cleanup cannot start an execution");
    const registry = new StorageBackendRegistry(this.database, this.dialect, this.namespace);
    let cursor = null;
    let covered = false;
    do {
      const page = await cleanup.listCollectors(job.id, cursor);
      for (const collector of page.collectors) {
        for (const id of collector.backendIds) {
          const backend = await registry.get(id);
          if (backend?.binding === binding3.backendBinding) covered = true;
        }
      }
      cursor = page.cursor;
    } while (!covered && cursor !== null);
    if (!covered) throw new Error("Cleanup execution backend has no registered collector");
    const gateBackend = this.gate(binding3.backendBinding);
    const gateRow = await gateBackend.read();
    if (gateRow && !gateSchema2.parse(gateRow.state).settled)
      throw new Error("Backend has an unresolved cleanup execution");
    const record = { ...binding3, status: "active" };
    if (!await this.execution(binding3.executionId).compareAndSwap(null, {
      revision: crypto.randomUUID(),
      state: record
    }) || !await gateBackend.compareAndSwap(gateRow?.revision ?? null, {
      revision: crypto.randomUUID(),
      state: { executionId: binding3.executionId, settled: false }
    }))
      throw new Error("Cleanup execution admission changed concurrently");
    return record;
  }
  async update(input, status, evidence) {
    const binding3 = bindingSchema.parse(input);
    const record = await this.read(binding3);
    if (!record) throw new Error("Cleanup execution is missing");
    if (record.status === "settled") {
      if (status === "settled" && JSON.stringify(record.resolution) === JSON.stringify(evidence)) return;
      throw new Error("Cleanup execution is already settled");
    }
    const backend = this.execution(binding3.executionId);
    const row = await backend.read();
    const gateBackend = this.gate(binding3.backendBinding);
    const gateRow = await gateBackend.read();
    const gate = gateRow ? gateSchema2.parse(gateRow.state) : null;
    if (!row || !gate || gate.settled || gate.executionId !== binding3.executionId)
      throw new Error("Cleanup execution no longer owns this backend");
    if (!await backend.compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...record, status, ...evidence ? { resolution: evidence } : {} }
    }))
      throw new Error("Cleanup execution changed concurrently");
    if (status === "settled" && !await gateBackend.compareAndSwap(gateRow.revision, {
      revision: crypto.randomUUID(),
      state: { executionId: binding3.executionId, settled: true }
    }))
      throw new Error("Cleanup execution gate changed concurrently");
  }
  async markUnconfirmed(binding3) {
    await this.update(binding3, "unconfirmed");
  }
  /** Original executor observed every dispatched operation settle, including after uncertainty. */
  async settle(binding3) {
    await this.update(binding3, "settled");
  }
  /** Caller authorizes and persists exact remote-operation evidence. Process death alone is insufficient. */
  async resolveUnconfirmed(binding3, evidence) {
    await this.update(binding3, "settled", evidenceSchema2.parse(evidence));
  }
};

// src/storage/cleanup/backends/probe-cleanup.ts
async function cleanupStorageProbe(input) {
  const options = { ...input, target: { ...input.target }, execution: { ...input.execution } };
  const journal = (tx) => new StorageCleanupJournal(options.executor(tx), options.dialect, options.namespace);
  const executions = (tx) => new CleanupExecutionJournal(options.executor(tx), options.dialect, options.namespace);
  const inspect = () => options.transaction(async (tx) => {
    const store = journal(tx);
    const job = await store.get(options.jobId);
    if (options.execution.jobId !== job.id || options.execution.backendBinding !== options.target.binding)
      throw new Error("Storage probe execution does not match cleanup");
    if (job.phase !== "complete") await executions(tx).assertOwned(options.execution);
    else {
      const execution = await executions(tx).read(options.execution);
      if (!execution || execution.status === "unconfirmed")
        throw new Error("Completed probe requires its confirmed execution identity");
    }
    const backend = await new StorageBackendRegistry(
      options.executor(tx),
      options.dialect,
      options.namespace
    ).get(options.target.backendId);
    if (!backend || backend.binding !== options.target.binding)
      throw new Error("Storage probe backend binding does not match");
    if (job.subjectId !== options.subjectId || !/^storage-probe:[0-9a-f-]{36}$/.test(job.subjectId))
      throw new Error("Storage probe cleanup subject does not match");
    const page = await store.listCollectors(job.id);
    const collector = page.collectors[0];
    if (page.cursor !== null || page.collectors.length !== 1 || !collector || collector.kind !== "inventory" || collector.match !== "key" || collector.scope !== options.target.key || collector.backendIds.length !== 1 || collector.backendIds[0] !== options.target.backendId)
      throw new Error("Storage probe cleanup requires its exact captured target");
    return { job, collector };
  });
  let verificationPasses = 0;
  while (true) {
    const { job, collector } = await inspect();
    if (job.phase === "complete") return;
    if (job.phase === "preparing" || job.phase === "ready") {
      await options.transaction((tx) => executions(tx).transition(job.id, job.epoch, [options.execution]));
      continue;
    }
    if (job.phase === "waiting") {
      await options.transaction(async (tx) => {
        await executions(tx).assertOwned(options.execution);
        return journal(tx).recordDrainedIntents(job.id, job.epoch, job.drainCursor);
      });
      continue;
    }
    if (job.phase === "collecting" || job.phase === "verifying") {
      if (!collector.complete) {
        if (job.phase === "verifying" && ++verificationPasses > 2)
          throw new Error("Storage probe destination keeps reappearing during verification");
        const exists = await options.has(options.target.key);
        await options.transaction(async (tx) => {
          await executions(tx).assertOwned(options.execution);
          return journal(tx).recordCollectorPage({
            jobId: job.id,
            epoch: job.epoch,
            collectorId: collector.id,
            after: collector.cursor,
            next: null,
            targets: exists ? [options.target] : []
          });
        });
      } else {
        await options.transaction((tx) => executions(tx).transition(job.id, job.epoch, [options.execution]));
      }
      continue;
    }
    const page = await options.transaction((tx) => journal(tx).pendingTargets(job.id, job.epoch));
    if (page.cursor !== null || page.tickets.length > 1)
      throw new Error("Storage probe cleanup contains unexpected targets");
    for (const ticket of page.tickets) {
      if (ticket.target.key !== options.target.key || ticket.target.binding !== options.target.binding || ticket.target.backendIds.length !== 1 || ticket.target.backendIds[0] !== options.target.backendId)
        throw new Error("Storage probe deletion target does not match");
      await options.delete(ticket.target.key);
      await options.transaction((tx) => executions(tx).acknowledgeTarget(options.execution, ticket));
    }
    await options.transaction(async (tx) => {
      await executions(tx).assertOwned(options.execution);
      return journal(tx).beginVerification(job.id, job.epoch);
    });
  }
}
async function runStorageCleanup(input) {
  const namespace = zod.z.string().min(1).max(200).parse(input.namespace);
  const jobId = zod.z.uuid().parse(input.jobId);
  const executorId = zod.z.uuid().parse(input.executorId ?? crypto.randomUUID());
  const ports = [...input.ports];
  if (!ports.length) throw new Error("Storage cleanup requires at least one backend port");
  const byBackend = new Map(ports.map((port) => [port.backendId, port]));
  const byBinding = new Map(ports.map((port) => [port.binding, port]));
  if (byBackend.size !== ports.length) throw new Error("Storage cleanup backend ports must be unique");
  const signal = input.signal ?? new AbortController().signal;
  const journal = (transaction) => new StorageCleanupJournal(input.executor(transaction), input.dialect, namespace);
  const executions = (transaction) => new CleanupExecutionJournal(input.executor(transaction), input.dialect, namespace);
  const bindings = [...byBinding].map(([backendBinding]) => ({
    executionId: crypto.randomUUID(),
    executorId,
    jobId,
    backendBinding
  }));
  await input.transaction(async (transaction) => {
    for (const binding3 of bindings) await executions(transaction).begin(binding3);
  });
  let externalStarted = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const snapshot = await input.transaction(async (transaction) => {
        const store = journal(transaction);
        const job2 = await store.get(jobId);
        const collectors2 = [];
        let after2 = null;
        do {
          const page = await store.listCollectors(jobId, after2);
          collectors2.push(...page.collectors);
          after2 = page.cursor;
        } while (after2 !== null);
        return { job: job2, collectors: collectors2 };
      });
      const { job, collectors } = snapshot;
      if (job.phase === "complete") break;
      if (job.phase === "preparing" || job.phase === "ready") {
        await input.transaction(
          (transaction) => executions(transaction).transition(job.id, job.epoch, bindings)
        );
        continue;
      }
      if (job.phase === "waiting") {
        await input.transaction(
          (transaction) => journal(transaction).recordDrainedIntents(job.id, job.epoch, job.drainCursor)
        );
        continue;
      }
      if (job.phase === "collecting" || job.phase === "verifying") {
        const collector = collectors.find((candidate) => !candidate.complete);
        if (!collector) {
          await input.transaction(
            (transaction) => executions(transaction).transition(job.id, job.epoch, bindings)
          );
          continue;
        }
        const port = collector.backendIds.map((id) => byBackend.get(id)).find(Boolean);
        if (!port) throw new Error("Storage cleanup collector has no retained backend port");
        externalStarted = true;
        const page = await port.collect(collector, signal);
        if (page.targets.length > 1e3) throw new Error("Storage cleanup backend page exceeds its bound");
        await input.transaction(
          (transaction) => journal(transaction).recordCollectorPage({
            jobId: job.id,
            epoch: job.epoch,
            collectorId: collector.id,
            after: collector.cursor,
            next: page.next,
            targets: page.targets
          })
        );
        continue;
      }
      if (job.phase !== "deleting") throw new Error("Storage cleanup reached an unsupported phase");
      let after = null;
      do {
        const page = await input.transaction(
          (transaction) => journal(transaction).pendingTargets(job.id, job.epoch, after)
        );
        for (const ticket of page.tickets) {
          const port = byBinding.get(ticket.target.binding);
          if (!port) throw new Error("Storage cleanup target has no retained backend port");
          externalStarted = true;
          await port.delete(ticket.target.key, signal);
          await input.transaction(
            (transaction) => executions(transaction).acknowledgeTarget(
              bindings.find((binding3) => binding3.backendBinding === ticket.target.binding),
              ticket
            )
          );
        }
        after = page.cursor;
      } while (after !== null);
      await input.transaction((transaction) => journal(transaction).beginVerification(job.id, job.epoch));
    }
    await input.transaction(async (transaction) => {
      for (const binding3 of bindings) await executions(transaction).settle(binding3);
    });
  } catch (error) {
    await input.transaction(async (transaction) => {
      for (const binding3 of bindings) {
        if (externalStarted) await executions(transaction).markUnconfirmed(binding3);
        else await executions(transaction).settle(binding3);
      }
    }).catch((settlementError) => {
      throw new AggregateError(
        [error, settlementError],
        "Storage cleanup failed and execution settlement could not be recorded",
        { cause: settlementError }
      );
    });
    throw error;
  }
}
async function runStorageProbe(input) {
  const options = { ...input };
  options.signal.throwIfAborted();
  const writes = (tx) => new StorageWriteJournal(options.executor(tx), options.dialect, options.namespace);
  const cleanup = (tx) => new StorageCleanupJournal(options.executor(tx), options.dialect, options.namespace);
  const instance2 = (tx) => new StorageInstanceControl(options.executor(tx), options.dialect, options.namespace);
  const executions = (tx) => new CleanupExecutionJournal(options.executor(tx), options.dialect, options.namespace);
  const admission = await options.transaction(async (tx) => {
    const captured = structuredClone(await options.captureAdmission(tx));
    const current = await instance2(tx).read();
    const scopes = zod.z.array(
      zod.z.object({
        subjectId: zod.z.string().min(1).max(200),
        generation: zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
      }).strict()
    ).min(2).max(1e3).parse(captured.scopes);
    if (captured.instanceId !== current.instanceId || new Set(scopes.map((scope5) => scope5.subjectId)).size !== scopes.length || !scopes.some(
      (scope5) => scope5.subjectId === current.subjectId && scope5.generation === current.generation
    ))
      throw new Error("Storage probe admission does not match the current instance");
    return captured;
  });
  options.signal.throwIfAborted();
  const capturedPort = await options.capturePort();
  const port = {
    descriptor: structuredClone(capturedPort.descriptor),
    write: capturedPort.write.bind(capturedPort),
    has: capturedPort.has.bind(capturedPort),
    delete: capturedPort.delete.bind(capturedPort)
  };
  const backend = prepareStorageBackend(options.namespace, port.descriptor);
  const subjectId = `storage-probe:${crypto.randomUUID()}`;
  const target = {
    backendId: backend.id,
    binding: backend.binding,
    key: `storage-probes/${admission.instanceId}/${crypto.randomUUID()}.txt`
  };
  const job = prepareStorageCleanup({ namespace: options.namespace, subjectId, generation: 0 });
  const execution = {
    executionId: crypto.randomUUID(),
    executorId: options.executorId,
    jobId: job.id,
    backendBinding: backend.binding
  };
  const intents = [...admission.scopes, { subjectId, generation: 0 }].map(
    (scope5) => prepareStorageWrite({ namespace: options.namespace, ...scope5, target })
  );
  async function validate(tx) {
    options.signal.throwIfAborted();
    await options.validateAdmission(tx, structuredClone(admission));
    if ((await instance2(tx).read()).instanceId !== admission.instanceId)
      throw new Error("Storage instance changed during the probe");
    for (const intent of intents.slice(0, admission.scopes.length))
      await writes(tx).assertWritable(intent, intent.generation);
    options.signal.throwIfAborted();
  }
  async function finish(kind) {
    await options.transaction(async (tx) => {
      for (const intent of intents) await writes(tx).finish(intent, { kind });
    });
  }
  async function clean() {
    await cleanupStorageProbe({
      ...options,
      jobId: job.id,
      subjectId,
      target,
      execution,
      has: (key) => port.has(key),
      delete: (key) => port.delete(key)
    });
    try {
      await options.transaction((tx) => executions(tx).settle(execution));
    } catch (error) {
      try {
        const confirmed = await options.transaction(
          async (tx) => (await executions(tx).read(execution))?.status === "settled" && (await cleanup(tx).get(job.id)).phase === "complete"
        );
        if (confirmed) return;
      } catch (recoveryError) {
        throw new AggregateError([error, recoveryError], "Storage probe settlement could not be confirmed", {
          cause: recoveryError
        });
      }
      throw error;
    }
  }
  try {
    await options.transaction(async (tx) => {
      await new StorageBackendRegistry(options.executor(tx), options.dialect, options.namespace).register(
        backend
      );
      await validate(tx);
      for (const intent of intents) await writes(tx).begin(intent, intent.generation);
      await cleanup(tx).createJob(job);
      await cleanup(tx).registerCollectors(job.id, 0, [
        {
          id: "probe",
          kind: "inventory",
          backendIds: [backend.id],
          scope: target.key,
          match: "key"
        }
      ]);
      await executions(tx).begin(execution);
    });
  } catch (error) {
    try {
      const accepted = await options.transaction(async (tx) => {
        const stored = await cleanup(tx).find(job.id);
        if (stored && stored.subjectId !== subjectId)
          throw new Error("Storage probe admission identity does not match");
        return stored !== null;
      });
      if (accepted) {
        await finish("not_created");
        await clean();
      }
    } catch (recoveryError) {
      throw new StorageProbeCleanupError(
        job.id,
        [error, recoveryError],
        "Storage probe admission recovery failed"
      );
    }
    throw error;
  }
  let started = false;
  try {
    await options.transaction(async (tx) => {
      await validate(tx);
      await executions(tx).assertOwned(execution);
    });
    options.signal.throwIfAborted();
    started = true;
    await port.write(target.key, Buffer.from("ok"), "text/plain", options.signal);
  } catch (error) {
    try {
      await finish(started ? "uncertain" : "not_created");
      if (!started) await clean();
      else await options.transaction((tx) => executions(tx).markUnconfirmed(execution));
    } catch (recoveryError) {
      throw new StorageProbeCleanupError(
        job.id,
        [error, recoveryError],
        "Storage probe cleanup is unresolved"
      );
    }
    if (started)
      throw new StorageProbeCleanupError(job.id, [error], "Storage probe upload outcome is unresolved");
    throw error;
  }
  try {
    await finish("unreferenced");
    await clean();
  } catch (error) {
    throw new StorageProbeCleanupError(job.id, [error], "Storage probe cleanup is unresolved");
  }
  await options.transaction(validate);
  return { cleanupJobId: job.id };
}

// src/storage/cleanup/backends/multipart-cleanup.ts
var MultipartStorageCleanup = class {
  constructor(port, maxDeletePages) {
    this.port = port;
    this.maxDeletePages = maxDeletePages;
  }
  port;
  maxDeletePages;
  async *list(prefix, signal) {
    let keyMarker;
    let uploadIdMarker;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      signal?.throwIfAborted();
      const page = await this.port.listMultipart(prefix, keyMarker, uploadIdMarker, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) {
        if (!entry.key || !entry.key.startsWith(prefix))
          throw new Error("Multipart listing returned a key outside the cleanup prefix");
        validateStorageKey(entry.key.endsWith("/") ? entry.key.slice(0, -1) : entry.key);
        if (!entry.uploadId || [...entry.uploadId].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        ))
          throw new Error("Multipart listing returned an invalid upload identity");
        yield { key: entry.key, uploadId: entry.uploadId };
      }
      if (!page.isTruncated) return;
      keyMarker = page.nextKey;
      uploadIdMarker = page.nextUploadId;
      const marker = JSON.stringify([keyMarker, uploadIdMarker]);
      if (!keyMarker || !uploadIdMarker || seen.has(marker))
        throw new Error("Multipart listing did not advance");
      seen.add(marker);
    }
  }
  async delete(key, signal) {
    let previous;
    for (let batch = 0; batch < this.maxDeletePages; batch++) {
      const uploads = [];
      for await (const entry of this.list(key, signal)) {
        if (entry.key !== key) continue;
        uploads.push(entry);
        if (uploads.length === 1e3) break;
      }
      if (!uploads.length) return;
      const signature = JSON.stringify(uploads.map((entry) => entry.uploadId).sort());
      if (signature === previous) throw new Error("Multipart deletion did not advance");
      previous = signature;
      for (const upload of uploads) {
        signal?.throwIfAborted();
        await this.port.abortMultipart(key, upload.uploadId, signal);
        signal?.throwIfAborted();
      }
    }
    throw new Error("Multipart cleanup reached its batch limit; retry to continue");
  }
};

// src/storage/cleanup/backends/object-cleanup.ts
function objectKey(value) {
  validateStorageKey(value.endsWith("/") ? value.slice(0, -1) : value);
  return value;
}
var ObjectStorageCleanup = class {
  location;
  binding;
  publicUrl;
  publicUrlEncoding;
  port;
  maxDeletePages;
  multipart;
  activeListings = 0;
  activeDeletions = 0;
  constructor(options) {
    this.location = Object.freeze({ ...options.location });
    this.binding = storageBackendBinding(this.location);
    this.publicUrl = options.publicUrl ?? null;
    this.publicUrlEncoding = options.publicUrlEncoding ?? "raw";
    this.port = options.port;
    this.maxDeletePages = options.maxDeletePages ?? 100;
    if (!Number.isSafeInteger(this.maxDeletePages) || this.maxDeletePages < 1 || this.maxDeletePages > 1e3)
      throw new Error("Cleanup batch limit must be between 1 and 1000");
    if (!options.multipart || typeof options.multipart.listMultipart !== "function" || typeof options.multipart.abortMultipart !== "function")
      throw new Error("Object cleanup requires multipart inventory and abort support");
    this.multipart = new MultipartStorageCleanup(options.multipart, this.maxDeletePages);
    if (this.publicUrl) this.normalize(`${this.publicUrl.replace(/\/$/, "")}/__reference_validation__`);
  }
  normalize(reference) {
    return normalizeStorageReference(this.location, reference, {
      ...this.publicUrl ? { publicUrl: this.publicUrl } : {},
      publicUrlEncoding: this.publicUrlEncoding
    });
  }
  /** Finish and persist discovery before deleting. Separate instances require caller coordination. */
  async *list(prefix, signal) {
    if (this.activeDeletions) throw new Error("Finish deleting before collecting another cleanup manifest");
    this.activeListings++;
    try {
      if (!prefix.endsWith("/")) throw new Error("Cleanup requires an exact directory prefix");
      validateStorageKey(prefix.slice(0, -1));
      yield* this.scan(prefix, signal);
      for await (const upload of this.multipart.list(prefix, signal)) yield upload.key;
    } finally {
      this.activeListings--;
    }
  }
  /** Exact-key verification includes retained versions and deletion markers, even without a live object. */
  async has(key, signal) {
    objectKey(key);
    if (this.activeDeletions) throw new Error("Finish deleting before collecting another cleanup manifest");
    this.activeListings++;
    try {
      for await (const candidate of this.scan(key, signal)) if (candidate === key) return true;
      for await (const upload of this.multipart.list(key, signal)) if (upload.key === key) return true;
      return false;
    } finally {
      this.activeListings--;
    }
  }
  async *scan(prefix, signal) {
    if (this.port.kind === "versioned") {
      yield* this.listVersions(this.port, prefix, signal);
      return;
    }
    let token;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      signal?.throwIfAborted();
      const page = await this.port.listObjects(prefix, token, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) yield this.listedKey(entry.key, prefix);
      if (!page.isTruncated) return;
      token = page.nextToken;
      if (!token || seen.has(token)) throw new Error("Storage listing did not advance");
      seen.add(token);
    }
  }
  listedKey(key, prefix) {
    if (!key || !key.startsWith(prefix))
      throw new Error("Storage listing returned an object outside the cleanup prefix");
    return objectKey(key);
  }
  async *listVersions(port, prefix, signal) {
    let keyMarker;
    let versionMarker;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      signal?.throwIfAborted();
      const page = await port.listVersions(prefix, keyMarker, versionMarker, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) {
        if (!entry.versionId) throw new Error("Storage version listing is incomplete");
        yield this.listedKey(entry.key, prefix);
      }
      if (!page.isTruncated) return;
      keyMarker = page.nextKey;
      versionMarker = page.nextVersion;
      const marker = JSON.stringify([keyMarker, versionMarker]);
      if (!keyMarker || seen.has(marker)) throw new Error("Storage version listing did not advance");
      seen.add(marker);
    }
  }
  /** Caller establishes ownership and drains writers before invoking deletion. */
  async delete(key, signal) {
    if (this.activeListings) throw new Error("Finish collecting the cleanup manifest before deleting");
    this.activeDeletions++;
    try {
      await this.deleteExact(key, signal);
    } finally {
      this.activeDeletions--;
    }
  }
  async deleteExact(key, signal) {
    objectKey(key);
    await this.multipart.delete(key, signal);
    signal?.throwIfAborted();
    if (this.port.kind === "unversioned") {
      await this.port.deleteObject(key, signal);
      signal?.throwIfAborted();
      return;
    }
    let previous;
    for (let pageNumber = 0; pageNumber < this.maxDeletePages; pageNumber++) {
      signal?.throwIfAborted();
      const page = await this.port.listVersions(key, void 0, void 0, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) {
        this.listedKey(entry.key, key);
        if (!entry.versionId) throw new Error("Storage version listing is incomplete");
      }
      if (!page.entries.length && page.isTruncated)
        throw new Error("Storage version listing did not advance");
      const versions = page.entries.filter((entry) => entry.key === key);
      if (!versions.length) return;
      const signature = JSON.stringify(versions.map((entry) => entry.versionId).sort());
      if (signature === previous) throw new Error("Storage version deletion did not advance");
      previous = signature;
      for (const version of versions) {
        signal?.throwIfAborted();
        await this.port.deleteVersion(key, version.versionId, signal);
        signal?.throwIfAborted();
      }
    }
    throw new Error("Storage version cleanup reached its batch limit; retry to continue");
  }
};
function isMissing(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
var FileStateStore = class {
  constructor(options) {
    this.options = options;
    this.path = path.resolve(options.path);
  }
  options;
  path;
  async read() {
    try {
      return this.options.parse(JSON.parse(await promises.readFile(this.path, "utf8")));
    } catch (error) {
      if (isMissing(error)) return this.options.parse(this.options.initial());
      throw error;
    }
  }
  async transact(operation) {
    return withFileLock(`${this.path}.guard`, async () => {
      const state = await this.read();
      const result = operation(state);
      if (result instanceof Promise) throw new Error("State transaction callbacks must be synchronous");
      const detachedResult = structuredClone(result);
      const encoded = JSON.stringify(this.options.parse(state));
      await this.persist(encoded);
      return detachedResult;
    });
  }
  async persist(encoded) {
    const temporary = `${this.path}.${crypto.randomUUID()}.tmp`;
    try {
      const file = await promises.open(temporary, "wx", 384);
      try {
        await file.writeFile(encoded);
        await file.sync();
      } finally {
        await file.close();
      }
      await promises.rename(temporary, this.path);
      const directory = await promises.open(path.dirname(this.path), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await promises.unlink(temporary).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
  }
};

exports.CleanupExecutionJournal = CleanupExecutionJournal;
exports.FileLockBusyError = FileLockBusyError;
exports.FileStateStore = FileStateStore;
exports.LocalStorageCleanup = LocalStorageCleanup;
exports.LocalStorageReader = LocalStorageReader;
exports.LocalStorageWriteError = LocalStorageWriteError;
exports.LocalStorageWriter = LocalStorageWriter;
exports.ObjectStorageCleanup = ObjectStorageCleanup;
exports.PostgresConnectionCleanupError = PostgresConnectionCleanupError;
exports.ReferenceSetError = ReferenceSetError;
exports.StorageBackendRegistry = StorageBackendRegistry;
exports.StorageCleanupAttribution = StorageCleanupAttribution;
exports.StorageCleanupJournal = StorageCleanupJournal;
exports.StorageInstanceControl = StorageInstanceControl;
exports.StorageManifestLimitError = StorageManifestLimitError;
exports.StorageProbeCleanupError = StorageProbeCleanupError;
exports.StorageReadCleanupError = StorageReadCleanupError;
exports.StorageReferenceConsumerMismatchError = StorageReferenceConsumerMismatchError;
exports.StorageReferenceError = StorageReferenceError;
exports.StorageReferenceRegistry = StorageReferenceRegistry;
exports.StorageRelocationRegistry = StorageRelocationRegistry;
exports.StorageWriteJournal = StorageWriteJournal;
exports.acquireFileLock = acquireFileLock;
exports.acquireFileLockSync = acquireFileLockSync;
exports.acquirePostgresBackendLock = acquirePostgresBackendLock;
exports.cleanupStorageProbe = cleanupStorageProbe;
exports.copyOwnedBytesToFile = copyOwnedBytesToFile;
exports.copyOwnedReadableToFile = copyOwnedReadableToFile;
exports.createExecutionWorkspace = createExecutionWorkspace;
exports.isReferenceSetError = isReferenceSetError;
exports.isStorageManifestLimitError = isStorageManifestLimitError;
exports.localEncryptionKey = localEncryptionKey;
exports.normalizeStorageReference = normalizeStorageReference;
exports.openExecutionLocation = openExecutionLocation;
exports.openPostgresDedicatedConnection = openPostgresDedicatedConnection;
exports.planExecutionWorkspace = planExecutionWorkspace;
exports.prepareStorageBackend = prepareStorageBackend;
exports.prepareStorageCleanup = prepareStorageCleanup;
exports.prepareStorageManifestPages = prepareStorageManifestPages;
exports.prepareStorageReference = prepareStorageReference;
exports.prepareStorageReferenceClaims = prepareStorageReferenceClaims;
exports.prepareStorageTombstone = prepareStorageTombstone;
exports.prepareStorageWrite = prepareStorageWrite;
exports.recoverExecutionWorkspace = recoverExecutionWorkspace;
exports.removeExecutionWorkspace = removeExecutionWorkspace;
exports.runStorageCleanup = runStorageCleanup;
exports.runStorageProbe = runStorageProbe;
exports.storageBackendBinding = storageBackendBinding;
exports.storageCleanupDescriptorSchema = storageCleanupDescriptorSchema;
exports.syncDirectory = syncDirectory;
exports.validateStorageKey = validateStorageKey;
exports.withFileLock = withFileLock;
exports.withOwnedReadables = withOwnedReadables;
exports.withSharedFileLockSync = withSharedFileLockSync;
exports.writeReferenceSet = writeReferenceSet;
