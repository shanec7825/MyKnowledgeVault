'use strict';

var crypto = require('crypto');
var zod = require('zod');
var promises = require('timers/promises');
var path = require('path');
var url = require('url');
var promises$1 = require('fs/promises');
var fs = require('fs');
require('child_process');
require('string_decoder');
require('stream/promises');
require('http');
require('os');
require('events');

// src/runtime/jobs/outbox.ts

// src/runtime/process/json.ts
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
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

// src/runtime/jobs/snapshot.ts
var identity = zod.z.string().min(1).max(200);
var metadataSchema = zod.z.object({
  kind: zod.z.literal("snapshot"),
  binding: identity,
  pages: zod.z.number().int().nonnegative().safe(),
  sealed: zod.z.boolean(),
  erasureCursor: zod.z.number().int().nonnegative().safe().optional(),
  erased: zod.z.boolean().optional()
}).strict();
var pageSchema = zod.z.object({
  kind: zod.z.literal("snapshot_page"),
  binding: identity,
  index: zod.z.number().int().nonnegative().safe(),
  items: zod.z.array(zod.z.json()).min(1).max(100)
}).strict();
var JobSnapshot = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.prefix = `sd-js:1:${crypto.createHash("sha256").update(identity.parse(namespace)).digest("hex")}:`;
  }
  database;
  dialect;
  prefix;
  backend(id, page) {
    const suffix = page === void 0 ? "meta" : String(zod.z.number().int().nonnegative().safe().parse(page));
    return sqlStateBackend(this.database, this.dialect, `${this.prefix}${zod.z.uuid().parse(id)}:${suffix}`);
  }
  async metadata(id, binding2) {
    identity.parse(binding2);
    const row = await this.backend(id).read();
    if (!row) throw new Error("Snapshot is missing");
    const state = metadataSchema.parse(row.state);
    if (state.binding !== binding2) throw new Error("Snapshot binding mismatch");
    if ((state.erasureCursor ?? 0) > state.pages || state.erased && state.pages !== 0)
      throw new Error("Snapshot erasure cursor is invalid");
    return { row, state };
  }
  async create(id, binding2) {
    const backend = this.backend(id);
    const state = metadataSchema.parse({ kind: "snapshot", binding: binding2, pages: 0, sealed: false });
    if (!await backend.compareAndSwap(null, { revision: crypto.randomUUID(), state }))
      throw new Error("Snapshot identity already exists");
  }
  /** The retention policy fixes snapshot identity to its owning job, with no independent ID. */
  async createForJob(job) {
    const owner = zod.z.object({ id: zod.z.uuid(), fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(job);
    await this.create(owner.id, owner.fingerprint);
  }
  async append(id, binding2, index, items) {
    const page = pageSchema.parse({ kind: "snapshot_page", binding: binding2, index, items });
    if (Buffer.byteLength(canonicalJson(page)) > 1048576) throw new Error("Snapshot page exceeds one MiB");
    const { row, state } = await this.metadata(id, binding2);
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
  async seal(id, binding2) {
    const { row, state } = await this.metadata(id, binding2);
    if (state.erasureCursor !== void 0 || state.erased) throw new Error("Snapshot is being erased");
    if (!state.sealed && !await this.backend(id).compareAndSwap(row.revision, {
      revision: crypto.randomUUID(),
      state: { ...state, sealed: true }
    }))
      throw new Error("Concurrent snapshot seal; retry the complete transaction");
    return state.pages;
  }
  async read(id, binding2, index) {
    zod.z.number().int().nonnegative().safe().parse(index);
    const { state } = await this.metadata(id, binding2);
    if (state.erasureCursor !== void 0 || state.erased) throw new Error("Snapshot is being erased");
    if (!state.sealed) throw new Error("Snapshot is not sealed");
    if (index >= state.pages) return { items: [], pages: state.pages, next: null };
    const row = await this.backend(id, index).read();
    if (!row) throw new Error("Sealed snapshot page is missing");
    const page = pageSchema.parse(row.state);
    if (Buffer.byteLength(canonicalJson(page)) > 1048576) throw new Error("Snapshot page exceeds one MiB");
    if (page.binding !== binding2 || page.index !== index) throw new Error("Snapshot page identity mismatch");
    return { items: page.items, pages: state.pages, next: index + 1 < state.pages ? index + 1 : null };
  }
  /**
   * Caller must prove authorization and exact parent binding before each transaction.
   * Deletes at most ten pages atomically with the cursor. Captured worker memory is not
   * revoked; workers must still recheck deletion admission before committing effects.
   */
  async eraseNext(id, binding2) {
    identity.parse(binding2);
    const backend = this.backend(id);
    if (!await backend.read()) {
      if (!await backend.compareAndSwap(null, {
        revision: crypto.randomUUID(),
        state: { kind: "snapshot", binding: binding2, pages: 0, sealed: true, erasureCursor: 0, erased: true }
      }))
        throw new Error("Concurrent snapshot creation; retry the complete transaction");
      return { complete: true };
    }
    const { row, state } = await this.metadata(id, binding2);
    if (state.erased) return { complete: true };
    const end = Math.min(state.pages, (state.erasureCursor ?? 0) + 10);
    const p = this.dialect === "postgres" ? "$1" : "?";
    for (let page = state.erasureCursor ?? 0; page < end; page++) {
      await this.database.query(`DELETE FROM "SidedoorState" WHERE "id" = ${p} RETURNING "id"`, [
        `${this.prefix}${zod.z.uuid().parse(id)}:${page}`
      ]);
    }
    const complete = end === state.pages;
    const next = complete ? { kind: "snapshot", binding: binding2, pages: 0, sealed: true, erasureCursor: 0, erased: true } : { ...state, erasureCursor: end };
    if (!await this.backend(id).compareAndSwap(row.revision, { revision: crypto.randomUUID(), state: next }))
      throw new Error("Concurrent snapshot erasure; retry the complete transaction");
    return { complete };
  }
};
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
    const binding2 = value.kind === "local" ? storageBackendBinding({ kind: "local", root: value.identity.root }) : storageBackendBinding(value.location);
    if (binding2 !== (value.kind === "local" ? value.identity.binding : value.binding))
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
var identity2 = zod.z.string().min(1).max(200);
var generation = zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var targetSchema = zod.z.object({
  backendId: zod.z.string().regex(/^[a-f0-9]{64}$/),
  binding: zod.z.string().regex(/^[a-f0-9]{64}$/),
  key: zod.z.string().transform(validateStorageKey)
}).strict();
var evidenceSchema = zod.z.object({ kind: zod.z.enum(["observed_io_completion", "stopped_writer"]), id: identity2 }).strict();
var intentSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("write"),
  namespace: identity2,
  subjectId: identity2,
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
  namespace: identity2,
  subjectId: identity2,
  generation,
  operationId: zod.z.uuid(),
  digest: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var tombstoneSchema = zod.z.object({
  schemaVersion: zod.z.literal(1),
  kind: zod.z.literal("tombstone"),
  namespace: identity2,
  subjectId: identity2,
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
    identity2.parse(namespace);
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
    let binding2 = this.backendBindings.get(intent.target.backendId);
    if (!binding2) {
      const registration = await new StorageBackendRegistry(this.database, this.dialect, this.namespace).get(
        intent.target.backendId
      );
      if (!registration) throw new Error("Storage backend descriptor is missing");
      binding2 = registration.binding;
      this.backendBindings.set(intent.target.backendId, binding2);
    }
    if (binding2 !== intent.target.binding)
      throw new Error("Storage target does not match its backend descriptor");
  }
  async tombstone(subjectId) {
    identity2.parse(subjectId);
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
    identity2.parse(subjectId);
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
function syncDirectory(path) {
  const descriptor = fs.openSync(path, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

// src/storage/cleanup/backends/local-cleanup.ts
var LocalStorageCleanup = class _LocalStorageCleanup {
  constructor(identity5) {
    this.identity = identity5;
  }
  identity;
  activeListings = 0;
  activeDeletions = 0;
  static async capture(root) {
    const resolved = await promises$1.realpath(root);
    const info = await promises$1.lstat(resolved, { bigint: true });
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
  static async restore(identity5) {
    const current = await _LocalStorageCleanup.capture(identity5.root);
    if (current.identity.root !== identity5.root || current.identity.device !== identity5.device || current.identity.inode !== identity5.inode || current.identity.binding !== identity5.binding)
      throw new Error("Storage root changed since cleanup was scheduled");
    return current;
  }
  async verifyRoot() {
    const info = await promises$1.lstat(this.identity.root, { bigint: true });
    if (!info.isDirectory() || info.isSymbolicLink() || String(info.dev) !== this.identity.device || String(info.ino) !== this.identity.inode)
      throw new Error("Storage root changed since cleanup was scheduled");
  }
  async verifyAbsence(parent) {
    await this.verifyRoot();
    if (await promises$1.realpath(parent) !== parent) throw new Error("Storage path changed during cleanup");
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
        info = await promises$1.lstat(directory);
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
    if (await promises$1.realpath(directory) !== directory) throw new Error("Storage path changed during cleanup");
    for await (const entry of await promises$1.opendir(directory)) {
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
          info = await promises$1.lstat(target);
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
      if (await promises$1.realpath(target) !== target) throw new Error("Storage path changed during cleanup");
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
        info = await promises$1.lstat(target);
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
    if (await promises$1.realpath(parent) !== parent) throw new Error("Storage path changed during cleanup");
    await this.verifyRoot();
    try {
      await promises$1.unlink(target);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    syncDirectory(parent);
  }
};

// src/storage/execution/execution-workspace.ts
var identity3 = zod.z.object({
  root: zod.z.string().min(1),
  device: zod.z.string().regex(/^\d+$/),
  inode: zod.z.string().regex(/^\d+$/),
  binding: zod.z.string().min(1)
}).strict();
var executionWorkspacePlanSchema = zod.z.object({
  locationId: zod.z.uuid(),
  executionId: zod.z.uuid(),
  root: identity3
}).strict();
var executionWorkspaceSchema = executionWorkspacePlanSchema.extend({
  directory: identity3
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
  await promises$1.mkdir(path, { mode: 448 });
  const directory = (await LocalStorageCleanup.capture(path)).identity;
  if (directory.root !== path) throw new Error("Execution workspace path changed during creation");
  await LocalStorageCleanup.restore(plan.root);
  syncDirectory(plan.root.root);
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
    await promises$1.lstat(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    syncDirectory(workspace.root.root);
    await LocalStorageCleanup.restore(workspace.root);
    return;
  }
  await LocalStorageCleanup.restore(workspace.directory);
  await promises$1.rm(path, { recursive: true });
  syncDirectory(workspace.root.root);
  await LocalStorageCleanup.restore(workspace.root);
}

// src/runtime/jobs/execution-journal.ts
var digest2 = zod.z.string().regex(/^[a-f0-9]{64}$/);
var binding = zod.z.object({
  id: zod.z.uuid(),
  parentId: zod.z.uuid(),
  fingerprint: digest2,
  executorId: zod.z.uuid()
}).strict();
var recordSchema = binding.extend({
  kind: zod.z.literal("job_execution"),
  scopeDigests: zod.z.array(digest2).min(1).max(100),
  status: zod.z.enum(["active", "cleanup-unconfirmed", "settled"]),
  workspace: zod.z.union([executionWorkspaceSchema, executionWorkspacePlanSchema]).optional()
}).strict();
var gateSchema = zod.z.object({ id: zod.z.uuid(), fingerprint: digest2, settled: zod.z.boolean() }).strict();
var hash2 = (value) => crypto.createHash("sha256").update(value).digest("hex");
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
    this.prefix = hash2(zod.z.string().min(1).max(200).parse(namespace));
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
    return `sd-jes:1:${this.prefix}:${digest2.parse(scopeDigest)}:`;
  }
  async owned(input) {
    const expected = binding.parse(input);
    const row = await this.backend(expected.id).read();
    if (!row) throw new Error("Execution does not exist");
    const record = recordSchema.parse(row.state);
    if (canonicalJson(
      binding.parse({
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
    const captured = binding.parse(input);
    const workspace = workspaceInput === void 0 ? void 0 : executionWorkspacePlanSchema.parse(workspaceInput);
    if (workspace && workspace.executionId !== captured.id)
      throw new Error("Execution workspace identity mismatch");
    const parent = await new JobOutbox(this.database, this.dialect, this.namespace).read(captured.parentId);
    if (!parent || parent.complete || parent.fingerprint !== captured.fingerprint)
      throw new Error("Execution requires matching pending work");
    const writes = new StorageWriteJournal(this.database, this.dialect, this.namespace);
    for (const scope2 of parent.job.scopes)
      if (await writes.tombstone(scope2.subjectId)) throw new Error("Execution scope is being erased");
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
      scopeDigests: parent.job.scopes.map((scope2) => hash2(canonicalJson(scope2))),
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
    digest2.parse(fingerprint);
    const row = await this.gate(parentId).read();
    if (!row) return;
    const state = gateSchema.parse(row.state);
    if (state.fingerprint !== fingerprint) throw new Error("Execution parent identity mismatch");
    if (!state.settled) throw new Error("Execution cleanup is unresolved");
  }
  async blockingStatus(parentId, fingerprint) {
    digest2.parse(fingerprint);
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
  async listUnresolved(scope2, after = null) {
    const captured = zod.z.object({ subjectId: zod.z.string().min(1).max(200), generation: zod.z.number().int().nonnegative().safe() }).strict().parse(scope2);
    const scopeDigest = hash2(canonicalJson(captured));
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
      const entry = binding.parse(
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
var IsolatedCleanupError = class extends Error {
  constructor(identity5) {
    super("Isolated execution cleanup could not be verified");
    this.identity = identity5;
    this.name = "IsolatedCleanupError";
  }
  identity;
};
var textBlock = zod.z.object({
  type: zod.z.literal("text"),
  text: zod.z.string(),
  cache_control: zod.z.object({ type: zod.z.literal("ephemeral") }).strict().optional()
}).strict();
zod.z.object({
  model: zod.z.string(),
  max_tokens: zod.z.number().int().positive(),
  messages: zod.z.array(
    zod.z.object({ role: zod.z.enum(["user", "assistant"]), content: zod.z.union([zod.z.string(), zod.z.array(textBlock)]) }).strict()
  ).min(1).max(512),
  system: zod.z.union([zod.z.string(), zod.z.array(textBlock)]).optional(),
  stream: zod.z.boolean().optional(),
  temperature: zod.z.number().min(0).max(1).optional(),
  top_p: zod.z.number().min(0).max(1).optional(),
  stop_sequences: zod.z.array(zod.z.string().max(200)).max(10).optional(),
  tools: zod.z.array(zod.z.never()).max(0).optional(),
  metadata: zod.z.object({ user_id: zod.z.string().max(1024) }).strict().optional(),
  thinking: zod.z.object({ type: zod.z.literal("disabled") }).strict().optional(),
  output_config: zod.z.object({ effort: zod.z.enum(["low", "medium", "high", "max"]) }).strict().optional()
}).strict();
zod.z.object({
  model: zod.z.string(),
  max_tokens: zod.z.number().int().positive(),
  messages: zod.z.array(zod.z.object({ role: zod.z.enum(["system", "user", "assistant"]), content: zod.z.string() }).strict()).min(1).max(512),
  stream: zod.z.boolean().optional(),
  temperature: zod.z.number().min(0).max(2).optional(),
  top_p: zod.z.number().min(0).max(1).optional()
}).strict();
var CredentialBrokerCleanupError = class extends Error {
  constructor() {
    super("Credential broker cleanup could not be verified");
    this.name = "CredentialBrokerCleanupError";
  }
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
var StorageReadCleanupError = class extends Error {
  constructor(options) {
    super("Storage read cleanup could not be confirmed", options);
    this.name = "StorageReadCleanupError";
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

// src/runtime/jobs/job-execution.ts
var JobExecutionCleanupError = class extends Error {
  constructor(options) {
    super("Job execution cleanup could not be confirmed", options);
    this.name = "JobExecutionCleanupError";
  }
};
function isJobExecutionCleanupFailure(error) {
  const seen = /* @__PURE__ */ new Set();
  const pending = [error];
  while (pending.length) {
    const current = pending.pop();
    if (seen.has(current)) continue;
    seen.add(current);
    if (current instanceof JobExecutionCleanupError || current instanceof IsolatedCleanupError || current instanceof CredentialBrokerCleanupError || current instanceof StorageReadCleanupError || current instanceof StorageProbeCleanupError || current instanceof SemaphoreCleanupError || current instanceof ProcessExecutionError && current.code === "cleanup_failed")
      return true;
    if (current instanceof AggregateError) pending.push(...current.errors);
    if (current instanceof Error && current.cause !== void 0) pending.push(current.cause);
  }
  return false;
}
async function runJobExecution(options) {
  const {
    namespace,
    dialect,
    executorId,
    parentId,
    fingerprint,
    signal,
    transaction,
    executor,
    validate,
    isCleanupFailure,
    run
  } = options;
  const workspaceOptions = options.workspace ? { ...options.workspace } : void 0;
  const binding2 = { id: crypto.randomUUID(), parentId, fingerprint, executorId };
  signal.throwIfAborted();
  const workspace = workspaceOptions ? await planExecutionWorkspace(workspaceOptions.root, workspaceOptions.locationId, binding2.id) : void 0;
  const journal = (database) => new JobExecutionJournal(executor(database), dialect, namespace);
  const read = () => transaction((database) => journal(database).read(binding2));
  async function confirm(operation, matches) {
    try {
      await transaction((database) => operation(journal(database)));
    } catch (error) {
      try {
        if (matches(await read())) return;
      } catch (recoveryError) {
        throw new AggregateError([error, recoveryError], "Execution receipt could not be confirmed", {
          cause: recoveryError
        });
      }
      throw error;
    }
  }
  let admitted;
  let recovered = false;
  while (true)
    try {
      admitted = await transaction(async (database) => {
        if (!await validate(database)) return false;
        signal.throwIfAborted();
        await journal(database).begin(binding2, workspace);
        return true;
      }, signal);
      break;
    } catch (error) {
      try {
        const record = await read();
        if (record.status !== "active" || canonicalJson(record.workspace ?? null) !== canonicalJson(workspace ?? null))
          throw new Error("Execution admission does not match", { cause: error });
        admitted = true;
        recovered = true;
        break;
      } catch (recoveryError) {
        const blocker = await transaction(
          (database) => journal(database).blockingStatus(parentId, fingerprint),
          signal
        );
        if (blocker === "active") {
          await promises.setTimeout(25, void 0, { signal });
          continue;
        }
        if (error instanceof JobExecutionAdmissionConflict && blocker === null) continue;
        throw new AggregateError([error, recoveryError], "Execution admission could not be confirmed", {
          cause: recoveryError
        });
      }
    }
  if (!admitted) return;
  let uncertain = false;
  let creationAttempted = false;
  let workspaceAttached = false;
  let started = false;
  let result;
  let failure;
  try {
    signal.throwIfAborted();
    if (recovered && !await transaction(validate, signal))
      throw new Error("Execution is no longer eligible");
    let directory;
    if (workspace) {
      signal.throwIfAborted();
      creationAttempted = true;
      const created = await createExecutionWorkspace(workspace);
      await confirm(
        (value) => value.attachWorkspace(binding2, created),
        (record) => record.status === "active" && canonicalJson(record.workspace ?? null) === canonicalJson(created)
      );
      workspaceAttached = true;
      directory = created.directory.root;
    }
    signal.throwIfAborted();
    started = true;
    result = await run({
      markCleanupUnconfirmed: () => {
        uncertain = true;
      },
      ...directory ? { directory } : {}
    });
  } catch (error) {
    failure = { error };
    uncertain ||= creationAttempted && !workspaceAttached;
    if (started && !uncertain) {
      try {
        uncertain = isJobExecutionCleanupFailure(error) || isCleanupFailure(error);
      } catch (classificationError) {
        uncertain = true;
        failure = {
          error: new AggregateError([error, classificationError], "Execution cleanup classification failed", {
            cause: classificationError
          })
        };
      }
    }
  }
  if (!uncertain && workspace) {
    try {
      const current = await read();
      if (!current.workspace) throw new Error("Execution workspace disappeared before cleanup");
      if ("directory" in current.workspace)
        await removeExecutionWorkspace(current.workspace, workspace.locationId);
      else if (creationAttempted) throw new Error("Execution workspace creation could not be confirmed");
      await confirm(
        (value) => value.releaseWorkspace(binding2, current.workspace),
        (record) => !record.workspace
      );
    } catch (error) {
      uncertain = true;
      const cleanup = new JobExecutionCleanupError({ cause: error });
      failure = {
        error: failure ? new AggregateError([failure.error, cleanup], "Execution and workspace cleanup failed", {
          cause: error
        }) : cleanup
      };
    }
  }
  if (uncertain && !failure)
    failure = {
      error: new JobExecutionCleanupError({ cause: new Error("Execution reported unresolved effects") })
    };
  if (uncertain && signal.aborted && failure) {
    failure = {
      error: new AggregateError(
        [failure.error, new JobExecutionCleanupError({ cause: failure.error })],
        "Cancelled execution has unresolved cleanup",
        { cause: failure.error }
      )
    };
  }
  try {
    await confirm(
      (value) => uncertain ? value.markCleanupUnconfirmed(binding2) : value.settle(binding2),
      (record) => record.status === (uncertain ? "cleanup-unconfirmed" : "settled")
    );
  } catch (error) {
    const cleanup = new JobExecutionCleanupError({ cause: error });
    failure = {
      error: failure ? new AggregateError([failure.error, cleanup], "Execution and cleanup receipt failed", {
        cause: error
      }) : cleanup
    };
  }
  if (failure) throw failure.error;
  return result;
}
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
  const digest3 = crypto.createHash("sha256").update(zod.z.string().min(1).max(200).parse(namespace)).digest("hex");
  return sqlStateBackend(database, dialect, `sd-jr:1:${digest3}:${zod.z.uuid().parse(id)}`);
}
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
  indexId(jobId, binding2, prefix, match) {
    return `sd-p:1:${cleanupHash(this.namespace)}:${zod.z.uuid().parse(jobId)}:${cleanupHash(JSON.stringify([binding2, prefix, match]))}`;
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
var referenceSchema = zod.z.object({
  id: zod.z.uuid(),
  fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var pageSchema2 = zod.z.object({
  jobs: zod.z.array(referenceSchema).max(100),
  cursor: zod.z.uuid().nullable()
}).strict();
async function reconcileOutboxPage(options) {
  zod.z.uuid().nullable().parse(options.cursor);
  const results = [];
  if (options.signal.aborted) return { cursor: options.cursor, results };
  const page = pageSchema2.parse(await options.listIncomplete(options.cursor));
  if (options.signal.aborted) return { cursor: options.cursor, results };
  if (new Set(page.jobs.map((job) => job.id)).size !== page.jobs.length)
    throw new Error("Outbox reconciliation page contains duplicate identities");
  if (page.cursor !== null && page.cursor !== page.jobs.at(-1)?.id)
    throw new Error("Outbox reconciliation cursor does not match its page");
  let previous = options.cursor;
  for (const reference of page.jobs) {
    if (previous !== null && reference.id <= previous)
      throw new Error("Outbox reconciliation page does not advance in identity order");
    previous = reference.id;
  }
  let cursor = options.cursor;
  for (const reference of page.jobs) {
    if (options.signal.aborted) return { cursor, results };
    try {
      const status = zod.z.enum(["delivered", "complete", "erased"]).parse(await options.deliver(Object.freeze({ ...reference }), options.signal));
      results.push({ ...reference, status });
    } catch (error) {
      results.push({ ...reference, status: "failed", error });
    }
    cursor = reference.id;
  }
  return { cursor: page.cursor, results };
}
var identity4 = zod.z.string().min(1).max(200);
var scope = zod.z.object({ subjectId: identity4, generation: zod.z.number().int().nonnegative().safe() }).strict();
var jobSchema = zod.z.object({
  id: zod.z.uuid(),
  namespace: identity4,
  handler: identity4,
  version: zod.z.number().int().positive().safe(),
  payload: zod.z.json(),
  scopes: zod.z.array(scope).min(1).max(100),
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
  namespace: identity4,
  id: zod.z.uuid(),
  fingerprint: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var erasedSchema = zod.z.object({
  kind: zod.z.literal("outbox_erased"),
  namespace: identity4,
  id: zod.z.uuid(),
  handler: identity4,
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
function hash3(value) {
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
    this.prefix = hash3(identity4.parse(namespace));
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
  scopePrefix(subjectId, generation2) {
    const validated = scope.parse({ subjectId, generation: generation2 });
    return `sd-jsc:1:${this.prefix}:${hash3(canonicalJson(validated))}:`;
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
    if (record.job.id !== id || hash3(canonicalJson(record.job)) !== record.fingerprint)
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
      handler: identity4,
      version: zod.z.number().int().positive().safe(),
      scopes: zod.z.array(scope).min(1).max(100)
    }).strict().parse(expected);
    if (new Set(contract.scopes.map((item) => item.subjectId)).size !== contract.scopes.length)
      throw new Error("Parent scopes must have distinct subjects");
    let record;
    try {
      record = await this.read(id);
    } catch (error) {
      if (!(error instanceof JobErasedError)) throw error;
      const receipt = error.receipt;
      if (receipt.fingerprint !== contract.fingerprint || receipt.handler !== contract.handler || receipt.version !== contract.version || canonicalJson([...receipt.scopeDigests].sort()) !== canonicalJson(contract.scopes.map((item) => hash3(canonicalJson(item))).sort()))
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
    scope.parse(captured);
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
      if (error.receipt.fingerprint !== fingerprint || !error.receipt.scopeDigests.includes(hash3(canonicalJson(captured))))
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
      scopeDigests: record.job.scopes.map((item) => hash3(canonicalJson(item)))
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
    const fingerprint = hash3(canonicalJson(job));
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
  async listForScope(subjectId, generation2, after = null) {
    const prefix = this.scopePrefix(subjectId, generation2);
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
          (captured) => captured.subjectId === subjectId && captured.generation === generation2
        ))
          throw new Error("Job scope index does not match captured work");
      } catch (error) {
        if (!(error instanceof JobErasedError)) throw error;
        if (error.receipt.fingerprint !== entry.fingerprint || !error.receipt.scopeDigests.includes(hash3(canonicalJson({ subjectId, generation: generation2 }))))
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

exports.JobErasedError = JobErasedError;
exports.JobExecutionAdmissionConflict = JobExecutionAdmissionConflict;
exports.JobExecutionCleanupError = JobExecutionCleanupError;
exports.JobExecutionJournal = JobExecutionJournal;
exports.JobOutbox = JobOutbox;
exports.JobRetentionCleanup = JobRetentionCleanup;
exports.JobSnapshot = JobSnapshot;
exports.isJobExecutionCleanupFailure = isJobExecutionCleanupFailure;
exports.prepareJob = prepareJob;
exports.reconcileOutboxPage = reconcileOutboxPage;
exports.runJobExecution = runJobExecution;
