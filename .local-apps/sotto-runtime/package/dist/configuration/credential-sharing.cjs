'use strict';

var crypto = require('crypto');
var zod = require('zod');
require('timers/promises');

// src/configuration/credential-sharing.ts
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

// src/configuration/credential-sharing.ts
var identity = zod.z.string().min(1).max(200);
var revision = zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var owner = zod.z.object({ subjectId: identity, generation: revision }).strict();
var slot = zod.z.object({ modality: identity, provider: identity }).strict();
var policy = zod.z.object({
  owner,
  audience: zod.z.literal("household"),
  excludedRecipients: zod.z.array(owner).max(1e4),
  source: zod.z.enum(["explicit", "imported"])
}).strict().refine(
  (value) => new Set(value.excludedRecipients.map((recipient) => JSON.stringify(recipient))).size === value.excludedRecipients.length,
  "Duplicate excluded recipient"
);
var rowSchema = slot.extend({
  version: zod.z.literal(1),
  namespace: identity,
  instanceId: zod.z.uuid(),
  policyRevision: revision,
  policy: policy.nullable()
}).strict();
var CredentialSharingConflictError = class extends Error {
  constructor() {
    super("Credential sharing changed during the operation");
  }
};
function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
var CredentialSharing = class {
  constructor(database, dialect, namespace, instanceId) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.instanceId = instanceId;
    identity.parse(namespace);
    zod.z.uuid().parse(instanceId);
    this.prefix = `g:${digest([namespace, instanceId])}:`;
  }
  database;
  dialect;
  namespace;
  instanceId;
  prefix;
  id(target) {
    const parsed = slot.parse(target);
    return `${this.prefix}${digest([parsed.modality, parsed.provider])}`;
  }
  parse(value, id) {
    const row = rowSchema.parse(value);
    if (row.namespace !== this.namespace || row.instanceId !== this.instanceId || this.id({ modality: row.modality, provider: row.provider }) !== id)
      throw new Error("Credential sharing context mismatch");
    return row;
  }
  async current(target) {
    const id = this.id(target);
    const backend = sqlStateBackend(this.database, this.dialect, id);
    const snapshot = await backend.read();
    return { backend, snapshot, row: snapshot ? this.parse(snapshot.state, id) : null };
  }
  async head(target) {
    const { row } = await this.current(target);
    return { revision: row?.policyRevision ?? null, policy: row ? structuredClone(row.policy) : null };
  }
  async set(target, expectedRevision, value) {
    return this.write(target, expectedRevision, policy.parse(value));
  }
  async remove(target, expectedRevision) {
    return this.write(target, expectedRevision, null);
  }
  async write(target, expectedRevision, value) {
    const captured = slot.parse(target);
    revision.nullable().parse(expectedRevision);
    const current = await this.current(captured);
    if ((current.row?.policyRevision ?? null) !== expectedRevision)
      throw new CredentialSharingConflictError();
    if (expectedRevision === Number.MAX_SAFE_INTEGER)
      throw new Error("Credential sharing revision exhausted");
    const row = {
      ...captured,
      version: 1,
      namespace: this.namespace,
      instanceId: this.instanceId,
      policyRevision: expectedRevision === null ? 0 : expectedRevision + 1,
      policy: value
    };
    if (!await current.backend.compareAndSwap(current.snapshot?.revision ?? null, {
      revision: crypto.randomUUID(),
      state: row
    }))
      throw new CredentialSharingConflictError();
    return row.policyRevision;
  }
  async list(after = null, limit = 100) {
    const rows = await sqlStateRows(this.database, this.dialect, this.prefix, after, limit);
    const items = [];
    for (const raw of rows) {
      if (typeof raw.id !== "string") throw new Error("Invalid credential sharing row");
      const row = this.parse(
        this.dialect === "sqlite" && typeof raw.state === "string" ? JSON.parse(raw.state) : raw.state,
        raw.id
      );
      if (row.policy)
        items.push({
          modality: row.modality,
          provider: row.provider,
          revision: row.policyRevision,
          policy: row.policy
        });
    }
    const last = rows.at(-1);
    return { items, cursor: rows.length === limit && typeof last?.id === "string" ? last.id : null };
  }
};
function householdCredentialRecipient(policy2, recipient) {
  const parsed = owner.parse(recipient);
  return !policy2.excludedRecipients.some(
    (excluded) => excluded.subjectId === parsed.subjectId && excluded.generation === parsed.generation
  );
}

exports.CredentialSharing = CredentialSharing;
exports.CredentialSharingConflictError = CredentialSharingConflictError;
exports.householdCredentialRecipient = householdCredentialRecipient;
