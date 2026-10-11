'use strict';

var crypto = require('crypto');
var zod = require('zod');
var util = require('util');
require('timers/promises');

// src/configuration/owned-credentials.ts
var valuesSchema = zod.z.record(zod.z.string(), zod.z.union([zod.z.string(), zod.z.number().finite(), zod.z.boolean()]));
var quarantineSchema = zod.z.object({
  sourceFormat: zod.z.string().min(1).max(200),
  sourceVersion: zod.z.number().int().positive().safe(),
  payload: zod.z.string().min(1).max(1024 * 1024),
  failure: zod.z.enum(["decryption_failed", "invalid_format"])
}).strict();
var storedQuarantineSchema = quarantineSchema.omit({ payload: true }).extend({ encryptedPayload: zod.z.string().min(1) });
var recordSchema = zod.z.object({
  provider: zod.z.string(),
  encrypted: zod.z.string().nullable(),
  publicValues: valuesSchema.default({}),
  endpointBinding: zod.z.string().optional(),
  updatedAt: zod.z.number(),
  quarantine: storedQuarantineSchema.optional()
}).superRefine((record, context) => {
  if (record.quarantine && (record.encrypted !== null || Object.keys(record.publicValues).length > 0 || record.endpointBinding))
    context.addIssue({
      code: "custom",
      message: "Quarantined credentials cannot contain executable configuration"
    });
});
var credentialStateSchema = zod.z.object({
  version: zod.z.literal(2),
  imports: zod.z.array(zod.z.string()).default([]),
  providers: zod.z.array(recordSchema)
});
var initialCredentialState = () => ({ version: 2, imports: [], providers: [] });
var CredentialDecryptionError = class extends Error {
  constructor(provider) {
    super(`Stored credentials for ${provider} are unavailable`);
    this.provider = provider;
  }
  provider;
};
var CredentialValidationError = class extends Error {
  code = "invalid_credentials";
};
var CredentialRepairRequiredError = class extends CredentialDecryptionError {
  code = "credential_repair_required";
};
function endpoint(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("Invalid provider endpoint binding");
  return url.href.replace(/\/+$/, "");
}
var CredentialCodec = class {
  constructor(options) {
    this.options = options;
    if (!options.namespace) throw new Error("A credential namespace is required");
  }
  options;
  key() {
    const key = typeof this.options.encryptionKey === "function" ? this.options.encryptionKey() : this.options.encryptionKey;
    if (!key || key.byteLength !== 32)
      throw new Error("A persistent 32-byte encryption key is required for stored credentials");
    return Buffer.from(key);
  }
  descriptor(provider) {
    const descriptor = this.options.descriptors().find((item) => item.id === provider);
    if (!descriptor) throw new Error(`Unknown provider: ${provider}`);
    return descriptor;
  }
  storedValues(record) {
    if (record.quarantine) throw new CredentialRepairRequiredError(record.provider);
    const descriptor = this.descriptor(record.provider);
    for (const [id, value] of Object.entries(record.publicValues ?? {})) {
      const field = descriptor.fields.find((item) => item.id === id);
      if (!field || field.secret || typeof value !== field.kind)
        throw new Error("Invalid public provider configuration");
    }
    try {
      return {
        ...record.publicValues,
        ...record.encrypted ? this.decrypt(record.provider, record.encrypted) : {}
      };
    } catch {
      throw new CredentialDecryptionError(record.provider);
    }
  }
  encrypt(provider, values, purpose = "credentials") {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key(), iv);
    cipher.setAAD(
      Buffer.from(
        `${this.options.namespace}:${provider}:${purpose === "quarantine" ? "quarantine:v1" : "v1"}`
      )
    );
    const content = Buffer.concat([cipher.update(JSON.stringify(values), "utf8"), cipher.final()]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      content.toString("base64url")
    ].join(".");
  }
  decrypt(provider, encoded, purpose = "credentials") {
    const parts = encoded.split(".");
    if (parts.length !== 4 || parts[0] !== "v1" || !parts[1] || !parts[2] || !parts[3])
      throw new Error("Invalid credential envelope");
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid credential envelope");
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key(), iv);
    decipher.setAAD(
      Buffer.from(
        `${this.options.namespace}:${provider}:${purpose === "quarantine" ? "quarantine:v1" : "v1"}`
      )
    );
    decipher.setAuthTag(tag);
    return valuesSchema.parse(
      JSON.parse(
        Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString(
          "utf8"
        )
      )
    );
  }
  resolveState(state, provider) {
    this.descriptor(provider);
    const record = state.providers.find((item) => item.provider === provider);
    if (!record) return {};
    const stored = this.storedValues(record);
    const values = { ...stored };
    if (stored.compatibleApiKey !== void 0) {
      const boundEndpoint = record.endpointBinding ?? stored.baseUrl;
      if (typeof boundEndpoint !== "string" || typeof values.baseUrl !== "string" || endpoint(boundEndpoint) !== endpoint(values.baseUrl))
        delete values.compatibleApiKey;
    }
    return values;
  }
  /** Operator import only. Preserve unreadable input without making it executable. */
  quarantineState(state, provider, input) {
    this.descriptor(provider);
    const quarantine = quarantineSchema.parse(input);
    const marker = `credential-quarantine:v1:${crypto.createHmac("sha256", this.key()).update(
      JSON.stringify(["credential-quarantine-import:v1", this.options.namespace, provider, quarantine])
    ).digest("hex")}`;
    const existing = state.providers.find((record) => record.provider === provider);
    if (existing?.quarantine) {
      if (!util.isDeepStrictEqual(this.readQuarantineState(state, provider), quarantine))
        throw new CredentialValidationError("The credential import conflicts with an existing record");
      state.version = 2;
      if (!state.imports.includes(marker)) state.imports.push(marker);
      return;
    }
    if (state.imports.includes(marker)) return;
    if (existing)
      throw new CredentialValidationError("The credential import conflicts with an existing record");
    const retained = {
      sourceFormat: quarantine.sourceFormat,
      sourceVersion: quarantine.sourceVersion,
      failure: quarantine.failure,
      encryptedPayload: this.encrypt(provider, { payload: JSON.stringify(quarantine) }, "quarantine")
    };
    state.version = 2;
    state.providers.push({
      provider,
      encrypted: null,
      publicValues: {},
      updatedAt: Date.now(),
      quarantine: retained
    });
    state.imports.push(marker);
  }
  /** Operator repair only. The caller must authorize access to the retained secret payload. */
  readQuarantineState(state, provider) {
    this.descriptor(provider);
    const retained = state.providers.find((record) => record.provider === provider)?.quarantine;
    if (!retained) return null;
    try {
      const decoded = this.decrypt(provider, retained.encryptedPayload, "quarantine");
      if (typeof decoded.payload !== "string") throw new Error("Invalid quarantine payload");
      const original = quarantineSchema.parse(JSON.parse(decoded.payload));
      if (original.sourceFormat !== retained.sourceFormat || original.sourceVersion !== retained.sourceVersion || original.failure !== retained.failure)
        throw new Error("Quarantine metadata changed");
      return original;
    } catch {
      throw new CredentialDecryptionError(provider);
    }
  }
  /** Explicit repair. The caller must authorize and fence its revision in the same transaction. */
  replaceState(state, provider, values) {
    const next = structuredClone(state);
    this.removeState(next, provider);
    this.configureState(next, provider, values);
    Object.assign(state, next);
  }
  /** Apply within the same transaction as the caller's selection and authorization changes. */
  configureState(state, provider, patch) {
    const descriptor = this.descriptor(provider);
    for (const [key, value] of Object.entries(patch)) {
      const field = descriptor.fields.find((item) => item.id === key);
      if (!field || value !== null && typeof value !== field.kind || typeof value === "string" && value.length > 16384 || typeof value === "number" && !Number.isFinite(value))
        throw new CredentialValidationError("Invalid provider credential field");
    }
    if (typeof patch.baseUrl === "string" && patch.baseUrl) {
      try {
        endpoint(patch.baseUrl);
      } catch {
        throw new CredentialValidationError(
          "Endpoint must be an HTTP(S) URL without credentials, query, or fragment"
        );
      }
    }
    const record = state.providers.find((item) => item.provider === provider);
    const values = record ? this.storedValues(record) : {};
    const endpointChanged = Object.hasOwn(patch, "baseUrl") && patch.baseUrl !== values.baseUrl;
    if (endpointChanged) {
      if (!Object.hasOwn(patch, "compatibleApiKey")) delete values.compatibleApiKey;
      if (!Object.hasOwn(patch, "allowAnonymous")) delete values.allowAnonymous;
    }
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete values[key];
      else values[key] = value;
    }
    const validated = valuesSchema.parse(values);
    if (Object.keys(validated).length === 0) {
      state.providers = state.providers.filter((item) => item.provider !== provider);
      return;
    }
    const secrets = {};
    const publicValues = {};
    for (const [id, value] of Object.entries(validated)) {
      const field = descriptor.fields.find((item) => item.id === id);
      if (!field) throw new Error("Unknown stored provider field");
      (field.secret ? secrets : publicValues)[id] = value;
    }
    const encrypted = Object.keys(secrets).length ? this.encrypt(provider, secrets) : null;
    let endpointBinding = endpointChanged ? void 0 : record?.endpointBinding;
    if (Object.hasOwn(patch, "compatibleApiKey")) {
      const effectiveEndpoint = values.baseUrl;
      endpointBinding = typeof patch.compatibleApiKey === "string" && typeof effectiveEndpoint === "string" ? endpoint(effectiveEndpoint) : void 0;
    }
    state.providers = state.providers.filter((item) => item.provider !== provider);
    state.providers.push({
      provider,
      encrypted,
      publicValues,
      endpointBinding,
      updatedAt: Date.now()
    });
  }
  /** Explicit authorized removal also works when the old encryption key is unavailable. */
  removeState(state, provider) {
    this.descriptor(provider);
    state.providers = state.providers.filter((item) => item.provider !== provider);
  }
  describeState(state, provider) {
    const descriptor = this.descriptor(provider);
    const record = state.providers.find((item) => item.provider === provider);
    const quarantined = record?.quarantine !== void 0;
    const stored = record && !quarantined ? this.storedValues(record) : {};
    const values = quarantined ? {} : this.resolveState(state, provider);
    return {
      provider,
      ...quarantined ? { error: "credential_repair_required" } : {},
      fields: descriptor.fields.map((field) => ({
        id: field.id,
        ...field.id === "compatibleApiKey" && stored.compatibleApiKey !== void 0 && values.compatibleApiKey === void 0 ? { error: "endpoint_binding_mismatch" } : {},
        configured: values[field.id] !== void 0 && values[field.id] !== "",
        source: stored[field.id] !== void 0 ? "stored" : "unset",
        ...field.secret ? {} : { value: values[field.id] }
      }))
    };
  }
};
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

