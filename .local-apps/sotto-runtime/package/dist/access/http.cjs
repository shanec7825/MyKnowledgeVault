'use strict';

var zod = require('zod');
var crypto = require('crypto');
var server = require('@simplewebauthn/server');

// src/access/transport/http.ts

// src/runtime/process/request.ts
var RequestBodyTooLargeError = class extends Error {
  constructor(maxBytes) {
    super("Request body exceeds the allowed size");
    this.maxBytes = maxBytes;
    this.name = "RequestBodyTooLargeError";
  }
  maxBytes;
};
async function readRequestBytes(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error("Invalid request body limit");
  request.signal.throwIfAborted();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let length = 0;
  let cancellation;
  let failure;
  let bytes = new Uint8Array();
  const abort = () => {
    cancellation ??= reader.cancel(request.signal.reason);
    void cancellation.catch(() => void 0);
  };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      request.signal.throwIfAborted();
      const chunk = await reader.read();
      request.signal.throwIfAborted();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > maxBytes) throw new RequestBodyTooLargeError(maxBytes);
      chunks.push(chunk.value);
    }
    bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch (error) {
    failure = { error };
  }
  request.signal.removeEventListener("abort", abort);
  try {
    await (cancellation ?? reader.cancel());
  } catch (error) {
    failure ??= { error };
  } finally {
    reader.releaseLock();
  }
  if (failure) throw failure.error;
  return bytes;
}

// src/access/core/error-brand.ts
var ACCESS_ERROR_BRAND = /* @__PURE__ */ Symbol.for("thesidedoor.access.error");
function hasAccessErrorBrand(error, kind) {
  return error instanceof Error && error[ACCESS_ERROR_BRAND] === kind;
}

