import { credentialStateSchema, CredentialCodec, CredentialValidationError, initialCredentialState } from '../chunk-YHZXNAIT.js';
import { sqlStateBackend, sqlStateRows } from '../chunk-2VO27ZQG.js';
import { randomUUID, createHash } from 'crypto';
import { z } from 'zod';

var identity = z.string().min(1).max(200);
var revision = z.uuid();
var sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var ownerSchema = z.object({ subjectId: identity, generation: sequence }).strict();
var bindingSchema = z.object({ protocol: identity, endpoint: z.url() }).strict();
var reasonSchema = z.enum([
  "ready",
  "not_configured",
  "missing_credentials",
  "not_installed",
  "not_authenticated",
  "unreachable",
  "missing_model",
  "unsupported"
]);
var observation = z.object({
  attempt: sequence,
  status: z.enum(["verified", "rejected", "inconclusive"]),
  checkedAt: z.number().finite().nonnegative(),
  reason: reasonSchema
}).strict();
var confirmed = observation.extend({ status: z.enum(["verified", "rejected"]), binding: bindingSchema });
var verificationSchema = z.object({
  nextAttempt: sequence,
  latestAppliedAttempt: sequence,
  lastAttempt: observation.nullable(),
  lastConfirmed: confirmed.nullable()
}).strict();
var timestamp = z.number().finite().nonnegative();
var metadataSchema = z.object({ createdAt: timestamp, updatedAt: timestamp, lastUsedAt: timestamp.nullable() }).strict();
var base = z.object({
  version: z.literal(1),
  namespace: identity,
  instanceId: z.uuid(),
  owner: ownerSchema,
  modality: identity,
  provider: identity,
  credentialRevision: revision
}).strict();
var liveSchema = base.extend({
  kind: z.literal("owned_credential"),
  credentials: credentialStateSchema,
  availability: z.enum(["enabled", "disabled"]),
  binding: bindingSchema,
  verification: verificationSchema,
  label: z.string().max(200).nullable(),
  metadata: metadataSchema,
  operationDigest: z.string().regex(/^[a-f0-9]{64}$/)
});
var removedSchema = base.extend({
  kind: z.literal("owned_credential_removed"),
  previousRevision: revision.nullable()
});
var rowSchema = z.discriminatedUnion("kind", [liveSchema, removedSchema]);
var allocationSchema = z.object({
  version: z.literal(1),
  namespace: identity,
  instanceId: z.uuid(),
  credentialRevision: revision,
  target: z.string().regex(/^c:[a-f0-9]{64}:[a-f0-9]{64}:[a-f0-9]{64}$/),
  operationDigest: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var OwnedCredentialConflictError = class extends Error {
  constructor() {
    super("Credential changed during the operation");
  }
};
function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function normalizedBinding(value) {
  const binding = bindingSchema.parse(value);
  const url = new URL(binding.endpoint);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("Invalid credential endpoint binding");
  return { protocol: binding.protocol, endpoint: url.href.replace(/\/+$/, "") };
}
function emptyVerification() {
  return { nextAttempt: 1, latestAppliedAttempt: 0, lastAttempt: null, lastConfirmed: null };
}
function observe(row, attempt, outcome) {
  if (outcome.status === "valid" && (outcome.readiness.authentication !== "verified" || outcome.readiness.code !== "ready"))
    throw new Error("Credential verification requires authenticated proof");
  if (outcome.status === "rejected" && outcome.readiness.code !== "not_authenticated")
    throw new Error("Credential rejection requires an authentication failure");
  const status = outcome.status === "valid" ? "verified" : outcome.status === "rejected" ? "rejected" : "inconclusive";
  const result = observation.parse({
    attempt,
    status,
    checkedAt: outcome.readiness.checkedAt,
    reason: outcome.readiness.code
  });
  row.verification.lastAttempt = result;
  row.verification.latestAppliedAttempt = attempt;
  if (status === "inconclusive") return;
  row.verification.lastConfirmed = { ...result, status, binding: { ...row.binding } };
  if (status === "rejected") row.availability = "disabled";
}
function summary(row) {
  return structuredClone({
    owner: row.owner,
    modality: row.modality,
    provider: row.provider,
    credentialRevision: row.credentialRevision,
    availability: row.availability,
    binding: row.binding,
    verification: row.verification,
    label: row.label,
    metadata: row.metadata
  });
}
function operationDigest(prepared) {
  const record = { ...prepared.record };
  delete record.operationDigest;
  return digest({ expectedHeadRevision: prepared.expectedHeadRevision, record });
}
var OwnedCredentials = class {
  constructor(database, dialect, options) {
    this.database = database;
    this.dialect = dialect;
    this.options = options;
    this.options = { ...options };
    identity.parse(options.namespace);
    revision.parse(options.instanceId);
    this.prefix = `c:${digest([options.namespace, options.instanceId])}:`;
  }
  database;
  dialect;
  options;
  prefix;
  ownerPrefix(owner) {
    const parsed = ownerSchema.parse(owner);
    return `${this.prefix}${digest([parsed.subjectId, parsed.generation])}:`;
  }
  id(target) {
    identity.parse(target.modality);
    identity.parse(target.provider);
    return `${this.ownerPrefix(target.owner)}${digest([target.modality, target.provider])}`;
  }
  codec(target) {
    return new CredentialCodec({
      namespace: this.id(target),
      encryptionKey: this.options.encryptionKey,
      descriptors: this.options.descriptors
    });
  }
  allocation(row) {
    return {
      version: 1,
      namespace: row.namespace,
      instanceId: row.instanceId,
      credentialRevision: row.credentialRevision,
      target: this.id(row),
      operationDigest: row.kind === "owned_credential" ? row.operationDigest : digest({
        kind: row.kind,
        target: this.id(row),
        expectedHeadRevision: row.previousRevision,
        removalRevision: row.credentialRevision
      })
    };
  }
  allocationBackend(row) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `r:${digest([this.options.namespace, this.options.instanceId])}:${row.credentialRevision}`
    );
  }
  async verifyAllocation(row) {
    const receipt = await this.allocationBackend(row).read();
    if (!receipt || digest(allocationSchema.parse(receipt.state)) !== digest(this.allocation(row)))
      throw new Error("Credential revision allocation mismatch");
  }
  async allocate(row) {
    if (!await this.allocationBackend(row).compareAndSwap(null, {
      revision: randomUUID(),
      state: this.allocation(row)
    }))
      throw new OwnedCredentialConflictError();
  }
  parse(value, id) {
    const row = rowSchema.parse(value);
    if (row.namespace !== this.options.namespace || row.instanceId !== this.options.instanceId || this.id(row) !== id)
      throw new Error("Credential ownership context mismatch");
    if (row.kind === "owned_credential_removed") {
      if (row.previousRevision === row.credentialRevision)
        throw new Error("Invalid credential removal revision");
      return row;
    }
    const stored = row.credentials.providers;
    if (stored.length !== 1 || stored[0]?.provider !== row.provider)
      throw new Error(
        "Personal credentials must contain exactly their selected provider without environment authority"
      );
    if (row.credentials.imports.length || row.verification.nextAttempt < 1 || row.verification.latestAppliedAttempt >= row.verification.nextAttempt)
      throw new Error("Invalid credential verification state");
    if (row.verification.lastConfirmed && digest(row.verification.lastConfirmed.binding) !== digest(row.binding))
      throw new Error("Credential verification binding mismatch");
    const verification = row.verification;
    if ((verification.lastAttempt?.attempt ?? 0) !== verification.latestAppliedAttempt || verification.latestAppliedAttempt === 0 !== (verification.lastAttempt === null) || verification.lastConfirmed && (verification.lastConfirmed.attempt < 1 || verification.lastConfirmed.attempt > verification.latestAppliedAttempt))
      throw new Error("Invalid credential verification history");
    if (digest(normalizedBinding(row.binding)) !== digest(row.binding))
      throw new Error("Noncanonical credential endpoint binding");
    for (const result of [verification.lastAttempt, verification.lastConfirmed]) {
      if (result?.status === "verified" && result.reason !== "ready")
        throw new Error("Invalid verified credential history");
      if (result?.status === "rejected" && result.reason !== "not_authenticated")
        throw new Error("Invalid rejected credential history");
    }
    if (verification.lastAttempt && verification.lastAttempt.status !== "inconclusive" && (!verification.lastConfirmed || digest(verification.lastAttempt) !== digest({
      attempt: verification.lastConfirmed.attempt,
      status: verification.lastConfirmed.status,
      checkedAt: verification.lastConfirmed.checkedAt,
      reason: verification.lastConfirmed.reason
    })))
      throw new Error("Credential confirmation history mismatch");
    if (verification.lastConfirmed?.status === "rejected" && row.availability !== "disabled")
      throw new Error("Rejected credential cannot be enabled");
    return row;
  }
  async current(target) {
    const id = this.id(target);
    const backend = sqlStateBackend(this.database, this.dialect, id);
    const snapshot = await backend.read();
    const row = snapshot ? this.parse(snapshot.state, id) : null;
    if (row) await this.verifyAllocation(row);
    return { backend, snapshot, row };
  }
  async head(target) {
    const { row } = await this.current(target);
    return {
      revision: row?.credentialRevision ?? null,
      credential: row?.kind === "owned_credential" ? summary(row) : null
    };
  }
  /** Prepare once before transaction retries. The receipt hashes ciphertext, never plaintext secrets. */
  prepareReplacement(target, input) {
    revision.nullable().parse(input.expectedHeadRevision);
    revision.parse(input.credentialRevision);
    if (input.credentialRevision === input.expectedHeadRevision)
      throw new Error("Replacement requires a fresh credential revision");
    const descriptor = this.options.descriptors().find((item) => item.id === target.provider);
    if (!descriptor) throw new CredentialValidationError("Unknown provider");
    for (const field of descriptor.fields) {
      const value = input.values[field.id];
      if (field.required && (value === void 0 || typeof value === "string" && !value.trim()))
        throw new CredentialValidationError(`Missing required credential field: ${field.id}`);
    }
    const credentials = initialCredentialState();
    if (typeof input.values.baseUrl === "string" && normalizedBinding({ ...input.binding, endpoint: input.values.baseUrl }).endpoint !== normalizedBinding(input.binding).endpoint)
      throw new Error("Credential endpoint does not match verification binding");
    this.codec(target).configureState(credentials, target.provider, input.values);
    const payload = {
      version: 1,
      kind: "owned_credential",
      namespace: this.options.namespace,
      instanceId: this.options.instanceId,
      owner: ownerSchema.parse(target.owner),
      modality: target.modality,
      provider: target.provider,
      credentialRevision: input.credentialRevision,
      credentials,
      binding: normalizedBinding(input.binding),
      availability: input.availability,
      label: input.label,
      metadata: metadataSchema.parse(input.metadata),
      verification: emptyVerification()
    };
    if (input.validation) {
      observe(payload, 1, input.validation);
      payload.verification.nextAttempt = 2;
    }
    const record = {
      ...payload,
      operationDigest: digest({ expectedHeadRevision: input.expectedHeadRevision, record: payload })
    };
    const prepared = { expectedHeadRevision: input.expectedHeadRevision, record };
    this.parse(record, this.id(target));
    return structuredClone(prepared);
  }
  /** Attach a captured probe outcome without encrypting again or changing the operation revision. */
  withValidation(prepared, validation) {
    const row = this.parse(prepared.record, this.id(prepared.record));
    if (row.kind !== "owned_credential" || row.operationDigest !== operationDigest(prepared))
      throw new Error("Credential replacement receipt mismatch");
    if (digest(row.verification) !== digest(emptyVerification()))
      throw new Error("Credential replacement already has verification");
    observe(row, 1, validation);
    row.verification.nextAttempt = 2;
    const result = { expectedHeadRevision: prepared.expectedHeadRevision, record: row };
    row.operationDigest = operationDigest(result);
    return structuredClone(result);
  }
  async replace(prepared) {
    const row = this.parse(prepared.record, this.id(prepared.record));
    if (row.kind !== "owned_credential" || row.operationDigest !== operationDigest(prepared))
      throw new Error("Credential replacement receipt mismatch");
    const current = await this.current(row);
    if (current.row?.credentialRevision === row.credentialRevision) {
      if (current.row.kind === "owned_credential" && current.row.operationDigest === row.operationDigest)
        return "replayed";
      throw new OwnedCredentialConflictError();
    }
    if ((current.row?.credentialRevision ?? null) !== prepared.expectedHeadRevision)
      throw new OwnedCredentialConflictError();
    await this.allocate(row);
    if (!await current.backend.compareAndSwap(current.snapshot?.revision ?? null, {
      revision: randomUUID(),
      state: row
    }))
      throw new OwnedCredentialConflictError();
    return "applied";
  }
  async resolve(target, expectedRevision) {
    const { row } = await this.current(target);
    if (!row || row.kind !== "owned_credential") return null;
    if (expectedRevision !== void 0 && row.credentialRevision !== expectedRevision)
      throw new OwnedCredentialConflictError();
    if (row.availability !== "enabled") throw new Error("Selected credential is disabled");
    return this.decrypted(row);
  }
  /** Caller must authorize editing this owner. Reading never enables a disabled credential. */
  async readForEdit(target, expectedRevision) {
    z.uuid().parse(expectedRevision);
    const { row } = await this.current(target);
    if (!row || row.kind !== "owned_credential" || row.credentialRevision !== expectedRevision)
      throw new OwnedCredentialConflictError();
    return this.decrypted(row);
  }
  decrypted(row) {
    const values = this.codec(row).resolveState(row.credentials, row.provider);
    if (typeof values.baseUrl === "string" && normalizedBinding({ ...row.binding, endpoint: values.baseUrl }).endpoint !== row.binding.endpoint)
      throw new Error("Credential endpoint does not match verification binding");
    return { ...summary(row), values };
  }
  /** Record an initiated external request, even if this revision was subsequently disabled. */
  async recordUse(target, expectedRevision, usedAt) {
    timestamp.parse(usedAt);
    const current = await this.current(target);
    const row = current.row;
    if (!row || row.kind !== "owned_credential" || row.credentialRevision !== expectedRevision)
      return "superseded";
    if (row.metadata.lastUsedAt !== null && row.metadata.lastUsedAt >= usedAt) return "applied";
    row.metadata.lastUsedAt = usedAt;
    if (!await current.backend.compareAndSwap(current.snapshot.revision, {
      revision: randomUUID(),
      state: row
    }))
      throw new OwnedCredentialConflictError();
    return "applied";
  }
  async beginVerification(target, expectedRevision) {
    const current = await this.current(target);
    const row = current.row;
    if (!row || row.kind !== "owned_credential" || row.credentialRevision !== expectedRevision) return null;
    const attempt = row.verification.nextAttempt;
    if (attempt === Number.MAX_SAFE_INTEGER) throw new Error("Credential verification sequence exhausted");
    row.verification.nextAttempt++;
    if (!await current.backend.compareAndSwap(current.snapshot.revision, {
      revision: randomUUID(),
      state: row
    }))
      throw new OwnedCredentialConflictError();
    return structuredClone({
      owner: row.owner,
      modality: row.modality,
      provider: row.provider,
      credentialRevision: row.credentialRevision,
      attempt,
      binding: row.binding
    });
  }
  async finishVerification(ticket, outcome) {
    const current = await this.current(ticket);
    const row = current.row;
    if (!row || row.kind !== "owned_credential" || row.credentialRevision !== ticket.credentialRevision)
      return "superseded";
    sequence.parse(ticket.attempt);
    if (ticket.attempt < 1 || ticket.attempt >= row.verification.nextAttempt || digest(normalizedBinding(ticket.binding)) !== digest(row.binding))
      throw new Error("Invalid credential verification ticket");
    if (ticket.attempt <= row.verification.latestAppliedAttempt) return "superseded";
    observe(row, ticket.attempt, outcome);
    if (!await current.backend.compareAndSwap(current.snapshot.revision, {
      revision: randomUUID(),
      state: row
    }))
      throw new OwnedCredentialConflictError();
    return "applied";
  }
  async remove(target, expectedHeadRevision, removalRevision) {
    const captured = {
      owner: ownerSchema.parse(target.owner),
      modality: identity.parse(target.modality),
      provider: identity.parse(target.provider)
    };
    revision.parse(removalRevision);
    revision.nullable().parse(expectedHeadRevision);
    if (expectedHeadRevision === removalRevision) throw new Error("Removal requires a fresh revision");
    const current = await this.current(captured);
    if (current.row?.kind === "owned_credential_removed" && current.row.credentialRevision === removalRevision && current.row.previousRevision === expectedHeadRevision)
      return "replayed";
    if ((current.row?.credentialRevision ?? null) !== expectedHeadRevision)
      throw new OwnedCredentialConflictError();
    const row = {
      version: 1,
      kind: "owned_credential_removed",
      namespace: this.options.namespace,
      instanceId: this.options.instanceId,
      ...captured,
      credentialRevision: removalRevision,
      previousRevision: expectedHeadRevision
    };
    this.parse(row, this.id(captured));
    await this.allocate(row);
    if (!await current.backend.compareAndSwap(current.snapshot?.revision ?? null, {
      revision: randomUUID(),
      state: row
    }))
      throw new OwnedCredentialConflictError();
    return "applied";
  }
  async scan(prefix, after, limit, owner) {
    const rows = await sqlStateRows(
      this.database,
      this.dialect,
      prefix,
      after,
      limit,
      owner ? "digest" : "compoundDigest"
    );
    const items = [];
    for (const raw of rows) {
      if (typeof raw.id !== "string") throw new Error("Invalid credential row identity");
      const row = this.parse(
        this.dialect === "sqlite" && typeof raw.state === "string" ? JSON.parse(raw.state) : raw.state,
        raw.id
      );
      await this.verifyAllocation(row);
      if (row.kind === "owned_credential") items.push(summary(row));
    }
    const last = rows.at(-1);
    return { items, cursor: rows.length === limit && typeof last?.id === "string" ? last.id : null };
  }
  list(after = null, limit = 100) {
    return this.scan(this.prefix, after, limit, false);
  }
  listOwner(owner, after = null, limit = 100) {
    return this.scan(this.ownerPrefix(owner), after, limit, true);
  }
};

export { OwnedCredentialConflictError, OwnedCredentials };
