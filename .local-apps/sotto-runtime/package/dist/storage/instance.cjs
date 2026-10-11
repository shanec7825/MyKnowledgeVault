'use strict';

var crypto = require('crypto');
var zod = require('zod');
require('timers/promises');
var path = require('path');
var url = require('url');

// src/storage/sql/instance.ts
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
    const binding = value.kind === "local" ? storageBackendBinding({ kind: "local", root: value.identity.root }) : storageBackendBinding(value.location);
    if (binding !== (value.kind === "local" ? value.identity.binding : value.binding))
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
    let binding = this.backendBindings.get(intent.target.backendId);
    if (!binding) {
      const registration = await new StorageBackendRegistry(this.database, this.dialect, this.namespace).get(
        intent.target.backendId
      );
      if (!registration) throw new Error("Storage backend descriptor is missing");
      binding = registration.binding;
      this.backendBindings.set(intent.target.backendId, binding);
    }
    if (binding !== intent.target.binding)
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

exports.StorageInstanceControl = StorageInstanceControl;