// src/access/core/password.ts
var PasswordBusyError = class extends Error {
  [ACCESS_ERROR_BRAND] = "password_busy";
};
var PasswordPolicyError = class extends Error {
  [ACCESS_ERROR_BRAND] = "password_policy";
};
var activeDerivations = 0;
var PASSWORD_INPUT_MAX_BYTES = 8192;
function derive(password, salt, cost) {
  if (activeDerivations >= 4) return Promise.reject(new PasswordBusyError("Password verification is busy"));
  activeDerivations++;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: cost, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  }).finally(() => {
    activeDerivations--;
  });
}
async function hashPassword(password) {
  if (password.length < 12 || Buffer.byteLength(password) > 1024)
    throw new PasswordPolicyError("Password must contain at least 12 characters and at most 1024 bytes");
  return hashConfiguredPassword(password);
}
async function hashConfiguredPassword(password) {
  if (Buffer.byteLength(password) > PASSWORD_INPUT_MAX_BYTES)
    throw new PasswordPolicyError(
      `Existing password exceeds the supported ${PASSWORD_INPUT_MAX_BYTES} UTF-8 bytes`
    );
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:32768:${salt}:${(await derive(password, salt, 32768)).toString("hex")}`;
}

// src/access/core/service.ts
var AccessError = class extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
    this.name = "AccessError";
  }
  code;
  [ACCESS_ERROR_BRAND] = "access";
};
function isAccessError(error) {
  return hasAccessErrorBrand(error, "access") && "code" in error && typeof error.code === "string" && ["unauthorized", "forbidden", "invalid", "rate_limited", "conflict"].includes(error.code);
}
var tokenHash = (token) => (
  // Tokens are 256-bit random credentials. Passwords use the password module's configured scrypt parameters.
  crypto.createHash("sha256").update(token).digest("hex")
);
var newToken = () => crypto.randomBytes(32).toString("base64url");
var principalSchema = zod.z.object({
  id: zod.z.string().min(1),
  name: zod.z.string().min(1),
  role: zod.z.enum(["owner", "member"]),
  passwordHash: zod.z.string().nullable(),
  epoch: zod.z.number().int().nonnegative(),
  sourceVersion: zod.z.string().optional(),
  pendingRole: zod.z.literal("owner").optional(),
  createdAt: zod.z.number()
});
var sessionSchema = zod.z.object({
  id: zod.z.string(),
  selectedProfileId: zod.z.string().min(1).optional(),
  selectedProfileEpoch: zod.z.number().int().nonnegative().optional(),
  selectedProfileSource: zod.z.literal("explicit").optional(),
  principalId: zod.z.string().nullable(),
  epoch: zod.z.number().int(),
  name: zod.z.string(),
  createdAt: zod.z.number(),
  authenticatedAt: zod.z.number(),
  expiresAt: zod.z.number(),
  householdEnrollmentAvailable: zod.z.boolean().optional(),
  admission: zod.z.enum(["password", "passkey", "invitation", "open"]).optional()
});
var passkeyTransportsSchema = zod.z.array(
  zod.z.enum(["usb", "nfc", "ble", "cable", "internal", "hybrid", "smart-card"])
);
var passkeyFields = {
  id: zod.z.string(),
  publicKey: zod.z.string(),
  counter: zod.z.number(),
  transports: passkeyTransportsSchema,
  name: zod.z.string(),
  createdAt: zod.z.number(),
  backedUp: zod.z.boolean()
};
var passkeySchema = zod.z.union([
  zod.z.object({ ...passkeyFields, scope: zod.z.literal("principal").optional(), principalId: zod.z.string() }),
  zod.z.object({
    ...passkeyFields,
    scope: zod.z.literal("household"),
    principalId: zod.z.null(),
    householdEpoch: zod.z.number().int().nonnegative()
  })
]);
var challengeSchema = zod.z.object({
  id: zod.z.string(),
  challenge: zod.z.string(),
  kind: zod.z.enum([
    "register",
    "register-household",
    "authenticate",
    "authenticate-household",
    "reauthenticate"
  ]),
  principalId: zod.z.string().nullable(),
  sessionId: zod.z.string().nullable(),
  originalSessionId: zod.z.string().optional(),
  principalEpoch: zod.z.number().int().nonnegative().optional(),
  householdEpoch: zod.z.number().int().nonnegative().optional(),
  verificationAttempts: zod.z.number().int().nonnegative().optional(),
  rpId: zod.z.string(),
  origin: zod.z.string(),
  expiresAt: zod.z.number()
});
var tokenSchema = zod.z.object({
  id: zod.z.string(),
  kind: zod.z.enum(["claim", "recover", "invite", "pair"]),
  principalId: zod.z.string().nullable(),
  expiresAt: zod.z.number(),
  issuerSessionId: zod.z.string().optional(),
  epoch: zod.z.number().int().optional(),
  activatePendingOwner: zod.z.literal(true).optional(),
  scopes: zod.z.array(zod.z.string()).optional(),
  deviceName: zod.z.string().optional(),
  defaultProfileId: zod.z.string().min(1).optional(),
  defaultProfileEpoch: zod.z.number().int().nonnegative().optional()
}).refine(
  (token) => token.defaultProfileId === void 0 ? token.defaultProfileEpoch === void 0 : token.kind === "pair" && token.principalId === null && token.defaultProfileEpoch !== void 0,
  "Only household pairing tokens can bind a default profile and its generation"
);
var deviceTokenSchema = zod.z.object({
  id: zod.z.string(),
  principalId: zod.z.string().nullable(),
  issuerSessionId: zod.z.string().nullable(),
  defaultProfileId: zod.z.string().min(1).optional(),
  defaultProfileEpoch: zod.z.number().int().nonnegative().optional(),
  epoch: zod.z.number().int(),
  scopes: zod.z.array(zod.z.string()),
  name: zod.z.string(),
  createdAt: zod.z.number(),
  expiresAt: zod.z.number().finite().nullable()
}).refine(
  (device) => device.issuerSessionId !== null || device.principalId !== null,
  "Every device requires a session or local operator principal"
).refine(
  (device) => device.defaultProfileId === void 0 ? device.defaultProfileEpoch === void 0 : device.principalId === null && device.defaultProfileEpoch !== void 0,
  "A household default profile requires its generation and cannot grant principal authority"
);
zod.z.object({
  version: zod.z.literal(1),
  initializations: zod.z.array(zod.z.string()).default([]),
  mode: zod.z.enum(["household", "individual"]),
  policyEpoch: zod.z.number().int().nonnegative().default(0),
  householdPasswordHash: zod.z.string().nullable(),
  householdEpoch: zod.z.number().int().nonnegative(),
  principals: zod.z.array(principalSchema),
  householdProfiles: zod.z.array(
    zod.z.object({
      id: zod.z.string().min(1),
      name: zod.z.string().min(1),
      epoch: zod.z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      ownerPrincipalId: zod.z.string().min(1).optional()
    })
  ).refine(
    (profiles) => new Set(profiles.map((profile) => profile.id)).size === profiles.length,
    "Household profile ids must be unique"
  ).optional(),
  sessions: zod.z.array(sessionSchema),
  passkeys: zod.z.array(passkeySchema),
  challenges: zod.z.array(challengeSchema),
  tokens: zod.z.array(tokenSchema),
  deviceTokens: zod.z.array(deviceTokenSchema).default([]),
  invitations: zod.z.array(
    zod.z.object({
      id: zod.z.string(),
      issuerPrincipalId: zod.z.string(),
      issuerEpoch: zod.z.number().int(),
      policyEpoch: zod.z.number().int(),
      householdEpoch: zod.z.number().int(),
      mode: zod.z.enum(["household", "individual"]),
      remaining: zod.z.number().int().positive().nullable(),
      expiresAt: zod.z.number()
    })
  ).default([]),
  recoveryCodes: zod.z.array(zod.z.object({ id: zod.z.string(), principalId: zod.z.string() })),
  failures: zod.z.array(zod.z.object({ key: zod.z.string(), count: zod.z.number().int(), expiresAt: zod.z.number() }))
});

// src/access/passkey/passkey-management.ts
function revokeHouseholdKey(state, id) {
  const key = state.passkeys.find((item) => item.id === id);
  if (!key || key.scope !== "household" || key.householdEpoch !== state.householdEpoch)
    throw new AccessError("forbidden");
  state.passkeys = state.passkeys.filter((item) => item.id !== id);
  state.householdEpoch++;
  for (const remaining of state.passkeys) {
    if (remaining.scope === "household") remaining.householdEpoch = state.householdEpoch;
  }
  state.sessions = state.sessions.filter((item) => item.principalId !== null);
  state.challenges = state.challenges.filter((item) => !item.kind.endsWith("-household"));
}
var PasskeyManagement = class {
  constructor(access) {
    this.access = access;
  }
  access;
  async list(token) {
    const state = await this.access.store.read();
    const { principal } = this.access.sessionFromState(state, token);
    if (!principal) throw new AccessError("forbidden");
    return state.passkeys.filter((key) => key.scope !== "household" && key.principalId === principal.id).map((key) => ({ id: key.id, name: key.name, createdAt: key.createdAt, backedUp: key.backedUp }));
  }
  async listHousehold(token) {
    const state = await this.access.store.read();
    this.access.sessionFromState(state, token, true);
    return state.passkeys.filter((key) => key.scope === "household" && key.householdEpoch === state.householdEpoch).map((key) => ({ id: key.id, name: key.name, createdAt: key.createdAt, backedUp: key.backedUp }));
  }
  async removeHousehold(token, id) {
    await this.access.store.transact((state) => {
      this.access.sessionFromState(state, token, true, true);
      revokeHouseholdKey(state, id);
    });
  }
  async remove(token, id) {
    await this.access.store.transact((state) => {
      const { principal } = this.access.sessionFromState(state, token, false, true);
      if (!principal) throw new AccessError("forbidden");
      const key = state.passkeys.find((item) => item.id === id);
      if (!key) throw new AccessError("forbidden");
      if (key.scope === "household" || key.principalId !== principal.id) throw new AccessError("forbidden");
      const stored = state.principals.find((item) => item.id === principal.id);
      if (!stored) throw new AccessError("unauthorized");
      if (!stored.passwordHash && state.passkeys.filter((item) => item.principalId === principal.id).length === 1)
        throw new AccessError("conflict");
      state.passkeys = state.passkeys.filter((item) => item.id !== id);
      stored.epoch++;
      state.sessions = state.sessions.filter((item) => item.principalId !== principal.id);
      state.challenges = state.challenges.filter((item) => item.principalId !== principal.id);
    });
  }
};

// src/access/passkey/passkeys.ts
function sameChallenge(left, right) {
  return left.id === right.id && left.challenge === right.challenge && left.kind === right.kind && left.principalId === right.principalId && left.sessionId === right.sessionId && left.originalSessionId === right.originalSessionId && left.principalEpoch === right.principalEpoch && left.householdEpoch === right.householdEpoch && left.rpId === right.rpId && left.origin === right.origin && left.expiresAt === right.expiresAt;
}
var PasskeyService = class extends PasskeyManagement {
  origin;
  rpId;
  name;
  constructor(options) {
    super(options.access);
    this.name = options.name;
    const origin = new URL(options.origin);
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
      throw new AccessError("invalid");
    if (origin.protocol !== "https:" && !(origin.protocol === "http:" && origin.hostname === "localhost"))
      throw new AccessError("invalid");
    this.origin = origin.origin;
    this.rpId = origin.hostname;
  }
  checkOrigin(origin) {
    if (origin !== this.origin) throw new AccessError("forbidden");
  }
  async registrationOptions(token, origin) {
    return this.registrationOptionsFor(token, origin, false);
  }
  async householdRegistrationOptions(token, origin) {
    return this.registrationOptionsFor(token, origin, true);
  }
  async registrationOptionsFor(token, origin, household) {
    this.checkOrigin(origin);
    const state = await this.access.store.read();
    const { principal, session } = this.access.sessionFromState(state, token, false, true);
    if (!household && state.mode === "household" && !this.access.allowPrincipalAccessInHousehold)
      throw new AccessError("forbidden");
    if (household ? principal || !session.householdEnrollmentAvailable || !state.householdPasswordHash : !principal)
      throw new AccessError("forbidden");
    const options = await server.generateRegistrationOptions({
      rpName: this.name,
      rpID: this.rpId,
      userID: new TextEncoder().encode(household ? "household" : principal.id),
      userName: household ? this.name : principal.name,
      attestationType: "none",
      excludeCredentials: state.passkeys.filter(
        (key) => household ? key.scope === "household" && key.householdEpoch === state.householdEpoch : key.scope !== "household" && key.principalId === principal.id
      ).map((key) => ({ id: key.id, transports: key.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" }
    });
    const ceremony = newToken();
    await this.access.store.transact((current) => {
      const currentAuth = this.access.sessionFromState(current, token, false, true);
      if (!household && current.mode === "household" && !this.access.allowPrincipalAccessInHousehold)
        throw new AccessError("forbidden");
      if (household && (currentAuth.principal || !currentAuth.session.householdEnrollmentAvailable || !current.householdPasswordHash))
        throw new AccessError("forbidden");
      current.challenges = current.challenges.filter(
        (item) => item.expiresAt > this.access.now() && item.sessionId !== session.id
      );
      current.challenges.push({
        id: tokenHash(ceremony),
        challenge: options.challenge,
        kind: household ? "register-household" : "register",
        principalId: principal?.id ?? null,
        ...household ? { householdEpoch: current.householdEpoch } : {},
        sessionId: session.id,
        rpId: this.rpId,
        origin,
        expiresAt: this.access.now() + 5 * 60 * 1e3
      });
    });
    return { ceremony, options };
  }
  async consume(ceremony, binding, origin, kind) {
    this.checkOrigin(origin);
    return this.access.store.transact((state) => {
      const challenge = state.challenges.find((item) => item.id === tokenHash(ceremony));
      if (!challenge || challenge.expiresAt <= this.access.now() || challenge.kind !== kind || challenge.origin !== origin || challenge.rpId !== this.rpId || challenge.sessionId !== tokenHash(binding))
        throw new AccessError("unauthorized");
      state.challenges = state.challenges.filter((item) => item.id !== challenge.id);
      return challenge;
    });
  }
  async register(token, ceremony, response, name, origin) {
    return this.registerFor(token, ceremony, response, name, origin, false);
  }
  async registerHousehold(token, ceremony, response, name, origin) {
    return this.registerFor(token, ceremony, response, name, origin, true);
  }
  async registerFor(token, ceremony, response, name, origin, household) {
    await this.access.authenticate(token, false, true);
    const challenge = await this.consume(
      ceremony,
      token,
      origin,
      household ? "register-household" : "register"
    );
    const result = await server.verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      requireUserVerification: true
    });
    if (!result.verified) throw new AccessError("unauthorized");
    const info = result.registrationInfo;
    await this.access.store.transact((state) => {
      const { principal, session } = this.access.sessionFromState(state, token, false, true);
      if (!household && state.mode === "household" && !this.access.allowPrincipalAccessInHousehold)
        throw new AccessError("forbidden");
      if (household ? principal || !session.householdEnrollmentAvailable || !state.householdPasswordHash || challenge.householdEpoch !== state.householdEpoch : !principal || principal.id !== challenge.principalId)
        throw new AccessError("forbidden");
      if (state.passkeys.some((key) => key.id === info.credential.id)) throw new AccessError("conflict");
      state.passkeys.push({
        id: info.credential.id,
        ...household ? { scope: "household", principalId: null, householdEpoch: state.householdEpoch } : { principalId: principal.id },
        publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
        counter: info.credential.counter,
        transports: passkeyTransportsSchema.parse(info.credential.transports ?? []),
        name: name.trim().slice(0, 100) || "Passkey",
        createdAt: this.access.now(),
        backedUp: info.credentialBackedUp
      });
      if (household) session.householdEnrollmentAvailable = false;
    });
  }
  /** Binding is a fresh server-generated, HttpOnly ceremony cookie maintained by the HTTP adapter. */
  async authenticationOptions(binding, origin) {
    return this.authenticationOptionsFor(binding, origin);
  }
  async householdAuthenticationOptions(binding, origin) {
    return this.authenticationOptionsFor(binding, origin, void 0, true);
  }
  async hasHouseholdPasskeys() {
    const state = await this.access.store.read();
    return state.mode === "household" && state.householdPasswordHash !== null && state.passkeys.some((key) => key.scope === "household" && key.householdEpoch === state.householdEpoch);
  }
  async reauthenticationOptions(token, binding, origin) {
    return this.authenticationOptionsFor(binding, origin, token);
  }
  async authenticationOptionsFor(binding, origin, originalToken, household = false) {
    this.checkOrigin(origin);
    if (binding.length < 32 || binding.length > 128) throw new AccessError("invalid");
    let allowCredentials;
    if (!household && (await this.access.store.read()).mode === "household" && !this.access.allowPrincipalAccessInHousehold)
      throw new AccessError("forbidden");
    if (household) {
      const state = await this.access.store.read();
      if (state.mode !== "household" || !state.householdPasswordHash) throw new AccessError("forbidden");
      allowCredentials = state.passkeys.filter((key) => key.scope === "household" && key.householdEpoch === state.householdEpoch).map((key) => ({ id: key.id, transports: key.transports }));
      if (!allowCredentials.length) throw new AccessError("invalid");
    }
    if (originalToken !== void 0) {
      const state = await this.access.store.read();
      const auth = this.access.sessionFromState(state, originalToken);
      if (!auth.principal) throw new AccessError("forbidden");
      allowCredentials = state.passkeys.filter((key) => key.scope !== "household" && key.principalId === auth.principal?.id).map((key) => ({ id: key.id, transports: key.transports }));
      if (!allowCredentials.length) throw new AccessError("invalid");
    }
    const options = await server.generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: "required",
      allowCredentials
    });
    const ceremony = newToken();
    await this.access.store.transact((state) => {
      state.challenges = state.challenges.filter(
        (item) => item.expiresAt > this.access.now() && item.sessionId !== tokenHash(binding)
      );
      if (state.challenges.length >= 1e3) throw new AccessError("rate_limited");
      const auth = originalToken === void 0 ? null : this.access.sessionFromState(state, originalToken);
      if (auth && !auth.principal) throw new AccessError("forbidden");
      state.challenges.push({
        id: tokenHash(ceremony),
        challenge: options.challenge,
        kind: auth ? "reauthenticate" : household ? "authenticate-household" : "authenticate",
        principalId: auth?.principal?.id ?? null,
        ...household ? { householdEpoch: state.householdEpoch } : {},
        originalSessionId: auth?.session.id,
        principalEpoch: auth?.principal?.epoch,
        sessionId: tokenHash(binding),
        rpId: this.rpId,
        origin,
        expiresAt: this.access.now() + 5 * 60 * 1e3
      });
    });
    return { ceremony, options };
  }
  async login(binding, ceremony, response, origin, name = "Passkey browser") {
    return this.completeAuthentication(binding, ceremony, response, origin, name);
  }
  async loginHousehold(binding, ceremony, response, origin, name = "Household passkey browser") {
    return this.completeAuthentication(binding, ceremony, response, origin, name, void 0, true);
  }
  async reauthenticate(token, binding, ceremony, response, origin) {
    return this.completeAuthentication(binding, ceremony, response, origin, "Passkey browser", token);
  }
  async completeAuthentication(binding, ceremony, response, origin, name, originalToken, household = false) {
    this.checkOrigin(origin);
    const snapshot = await this.access.store.read();
    if (!household && snapshot.mode === "household" && !this.access.allowPrincipalAccessInHousehold)
      throw new AccessError("unauthorized");
    const challenge = snapshot.challenges.find((item) => item.id === tokenHash(ceremony));
    const kind = originalToken === void 0 ? household ? "authenticate-household" : "authenticate" : "reauthenticate";
    if (!challenge || challenge.kind !== kind || challenge.expiresAt <= this.access.now() || challenge.sessionId !== tokenHash(binding) || challenge.origin !== origin || challenge.rpId !== this.rpId)
      throw new AccessError("unauthorized");
    const key = snapshot.passkeys.find((item) => item.id === response.id);
    const principal = key?.scope === "household" ? null : snapshot.principals.find((item) => item.id === key?.principalId);
    if (!key || (household ? key.scope !== "household" || snapshot.mode !== "household" || !snapshot.householdPasswordHash || key.householdEpoch !== snapshot.householdEpoch || challenge.householdEpoch !== snapshot.householdEpoch : key.scope === "household" || !principal))
      throw new AccessError("unauthorized");
    if (originalToken !== void 0) {
      const auth = this.access.sessionFromState(snapshot, originalToken);
      if (challenge.originalSessionId !== auth.session.id || challenge.principalId !== principal?.id || auth.principal?.id !== principal?.id || challenge.principalEpoch !== principal?.epoch)
        throw new AccessError("unauthorized");
    }
    if (response.response.userHandle && response.response.userHandle !== Buffer.from(household ? "household" : principal.id).toString("base64url"))
      throw new AccessError("unauthorized");
    await this.access.store.transact((state) => {
      const pending = state.challenges.find((item) => item.id === challenge.id);
      if (!household && state.mode === "household" && !this.access.allowPrincipalAccessInHousehold)
        throw new AccessError("unauthorized");
      if (!pending || !sameChallenge(pending, challenge) || pending.expiresAt <= this.access.now())
        throw new AccessError("unauthorized");
      if ((pending.verificationAttempts ?? 0) >= 5) throw new AccessError("rate_limited");
      pending.verificationAttempts = (pending.verificationAttempts ?? 0) + 1;
    });
    const result = await server.verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      requireUserVerification: true,
      credential: {
        id: key.id,
        publicKey: Buffer.from(key.publicKey, "base64url"),
        counter: key.counter,
        transports: key.transports
      }
    });
    if (!result.verified) throw new AccessError("unauthorized");
    return this.access.store.transact((state) => {
      const pending = state.challenges.find((item) => item.id === challenge.id);
      if (!household && state.mode === "household" && !this.access.allowPrincipalAccessInHousehold)
        throw new AccessError("unauthorized");
      if (!pending || pending.expiresAt <= this.access.now() || !sameChallenge(pending, challenge))
        throw new AccessError("unauthorized");
      if (originalToken !== void 0) {
        const auth = this.access.sessionFromState(state, originalToken);
        if (auth.session.id !== challenge.originalSessionId || auth.principal?.id !== principal?.id || auth.principal?.epoch !== challenge.principalEpoch)
          throw new AccessError("unauthorized");
        state.sessions = state.sessions.filter((session) => session.id !== auth.session.id);
      }
      const current = state.passkeys.find((item) => item.id === key.id);
      const currentPrincipal = principal ? state.principals.find((item) => item.id === principal.id) : null;
      if (!current || current.counter !== key.counter || current.publicKey !== key.publicKey || (household ? current.scope !== "household" || current.householdEpoch !== state.householdEpoch || state.mode !== "household" || !state.householdPasswordHash || pending.householdEpoch !== state.householdEpoch : current.scope === "household" || currentPrincipal?.epoch !== principal?.epoch))
        throw new AccessError("unauthorized");
      current.counter = result.authenticationInfo.newCounter;
      current.backedUp = result.authenticationInfo.credentialBackedUp;
      state.challenges = state.challenges.filter((item) => item.id !== challenge.id);
      return this.access.issueSession(
        state,
        household ? null : principal.id,
        name,
        false,
        household ? "passkey" : void 0
      );
    });
  }
};
var InvitationService = class {
  constructor(access) {
    this.access = access;
  }
  access;
  async issue(ownerToken, options = {}) {
    return (await this.issueDetailed(ownerToken, options)).code;
  }
  async issueDetailed(ownerToken, options = {}) {
    const ttl = options.ttlMs ?? 24 * 60 * 60 * 1e3;
    const uses = options.uses === void 0 ? 1 : options.uses;
    if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 30 * 24 * 60 * 60 * 1e3 || uses !== null && (!Number.isSafeInteger(uses) || uses < 1))
      throw new AccessError("invalid");
    return this.access.store.transact((state) => {
      if (state.mode === "household" && !this.access.allowHouseholdInvitations)
        throw new AccessError("forbidden");
      const auth = this.access.sessionFromState(state, ownerToken, true, true);
      if (!auth.principal) throw new AccessError("forbidden");
      state.invitations = state.invitations.filter((item) => item.expiresAt > this.access.now());
      if (state.invitations.length >= 100) throw new AccessError("rate_limited");
      const raw = newToken();
      state.invitations.push({
        id: tokenHash(raw),
        issuerPrincipalId: auth.principal.id,
        issuerEpoch: auth.principal.epoch,
        policyEpoch: state.policyEpoch,
        householdEpoch: state.householdEpoch,
        mode: state.mode,
        remaining: uses,
        expiresAt: this.access.now() + ttl
      });
      return { code: raw, mode: state.mode };
    });
  }
  valid(state, code) {
    const invitation = state.invitations.find(
      (item) => item.id === tokenHash(code) && item.expiresAt > this.access.now()
    );
    if (!invitation || invitation.mode !== state.mode || invitation.policyEpoch !== state.policyEpoch || invitation.mode === "household" && invitation.householdEpoch !== state.householdEpoch)
      throw new AccessError("unauthorized");
    const issuer = state.principals.find((item) => item.id === invitation.issuerPrincipalId);
    if (!issuer || issuer.role !== "owner" || issuer.epoch !== invitation.issuerEpoch)
      throw new AccessError("unauthorized");
    return invitation;
  }
  async redeem(code, enrollment) {
    const snapshot = await this.access.store.read();
    if (snapshot.mode === "household" && !this.access.allowHouseholdInvitations)
      throw new AccessError("forbidden");
    const invitation = this.valid(snapshot, code);
    if (invitation.mode === "household" && enrollment) throw new AccessError("invalid");
    let name;
    let encoded;
    if (invitation.mode === "individual") {
      name = enrollment?.name.trim();
      if (!name || name.length > 100 || !enrollment) throw new AccessError("invalid");
      encoded = await hashPassword(enrollment.password);
    }
    return this.access.store.transact((state) => {
      const current = this.valid(state, code);
      let principalId = null;
      if (current.mode === "individual") {
        if (!name || !encoded) throw new AccessError("invalid");
        if (state.principals.some((item) => item.name.toLowerCase() === name.toLowerCase()))
          throw new AccessError("conflict");
        principalId = crypto.randomUUID();
        state.principals.push({
          id: principalId,
          name,
          passwordHash: encoded,
          role: "member",
          epoch: 0,
          createdAt: this.access.now()
        });
      }
      if (current.remaining === 1)
        state.invitations = state.invitations.filter((item) => item.id !== current.id);
      else if (current.remaining !== null) current.remaining--;
      return this.access.issueSession(
        state,
        principalId,
        "Invited browser",
        false,
        current.mode === "household" ? "invitation" : void 0
      );
    });
  }
  async revoke(ownerToken, id) {
    await this.access.store.transact((state) => {
      this.access.sessionFromState(state, ownerToken, true, true);
      state.invitations = state.invitations.filter((item) => item.id !== id);
    });
  }
  async list(ownerToken) {
    const state = await this.access.store.read();
    this.access.sessionFromState(state, ownerToken, true);
    return state.invitations.filter((item) => item.expiresAt > this.access.now());
  }
};

// src/access/transport/http.ts
function accessErrorStatus(error) {
  const statuses = {
    unauthorized: 401,
    forbidden: 403,
    invalid: 400,
    rate_limited: 429,
    conflict: 409
  };
  return statuses[error.code];
}
var text = zod.z.string().min(1).max(1024);
var passwordInput = zod.z.string().min(1).refine((value) => Buffer.byteLength(value) <= PASSWORD_INPUT_MAX_BYTES);
var loginSchema = zod.z.object({
  name: text,
  password: passwordInput,
  deviceName: zod.z.string().max(100).optional()
});
var claimSchema = zod.z.object({
  token: text,
  name: text,
  password: text,
  mode: zod.z.enum(["household", "individual"])
});
var credentialBase = zod.z.object({
  id: text,
  rawId: text,
  type: zod.z.literal("public-key"),
  clientExtensionResults: zod.z.record(zod.z.string(), zod.z.unknown())
});
var registrationSchema = zod.z.object({
  ceremony: text,
  name: zod.z.string().max(100).optional(),
  response: credentialBase.extend({
    response: zod.z.object({
      clientDataJSON: zod.z.string().max(16e3),
      attestationObject: zod.z.string().max(48e3),
      transports: zod.z.array(zod.z.enum(["usb", "nfc", "ble", "cable", "internal", "hybrid", "smart-card"])).optional()
    })
  })
});
var authenticationSchema = zod.z.object({
  ceremony: text,
  name: zod.z.string().max(100).optional(),
  response: credentialBase.extend({
    response: zod.z.object({
      clientDataJSON: zod.z.string().max(16e3),
      authenticatorData: zod.z.string().max(16e3),
      signature: zod.z.string().max(16e3),
      userHandle: zod.z.string().max(1024).optional()
    })
  })
});
async function readAccessJson(request) {
  if (!request.body) throw new AccessError("invalid");
  try {
    return JSON.parse(Buffer.from(await readRequestBytes(request, 64e3)).toString("utf8"));
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw new AccessError("invalid");
    throw error;
  }
}
function cookieValue(request, name) {
  const values = (request.headers.get("cookie") ?? "").split(";");
  for (const value of values) {
    const offset = value.indexOf("=");
    if (value.slice(0, offset).trim() === name) return value.slice(offset + 1).trim();
  }
  return null;
}
function configuredOrigin(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("Invalid application origin");
  return url;
}
function validateAccessOrigins(options) {
  const canonical = configuredOrigin(options.origin);
  const origins = [
    canonical.origin,
    ...(options.passwordOrigins ?? []).map((value) => configuredOrigin(value).origin)
  ];
  if (new Set(origins).size !== origins.length) throw new Error("Duplicate application origin");
  return { canonicalOrigin: canonical.origin, passwordOrigins: origins.slice(1) };
}
function createAccessHandler(options) {
  const credentials = new PasskeyManagement(options.access);
  const invitations = new InvitationService(options.access);
  const cookieName = options.cookieName ?? "sidedoor_session";
  const validated = validateAccessOrigins(options);
  const canonical = new URL(validated.canonicalOrigin);
  const origins = [validated.canonicalOrigin, ...validated.passwordOrigins];
  const allowedOrigins = new Set(origins);
  if (!/^[a-zA-Z0-9_-]+$/.test(cookieName)) throw new Error("Invalid session cookie name");
  if (!["http:", "https:"].includes(canonical.protocol) || canonical.username || canonical.password)
    throw new Error("Invalid application origin");
  const supportsPasskeys = canonical.protocol === "https:" || canonical.hostname === "localhost";
  const passkeys = () => {
    if (!supportsPasskeys) throw new AccessError("invalid");
    return new PasskeyService({ access: options.access, origin: options.origin, name: options.name });
  };
  const reply = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  return async function handle(request, action) {
    let requestOrigin = new URL(request.url);
    const cookie = (name, value, age) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${requestOrigin.protocol === "https:" ? "; Secure" : ""}`;
    async function signedIn(token) {
      const auth = await options.access.authenticate(token);
      const response = reply({
        principal: auth.principal,
        expiresAt: auth.session.expiresAt,
        sessionId: auth.session.id
      });
      response.headers.append(
        "Set-Cookie",
        cookie(
          cookieName,
          token,
          Math.max(0, Math.floor((auth.session.expiresAt - options.access.now()) / 1e3))
        )
      );
      return response;
    }
    try {
      if (options.useHostHeader) {
        const host = request.headers.get("host");
        if (host) {
          if (!/^(?:\[[0-9a-fA-F:.]+\]|[a-zA-Z0-9.-]+)(?::[0-9]+)?$/.test(host))
            throw new AccessError("forbidden");
          try {
            requestOrigin = new URL(`${requestOrigin.protocol}//${host}`);
          } catch {
            throw new AccessError("forbidden");
          }
        }
      }
      const hint = request.headers.get("x-sidedoor-origin");
      const browserOrigin = request.headers.get("origin");
      if (hint && browserOrigin && hint !== browserOrigin) throw new AccessError("forbidden");
      if (!allowedOrigins.has(requestOrigin.origin) && options.trustedProxy) {
        const selected = browserOrigin ?? hint;
        if (!selected || !allowedOrigins.has(selected) || request.headers.get("sec-fetch-site") === "cross-site")
          throw new AccessError("forbidden");
        requestOrigin = new URL(selected);
      }
      if (!allowedOrigins.has(requestOrigin.origin)) throw new AccessError("forbidden");
      if (hint && hint !== requestOrigin.origin) throw new AccessError("forbidden");
      const canonicalRequest = requestOrigin.origin === canonical.origin;
      const passkeyAction = [
        "register-options",
        "register-passkey",
        "household-register-options",
        "register-household-passkey",
        "authentication-options",
        "authenticate-passkey",
        "household-authentication-options",
        "authenticate-household-passkey",
        "reauthentication-options",
        "reauthenticate-passkey"
      ].includes(action);
      if (passkeyAction && !canonicalRequest) throw new AccessError("forbidden");
      const token = cookieValue(request, cookieName) ?? "";
      if (request.method === "GET") {
        if (action === "capabilities")
          return reply({
            password: true,
            passkeys: supportsPasskeys && canonicalRequest,
            householdPasskeys: supportsPasskeys && canonicalRequest && await passkeys().hasHouseholdPasskeys(),
            openHousehold: await options.access.supportsOpenHousehold()
          });
        if (action === "session") {
          const auth = await options.access.authenticate(token);
          return reply({
            principal: auth.principal,
            expiresAt: auth.session.expiresAt,
            sessionId: auth.session.id
          });
        }
        if (action === "sessions") return reply({ sessions: await options.access.sessions(token) });
        if (action === "profiles" && options.profiles)
          return reply({ profiles: await options.profiles.list(token) });
        if (action === "selected-profile" && options.profiles)
          return reply({ profile: await options.profiles.selected(token) });
        if (action === "passkeys") return reply({ passkeys: await credentials.list(token) });
        if (action === "household-passkeys")
          return reply({ passkeys: await credentials.listHousehold(token) });
        if (action === "invitations") return reply({ invitations: await invitations.list(token) });
        if (action === "devices" && options.devices)
          return reply({ devices: await options.devices.list(token) });
        return reply({ error: "not_found" }, 404);
      }
      if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
      const jsonContent = /^application\/json(?:\s*;\s*[!#$%&'*+.^_`|~\w-]+=(?:[!#$%&'*+.^_`|~\w-]+|"[^"\r\n]*"))*\s*$/i.test(
        request.headers.get("content-type") ?? ""
      );
      const originlessClient = options.allowOriginlessJsonClients === true && !passkeyAction && jsonContent && !request.headers.has("origin") && !request.headers.has("referer") && !Array.from(request.headers.keys()).some((name) => name.startsWith("sec-fetch-"));
      if (!originlessClient && request.headers.get("origin") !== requestOrigin.origin || request.headers.get("sec-fetch-site") === "cross-site")
        throw new AccessError("forbidden");
      if (!jsonContent) return reply({ error: "unsupported_media_type" }, 415);
      if (Number(request.headers.get("content-length") ?? 0) > 64e3)
        return reply({ error: "body_too_large" }, 413);
      const body = await readAccessJson(request);
      if (action === "check-origin") {
        zod.z.object({}).strict().parse(body);
        return reply({ ok: true });
      }
      if (action === "open-profile" && options.profiles) {
        const input = zod.z.object({ id: text }).parse(body);
        return await signedIn(await options.profiles.enterOpen(input.id, token));
      }
      if (action === "authorize-session" || action === "authorize-owner") {
        zod.z.object({}).strict().parse(body);
        await options.access.authenticate(token, action === "authorize-owner");
        return reply({ ok: true });
      }
      if (action === "select-profile" && options.profiles) {
        const input = zod.z.object({ id: text.nullable() }).parse(body);
        await options.profiles.select(token, input.id);
        return reply({ ok: true });
      }
      if (action === "open-household") {
        zod.z.object({}).strict().parse(body);
        return await signedIn(await options.access.enterOpenHousehold("Household browser", token));
      }
      if (action === "add-member") {
        const input = zod.z.object({ name: text, password: text }).parse(body);
        return reply({ id: await options.access.addMember(token, input.name, input.password) }, 201);
      }
      if (action === "set-role") {
        const input = zod.z.object({ id: text, role: zod.z.enum(["owner", "member"]) }).parse(body);
        await options.access.setRole(token, input.id, input.role);
        return reply({ ok: true });
      }
      if (action === "set-mode") {
        await options.access.setMode(
          token,
          zod.z.object({ mode: zod.z.enum(["household", "individual"]) }).parse(body).mode
        );
        return reply({ ok: true });
      }
      if (action === "configure-household") {
        await options.access.configureHousehold(
          token,
          zod.z.object({ password: text.nullable() }).parse(body).password
        );
        return reply({ ok: true });
      }
      if (action === "issue-invitation") {
        const input = zod.z.object({
          ttlMs: zod.z.number().int().positive().optional(),
          uses: zod.z.number().int().positive().nullable().optional()
        }).parse(body);
        return reply({ ...await invitations.issueDetailed(token, input), origin: requestOrigin.origin });
      }
      if (action === "redeem-invitation") {
        const input = zod.z.object({ code: text, enrollment: zod.z.object({ name: text, password: text }).optional() }).parse(body);
        return await signedIn(await invitations.redeem(input.code, input.enrollment));
      }
      if (action === "revoke-invitation") {
        await invitations.revoke(token, zod.z.object({ id: text }).parse(body).id);
        return reply({ ok: true });
      }
      if (action === "issue-pairing" && options.devices) {
        const input = zod.z.object({ scopes: zod.z.array(text).min(1).max(32), name: text, defaultProfileId: text.optional() }).parse(body);
        return reply({
          code: await options.devices.issuePairing(token, input.scopes, input.name, {
            defaultProfileId: input.defaultProfileId
          })
        });
      }
      if (action === "revoke-device" && options.devices) {
        await options.devices.revoke(token, zod.z.object({ id: text }).parse(body).id);
        return reply({ ok: true });
      }
      if (action === "login") {
        const input = loginSchema.parse(body);
        return await signedIn(await options.access.login(input.name, input.password, input.deviceName));
      }
      if (action === "reauthenticate")
        return await signedIn(
          await options.access.reauthenticate(
            token,
            zod.z.object({ password: passwordInput }).parse(body).password
          )
        );
      if (action === "change-password") {
        const input = zod.z.object({ password: text, currentPassword: passwordInput.optional() }).parse(body);
        return await signedIn(
          await options.access.rotatePrincipalCredential(token, input.password, input.currentPassword)
        );
      }
      if (action === "household") {
        const input = zod.z.object({
          password: passwordInput,
          policy: zod.z.object({
            householdEpoch: zod.z.number().int().nonnegative(),
            policyEpoch: zod.z.number().int().nonnegative()
          }).optional()
        }).parse(body);
        return await signedIn(
          await options.access.enterHousehold(input.password, "Household browser", input.policy)
        );
      }
      if (action === "claim") {
        const input = claimSchema.parse(body);
        return await signedIn(
          await options.access.claimOwner(input.token, input.name, input.password, input.mode)
        );
      }
      if (action === "recover") {
        const input = zod.z.object({ code: text, password: text }).parse(body);
        return await signedIn(await options.access.recover(input.code, input.password));
      }
      if (action === "logout") {
        if (token) await options.access.logout(token);
        const response = reply({ ok: true });
        response.headers.append("Set-Cookie", cookie(cookieName, "", 0));
        return response;
      }
      if (action === "revoke-session") {
        await options.access.revokeSession(token, zod.z.object({ id: text }).parse(body).id);
        return reply({ ok: true });
      }
      if (action === "recovery-codes") return reply({ codes: await options.access.recoveryCodes(token) });
      if (action === "register-options")
        return reply(await passkeys().registrationOptions(token, canonical.origin));
      if (action === "household-register-options")
        return reply(await passkeys().householdRegistrationOptions(token, canonical.origin));
      if (action === "register-passkey") {
        const input = registrationSchema.parse(body);
        await passkeys().register(
          token,
          input.ceremony,
          input.response,
          input.name ?? "Passkey",
          canonical.origin
        );
        return reply({ ok: true });
      }
      if (action === "register-household-passkey") {
        const input = registrationSchema.parse(body);
        await passkeys().registerHousehold(
          token,
          input.ceremony,
          input.response,
          input.name ?? "Passkey",
          canonical.origin
        );
        return reply({ ok: true });
      }
      if (action === "authentication-options" || action === "reauthentication-options" || action === "household-authentication-options") {
        const binding = newToken();
        const response = reply(
          action === "reauthentication-options" ? await passkeys().reauthenticationOptions(token, binding, canonical.origin) : action === "household-authentication-options" ? await passkeys().householdAuthenticationOptions(binding, canonical.origin) : await passkeys().authenticationOptions(binding, canonical.origin)
        );
        response.headers.append("Set-Cookie", cookie(`${cookieName}_ceremony`, binding, 300));
        return response;
      }
      if (action === "authenticate-passkey" || action === "reauthenticate-passkey" || action === "authenticate-household-passkey") {
        const input = authenticationSchema.parse(body);
        const binding = cookieValue(request, `${cookieName}_ceremony`) ?? "";
        const response = await signedIn(
          action === "reauthenticate-passkey" ? await passkeys().reauthenticate(
            token,
            binding,
            input.ceremony,
            input.response,
            canonical.origin
          ) : action === "authenticate-household-passkey" ? await passkeys().loginHousehold(
            binding,
            input.ceremony,
            input.response,
            canonical.origin,
            input.name
          ) : await passkeys().login(binding, input.ceremony, input.response, canonical.origin, input.name)
        );
        response.headers.append("Set-Cookie", cookie(`${cookieName}_ceremony`, "", 0));
        return response;
      }
      if (action === "remove-passkey") {
        await credentials.remove(token, zod.z.object({ id: text }).parse(body).id);
        return reply({ ok: true });
      }
      if (action === "remove-household-passkey") {
        await credentials.removeHousehold(token, zod.z.object({ id: text }).parse(body).id);
        return reply({ ok: true });
      }
      return reply({ error: "not_found" }, 404);
    } catch (error) {
      if (hasAccessErrorBrand(error, "password_busy")) return reply({ error: "rate_limited" }, 429);
      if (hasAccessErrorBrand(error, "password_policy")) return reply({ error: "invalid_password" }, 400);
      if (isAccessError(error)) return reply({ error: error.code }, accessErrorStatus(error));
      if (error instanceof zod.z.ZodError || error instanceof SyntaxError)
        return reply({ error: "invalid_request" }, 400);
      return reply({ error: "access_failed" }, 503);
    }
  };
}

exports.accessErrorStatus = accessErrorStatus;
exports.cookieValue = cookieValue;
exports.createAccessHandler = createAccessHandler;
exports.readAccessJson = readAccessJson;
exports.validateAccessOrigins = validateAccessOrigins;
