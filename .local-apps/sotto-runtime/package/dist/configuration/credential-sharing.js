import { sqlStateBackend, sqlStateRows } from '../chunk-2VO27ZQG.js';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';

var identity = z.string().min(1).max(200);
var revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var owner = z.object({ subjectId: identity, generation: revision }).strict();
var slot = z.object({ modality: identity, provider: identity }).strict();
var policy = z.object({
  owner,
  audience: z.literal("household"),
  excludedRecipients: z.array(owner).max(1e4),
  source: z.enum(["explicit", "imported"])
}).strict().refine(
  (value) => new Set(value.excludedRecipients.map((recipient) => JSON.stringify(recipient))).size === value.excludedRecipients.length,
  "Duplicate excluded recipient"
);
var rowSchema = slot.extend({
  version: z.literal(1),
  namespace: identity,
  instanceId: z.uuid(),
  policyRevision: revision,
  policy: policy.nullable()
}).strict();
var CredentialSharingConflictError = class extends Error {
  constructor() {
    super("Credential sharing changed during the operation");
  }
};
function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
var CredentialSharing = class {
  constructor(database, dialect, namespace, instanceId) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.instanceId = instanceId;
    identity.parse(namespace);
    z.uuid().parse(instanceId);
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
      revision: randomUUID(),
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

export { CredentialSharing, CredentialSharingConflictError, householdCredentialRecipient };