// src/configuration/owned-credentials.ts
var identity = zod.z.string().min(1).max(200);
var revision = zod.z.uuid();
var sequence = zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var ownerSchema = zod.z.object({ subjectId: identity, generation: sequence }).strict();
var bindingSchema = zod.z.object({ protocol: identity, endpoint: zod.z.url() }).strict();
var reasonSchema = zod.z.enum([
  "ready",
  "not_configured",
  "missing_credentials",
  "not_installed",
  "not_authenticated",
  "unreachable",
  "missing_model",
  "unsupported"
]);
var observation = zod.z.object({
  attempt: sequence,
  status: zod.z.enum(["verified", "rejected", "inconclusive"]),
  checkedAt: zod.z.number().finite().nonnegative(),
  reason: reasonSchema
}).strict();
var confirmed = observation.extend({ status: zod.z.enum(["verified", "rejected"]), binding: bindingSchema });
var verificationSchema = zod.z.object({
  nextAttempt: sequence,
  latestAppliedAttempt: sequence,
  lastAttempt: observation.nullable(),
  lastConfirmed: confirmed.nullable()
}).strict();
var timestamp = zod.z.number().finite().nonnegative();
var metadataSchema = zod.z.object({ createdAt: timestamp, updatedAt: timestamp, lastUsedAt: timestamp.nullable() }).strict();
var base = zod.z.object({
  version: zod.z.literal(1),
  namespace: identity,
  instanceId: zod.z.uuid(),
  owner: ownerSchema,
  modality: identity,
  provider: identity,
  credentialRevision: revision
}).strict();
var liveSchema = base.extend({
  kind: zod.z.literal("owned_credential"),
  credentials: credentialStateSchema,
  availability: zod.z.enum(["enabled", "disabled"]),
  binding: bindingSchema,
  verification: verificationSchema,
  label: zod.z.string().max(200).nullable(),
  metadata: metadataSchema,
  operationDigest: zod.z.string().regex(/^[a-f0-9]{64}$/)
});
var removedSchema = base.extend({
  kind: zod.z.literal("owned_credential_removed"),
  previousRevision: revision.nullable()
});
var rowSchema = zod.z.discriminatedUnion("kind", [liveSchema, removedSchema]);
var allocationSchema = zod.z.object({
  version: zod.z.literal(1),
  namespace: identity,
  instanceId: zod.z.uuid(),
  credentialRevision: revision,
  target: zod.z.string().regex(/^c:[a-f0-9]{64}:[a-f0-9]{64}:[a-f0-9]{64}$/),
  operationDigest: zod.z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var OwnedCredentialConflictError = class extends Error {
  constructor() {
    super("Credential changed during the operation");
  }
};
function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
      revision: crypto.randomUUID(),
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
      revision: crypto.randomUUID(),
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
    zod.z.uuid().parse(expectedRevision);
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
      revision: crypto.randomUUID(),
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
      revision: crypto.randomUUID(),
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
      revision: crypto.randomUUID(),
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
      revision: crypto.randomUUID(),
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

exports.OwnedCredentialConflictError = OwnedCredentialConflictError;
exports.OwnedCredentials = OwnedCredentials;
