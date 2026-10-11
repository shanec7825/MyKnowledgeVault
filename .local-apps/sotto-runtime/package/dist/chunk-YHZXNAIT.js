import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { isDeepStrictEqual } from 'util';
import { z } from 'zod';

// src/configuration/index.ts
var valuesSchema = z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()]));
var quarantineSchema = z.object({
  sourceFormat: z.string().min(1).max(200),
  sourceVersion: z.number().int().positive().safe(),
  payload: z.string().min(1).max(1024 * 1024),
  failure: z.enum(["decryption_failed", "invalid_format"])
}).strict();
var storedQuarantineSchema = quarantineSchema.omit({ payload: true }).extend({ encryptedPayload: z.string().min(1) });
var recordSchema = z.object({
  provider: z.string(),
  encrypted: z.string().nullable(),
  publicValues: valuesSchema.default({}),
  endpointBinding: z.string().optional(),
  updatedAt: z.number(),
  quarantine: storedQuarantineSchema.optional()
}).superRefine((record, context) => {
  if (record.quarantine && (record.encrypted !== null || Object.keys(record.publicValues).length > 0 || record.endpointBinding))
    context.addIssue({
      code: "custom",
      message: "Quarantined credentials cannot contain executable configuration"
    });
});
var credentialStateSchema = z.object({
  version: z.literal(2),
  imports: z.array(z.string()).default([]),
  providers: z.array(recordSchema)
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
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
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
    const decipher = createDecipheriv("aes-256-gcm", this.key(), iv);
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
    const marker = `credential-quarantine:v1:${createHmac("sha256", this.key()).update(
      JSON.stringify(["credential-quarantine-import:v1", this.options.namespace, provider, quarantine])
    ).digest("hex")}`;
    const existing = state.providers.find((record) => record.provider === provider);
    if (existing?.quarantine) {
      if (!isDeepStrictEqual(this.readQuarantineState(state, provider), quarantine))
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
var CredentialVault = class extends CredentialCodec {
  store;
  constructor(options) {
    super(options);
    this.store = options.store;
  }
  async resolve(provider) {
    return this.resolveState(await this.store.read(), provider);
  }
  async configure(provider, patch) {
    await this.store.transact((state) => this.configureState(state, provider, patch));
  }
  async remove(provider) {
    await this.store.transact((state) => this.removeState(state, provider));
  }
  async describe(provider) {
    return this.describeState(await this.store.read(), provider);
  }
};

export { CredentialCodec, CredentialDecryptionError, CredentialRepairRequiredError, CredentialValidationError, CredentialVault, credentialStateSchema, initialCredentialState };
