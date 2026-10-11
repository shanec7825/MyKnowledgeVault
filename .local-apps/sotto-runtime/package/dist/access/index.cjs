'use strict';

var crypto = require('crypto');
var server = require('@simplewebauthn/server');
var zod = require('zod');
var promises = require('readline/promises');

// src/access/core/service.ts

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
var CURRENT_HASH = /^scrypt:32768:([a-f0-9]{32}):([a-f0-9]{128})$/;
var IMPORTED_HASH = /^scrypt:imported:([a-f0-9]{32}):([a-f0-9]{128})$/;
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
function importPasswordHash(encoded) {
  const match = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(encoded);
  if (!match?.[1] || !match[2]) throw new PasswordPolicyError("Invalid imported password hash");
  return `scrypt:imported:${match[1]}:${match[2]}`;
}
function passwordHashNeedsUpgrade(encoded) {
  return IMPORTED_HASH.test(encoded);
}
async function verifyPassword(password, encoded) {
  if (Buffer.byteLength(password) > PASSWORD_INPUT_MAX_BYTES) return false;
  const current = CURRENT_HASH.exec(encoded);
  const imported = current ? null : IMPORTED_HASH.exec(encoded);
  const match = current ?? imported;
  if (!match?.[1] || !match[2]) return false;
  const expected = Buffer.from(match[2], "hex");
  for (const cost of imported ? [32768, 16384] : [32768]) {
    if (crypto.timingSafeEqual(await derive(password, match[1], cost), expected)) return true;
  }
  return false;
}
function createPrincipalFromState(state, principal) {
  if (!principal.name.trim() || principal.name.length > 100) throw new AccessError("invalid");
  if (state.principals.some(
    (item) => item.id === principal.id || item.name.toLowerCase() === principal.name.toLowerCase()
  ))
    throw new AccessError("conflict");
  if (principal.passwordHash === null && (principal.role === "owner" || state.mode === "individual"))
    throw new AccessError("invalid");
  state.principals.push({ ...principal });
}
function revokePrincipalAccess(state, principal, remove) {
  const sessionIds = new Set(
    state.sessions.filter((session) => session.principalId === principal.id).map((session) => session.id)
  );
  state.sessions = state.sessions.filter(
    (session) => session.principalId !== principal.id && (state.householdProfiles !== void 0 || session.selectedProfileId !== principal.id)
  );
  state.challenges = state.challenges.filter(
    (challenge) => challenge.principalId !== principal.id && !sessionIds.has(challenge.sessionId ?? "") && !sessionIds.has(challenge.originalSessionId ?? "")
  );
  state.tokens = state.tokens.filter(
    (token) => token.principalId !== principal.id && !sessionIds.has(token.issuerSessionId ?? "")
  );
  state.deviceTokens = state.deviceTokens.filter(
    (device) => device.principalId !== principal.id && !sessionIds.has(device.issuerSessionId ?? "")
  );
  state.invitations = state.invitations.filter((invitation) => invitation.issuerPrincipalId !== principal.id);
  state.recoveryCodes = state.recoveryCodes.filter((code) => code.principalId !== principal.id);
  state.failures = state.failures.filter(
    (failure) => failure.key !== rateLimitKey(`password:${principal.name.toLowerCase()}`)
  );
  if (remove) state.passkeys = state.passkeys.filter((passkey) => passkey.principalId !== principal.id);
}
function removePrincipalFromState(state, id) {
  const principal = state.principals.find((item) => item.id === id);
  if (!principal) throw new AccessError("invalid");
  if (principal.role === "owner" && !state.principals.some((item) => item.id !== id && item.role === "owner"))
    throw new AccessError("conflict", "The last owner cannot be deleted.");
  revokePrincipalAccess(state, principal, true);
  state.principals = state.principals.filter((item) => item.id !== id);
}
var PrincipalManagement = class {
  constructor(access) {
    this.access = access;
  }
  access;
  /** Local operator command only. Never expose this method through an HTTP action. */
  async resetPasswordForOperator(id, password) {
    const encoded = await hashPassword(password);
    return this.access.store.transact((state) => {
      const principal = state.principals.find((item) => item.id === id);
      if (!principal) throw new AccessError("invalid");
      if (state.mode === "household" && !this.access.allowPrincipalAccessInHousehold) {
        if (principal.role !== "owner") throw new AccessError("forbidden");
        state.householdPasswordHash = encoded;
        state.householdEpoch++;
        state.passkeys = state.passkeys.filter((key) => key.scope !== "household");
        state.sessions = [];
        state.challenges = state.challenges.filter((item) => !item.kind.endsWith("-household"));
      }
      principal.passwordHash = encoded;
      principal.epoch++;
      revokePrincipalAccess(state, principal, false);
      return principal.role;
    });
  }
  async prepare(mutation) {
    const password = mutation.kind === "delete" ? void 0 : mutation.password;
    const encoded = password ? await hashPassword(password).catch((error) => {
      if (hasAccessErrorBrand(error, "password_policy"))
        throw new AccessError(
          "invalid",
          "Password must contain at least 12 characters and at most 1024 bytes"
        );
      if (hasAccessErrorBrand(error, "password_busy")) throw new AccessError("rate_limited");
      throw error;
    }) : void 0;
    const name = mutation.kind === "create" ? mutation.name.trim() : void 0;
    if (mutation.kind === "create" && (!name || name.length > 100)) throw new AccessError("invalid");
    if (mutation.kind !== "delete" && mutation.role !== void 0 && !["owner", "member"].includes(mutation.role))
      throw new AccessError("invalid");
    const id = mutation.kind === "create" ? crypto.randomUUID() : mutation.id;
    const kind = mutation.kind;
    const requestedRole = mutation.kind === "delete" ? void 0 : mutation.role;
    return {
      id,
      kind,
      apply: (state, ownerToken) => {
        const actor = this.access.sessionFromState(state, ownerToken, true, true).principal;
        if (!actor) throw new AccessError("forbidden");
        if (state.mode === "household" && !this.access.allowPrincipalAccessInHousehold && (encoded || requestedRole === "owner"))
          throw new AccessError("forbidden");
        if (kind === "create") {
          const role2 = requestedRole ?? "member";
          createPrincipalFromState(state, {
            id,
            name,
            passwordHash: encoded ?? null,
            role: role2,
            epoch: 0,
            createdAt: this.access.now()
          });
          return id;
        }
        const principal = state.principals.find((item) => item.id === id);
        if (!principal) throw new AccessError("invalid");
        if (id === actor.id && (kind === "delete" || requestedRole === "member"))
          throw new AccessError("forbidden");
        const losesOwnership = principal.role === "owner" && (kind === "delete" || requestedRole === "member");
        if (losesOwnership && !state.principals.some((item) => item.id !== id && item.role === "owner"))
          throw new AccessError("conflict");
        if (kind === "delete") {
          removePrincipalFromState(state, id);
          return id;
        }
        const role = requestedRole ?? principal.role;
        if (role === "owner" && !encoded && !principal.passwordHash && !state.passkeys.some((passkey) => passkey.principalId === id))
          throw new AccessError("invalid");
        const roleChanged = requestedRole !== void 0 && (role !== principal.role || principal.pendingRole !== void 0);
        if (encoded || roleChanged) {
          if (encoded) principal.passwordHash = encoded;
          if (requestedRole !== void 0) {
            principal.role = role;
            delete principal.pendingRole;
          }
          principal.epoch++;
          revokePrincipalAccess(state, principal, false);
        }
        return id;
      }
    };
  }
  async mutate(ownerToken, mutation) {
    await this.access.authenticate(ownerToken, true, true);
    const prepared = await this.prepare(mutation);
    return this.access.store.transact((state) => prepared.apply(state, ownerToken));
  }
};

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
var rateLimitKey = (scope) => `rate:${scope}`;
var newToken = () => crypto.randomBytes(32).toString("base64url");
function transitionAccessMode(state, mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  state.policyEpoch++;
  state.householdEpoch++;
  state.passkeys = state.passkeys.filter((key) => key.scope !== "household");
  state.challenges = state.challenges.filter((challenge) => !challenge.kind.endsWith("-household"));
  state.sessions = state.sessions.filter((session) => session.principalId !== null);
  state.deviceTokens = state.deviceTokens.filter((device) => device.principalId !== null);
  state.tokens = state.tokens.filter((token) => token.kind !== "pair" || token.principalId !== null);
  state.invitations = [];
}
var AccessService2 = class {
  store;
  now;
  recentAuthMs;
  ttl;
  householdTtl;
  allowOpenHousehold;
  allowHouseholdInvitations;
  allowPrincipalAccessInHousehold;
  constructor(options) {
    this.store = options.store;
    this.now = options.now ?? Date.now;
    this.ttl = options.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1e3;
    this.householdTtl = options.householdSessionTtlMs ?? this.ttl;
    this.allowOpenHousehold = options.allowOpenHousehold ?? false;
    this.allowHouseholdInvitations = options.allowHouseholdInvitations ?? false;
    this.allowPrincipalAccessInHousehold = options.allowPrincipalAccessInHousehold ?? false;
    this.recentAuthMs = options.recentAuthMs ?? 5 * 60 * 1e3;
    if (![this.ttl, this.householdTtl, this.recentAuthMs].every(
      (value) => Number.isSafeInteger(value) && value > 0
    ))
      throw new AccessError("invalid");
  }
  sessionFromState(state, token, owner = false, recent = false) {
    const session = state.sessions.find((item) => item.id === tokenHash(token));
    if (!session || session.expiresAt <= this.now()) throw new AccessError("unauthorized");
    const principal = session.principalId ? state.principals.find((item) => item.id === session.principalId) : null;
    if (session.principalId && (!principal || principal.epoch !== session.epoch))
      throw new AccessError("unauthorized");
    if (!principal && (state.mode !== "household" || state.householdEpoch !== session.epoch))
      throw new AccessError("unauthorized");
    const selectedOwner = this.householdOwnerForSession(state, session);
    if (owner && principal?.role !== "owner" && !selectedOwner) throw new AccessError("forbidden");
    if (recent && session.authenticatedAt + this.recentAuthMs <= this.now() && !selectedOwner)
      throw new AccessError("unauthorized");
    const authorizedPrincipal = principal ?? (owner ? selectedOwner : null);
    const safePrincipal = authorizedPrincipal ? {
      id: authorizedPrincipal.id,
      name: authorizedPrincipal.name,
      role: authorizedPrincipal.role,
      epoch: authorizedPrincipal.epoch,
      createdAt: authorizedPrincipal.createdAt
    } : null;
    return { session, principal: safePrincipal };
  }
  householdOwnerForSession(state, session) {
    if (state.mode !== "household" || !state.sessions.includes(session) || session.expiresAt <= this.now() || session.epoch !== state.householdEpoch || session.principalId !== null || state.householdProfiles !== void 0 !== (session.selectedProfileSource === "explicit"))
      return null;
    const profile = state.householdProfiles?.find((item) => item.id === session.selectedProfileId);
    const implicit = state.householdProfiles === void 0 ? state.principals.find((item) => item.id === session.selectedProfileId && !item.pendingRole) : null;
    if (profile && profile.epoch !== session.selectedProfileEpoch) return null;
    if (implicit && implicit.epoch !== session.selectedProfileEpoch) return null;
    if (!profile && !implicit) return null;
    return state.principals.find(
      (item) => item.id === (profile?.ownerPrincipalId ?? profile?.id ?? implicit?.id) && item.role === "owner"
    ) ?? null;
  }
  householdOwnerFromState(state, token) {
    const auth = this.sessionFromState(state, token);
    return auth.principal?.role === "owner" || this.householdOwnerForSession(state, auth.session) !== null;
  }
  async authenticate(token, owner = false, recent = false) {
    return this.sessionFromState(await this.store.read(), token, owner, recent);
  }
  issueSession(state, principalId, name, householdEnrollmentAvailable = false, admission) {
    const principal = principalId ? state.principals.find((item) => item.id === principalId) : null;
    if (principalId && !principal) throw new AccessError("unauthorized");
    const raw = newToken();
    const now = this.now();
    state.sessions = state.sessions.filter((session) => session.expiresAt > now);
    if (state.sessions.length >= 1e4 || !principal && state.sessions.filter((session) => session.principalId === null).length >= 1e3)
      throw new AccessError("rate_limited");
    state.sessions.push({
      id: tokenHash(raw),
      principalId,
      epoch: principal?.epoch ?? state.householdEpoch,
      name: name.slice(0, 100),
      createdAt: now,
      authenticatedAt: now,
      expiresAt: now + (principal ? this.ttl : this.householdTtl),
      ...householdEnrollmentAvailable ? { householdEnrollmentAvailable: true } : {},
      ...admission ? { admission } : {}
    });
    return raw;
  }
  /** Operator-only primitive. Expose through a local command, never an unauthenticated HTTP route. */
  async issueOperatorToken(principalId) {
    return this.store.transact((state) => {
      const principal = state.principals.find((item) => item.id === principalId);
      if (principalId && !principal) throw new AccessError("invalid");
      if (principalId && state.mode === "household" && !this.allowPrincipalAccessInHousehold)
        throw new AccessError("forbidden");
      if (!principalId && state.principals.some((item) => item.role === "owner"))
        throw new AccessError("conflict");
      const raw = newToken();
      state.tokens = state.tokens.filter(
        (item) => item.expiresAt > this.now() && (principalId ? item.kind !== "recover" || item.principalId !== principalId : item.kind !== "claim")
      );
      state.tokens.push({
        id: tokenHash(raw),
        kind: principalId ? "recover" : "claim",
        principalId: principalId ?? null,
        epoch: principal?.epoch,
        activatePendingOwner: principal?.pendingRole === "owner" ? true : void 0,
        expiresAt: this.now() + 15 * 60 * 1e3
      });
      return raw;
    });
  }
  async claimOwner(token, name, password, mode) {
    const normalized = this.validName(name);
    const snapshot = await this.store.read();
    if (!snapshot.tokens.some(
      (item) => item.id === tokenHash(token) && item.kind === "claim" && item.expiresAt > this.now()
    ))
      throw new AccessError("unauthorized");
    const passwordHash = await hashPassword(password);
    return this.store.transact((state) => {
      const claim = state.tokens.find(
        (item) => item.id === tokenHash(token) && item.kind === "claim" && item.expiresAt > this.now()
      );
      if (!claim || state.principals.some((item) => item.role === "owner"))
        throw new AccessError("unauthorized");
      if (state.principals.some((item) => item.name.toLowerCase() === normalized.toLowerCase()))
        throw new AccessError("conflict");
      state.tokens = state.tokens.filter((item) => item.id !== claim.id);
      const principal = {
        id: crypto.randomUUID(),
        name: normalized,
        passwordHash,
        role: "owner",
        epoch: 0,
        createdAt: this.now()
      };
      state.principals.push(principal);
      state.mode = mode;
      if (mode === "household") state.householdPasswordHash = passwordHash;
      return mode === "household" ? this.issueSession(state, null, "Household setup", true, "password") : this.issueSession(state, principal.id, "Owner setup");
    });
  }
  validName(name) {
    const value = name.trim();
    if (!value || value.length > 100) throw new AccessError("invalid");
    return value;
  }
  async addMember(ownerToken, name, password) {
    if (!password) throw new AccessError("invalid");
    return new PrincipalManagement(this).mutate(ownerToken, { kind: "create", name, password });
  }
  /** Reserve an attempt before expensive verification, including concurrent requests. */
  async reserveAttempt(scope) {
    await this.store.transact((state) => {
      state.failures = state.failures.filter((item) => item.expiresAt > this.now());
      const key = rateLimitKey(scope);
      const current = state.failures.find((item) => item.key === key);
      if (current && current.count >= 10) throw new AccessError("rate_limited");
      if (!current && state.failures.length >= 1e3) throw new AccessError("rate_limited");
      if (current) current.count++;
      else state.failures.push({ key, count: 1, expiresAt: this.now() + 15 * 60 * 1e3 });
    });
  }
  async login(name, password, deviceName = "Browser") {
    const normalized = name.trim().toLowerCase();
    await this.reserveAttempt(`password:${normalized}`);
    const snapshot = await this.store.read();
    if (snapshot.mode === "household" && !this.allowPrincipalAccessInHousehold)
      throw new AccessError("unauthorized");
    const candidates = snapshot.principals.filter((item) => item.name.toLowerCase() === normalized);
    const principal = candidates.find((item) => item.name === name.trim()) ?? (candidates.length === 1 ? candidates[0] : void 0);
    const encoded = principal?.passwordHash ?? `scrypt:32768:${"0".repeat(32)}:${"0".repeat(128)}`;
    const valid = await verifyPassword(password, encoded);
    if (!principal || !valid) throw new AccessError("unauthorized");
    const replacement = passwordHashNeedsUpgrade(encoded) ? await hashConfiguredPassword(password) : encoded;
    return this.store.transact((state) => {
      const current = state.principals.find((item) => item.id === principal.id);
      if (!current || current.passwordHash !== encoded || current.epoch !== principal.epoch)
        throw new AccessError("unauthorized");
      if (replacement !== encoded) {
        current.passwordHash = replacement;
        current.epoch++;
      }
      state.failures = state.failures.filter((item) => item.key !== rateLimitKey(`password:${normalized}`));
      return this.issueSession(state, current.id, deviceName);
    });
  }
  async configureHousehold(ownerToken, password) {
    await this.authenticate(ownerToken, true, true);
    if (password === null && !this.allowOpenHousehold) throw new AccessError("forbidden");
    const encoded = password === null ? null : await hashPassword(password);
    await this.store.transact((state) => {
      this.sessionFromState(state, ownerToken, true, true);
      state.householdPasswordHash = encoded;
      state.householdEpoch++;
      for (const principal of state.principals) {
        if (principal.role !== "owner") continue;
        if (encoded !== null) principal.passwordHash = encoded;
        principal.epoch++;
      }
      state.passkeys = state.passkeys.filter((key) => key.scope !== "household");
      state.challenges = state.challenges.filter((challenge) => !challenge.kind.endsWith("-household"));
      state.recoveryCodes = [];
      state.tokens = state.tokens.filter((token) => token.kind !== "recover");
      state.sessions = [];
    });
  }
  /** Local operator only. Replace the shared password when the server owner loses access. */
  async resetHouseholdPasswordForOperator(password) {
    const encoded = await hashPassword(password);
    await this.store.transact((state) => {
      if (state.mode !== "household" || !state.principals.some((principal) => principal.role === "owner"))
        throw new AccessError("conflict");
      state.householdPasswordHash = encoded;
      state.householdEpoch++;
      for (const principal of state.principals) {
        if (principal.role !== "owner") continue;
        principal.passwordHash = encoded;
        principal.epoch++;
      }
      state.passkeys = state.passkeys.filter((key) => key.scope !== "household");
      state.challenges = state.challenges.filter((challenge) => !challenge.kind.endsWith("-household"));
      state.recoveryCodes = [];
      state.tokens = state.tokens.filter((token) => token.kind !== "recover");
      state.sessions = [];
    });
  }
  async setRole(ownerToken, principalId, role) {
    await new PrincipalManagement(this).mutate(ownerToken, { kind: "update", id: principalId, role });
  }
  async setMode(ownerToken, mode) {
    await this.store.transact((state) => {
      this.sessionFromState(state, ownerToken, true, true);
      transitionAccessMode(state, mode);
    });
  }
  async passwordProof(auth, password) {
    if (!auth.principal) throw new AccessError("forbidden");
    await this.reserveAttempt(`password:${auth.principal.name.toLowerCase()}`);
    const snapshot = await this.store.read();
    const principal = snapshot.principals.find((item) => item.id === auth.principal?.id);
    if (!principal?.passwordHash || !await verifyPassword(password, principal.passwordHash))
      throw new AccessError("unauthorized");
    return principal;
  }
  async reauthenticate(token, password) {
    const auth = await this.authenticate(token);
    if ((await this.store.read()).mode === "household" && !this.allowPrincipalAccessInHousehold)
      throw new AccessError("forbidden");
    const principal = await this.passwordProof(auth, password);
    return this.store.transact((state) => {
      this.sessionFromState(state, token);
      const current = state.principals.find((item) => item.id === principal.id);
      if (!current || current.epoch !== principal.epoch || current.passwordHash !== principal.passwordHash)
        throw new AccessError("unauthorized");
      state.sessions = state.sessions.filter((item) => item.id !== auth.session.id);
      state.failures = state.failures.filter(
        (item) => item.key !== rateLimitKey(`password:${principal.name.toLowerCase()}`)
      );
      return this.issueSession(state, principal.id, auth.session.name);
    });
  }
  async rotatePrincipalCredential(token, password, currentPassword) {
    const auth = await this.authenticate(token, false, currentPassword === void 0);
    if ((await this.store.read()).mode === "household" && !this.allowPrincipalAccessInHousehold)
      throw new AccessError("forbidden");
    const proof = currentPassword === void 0 ? null : await this.passwordProof(auth, currentPassword);
    if (!auth.principal) throw new AccessError("forbidden");
    const encoded = await hashPassword(password);
    return this.store.transact((state) => {
      const current = this.sessionFromState(state, token, false, proof === null);
      const principal = state.principals.find((item) => item.id === current.principal?.id);
      if (!principal) throw new AccessError("forbidden");
      if (proof && (principal.epoch !== proof.epoch || principal.passwordHash !== proof.passwordHash))
        throw new AccessError("unauthorized");
      principal.passwordHash = encoded;
      principal.epoch++;
      state.sessions = state.sessions.filter((item) => item.principalId !== principal.id);
      state.challenges = state.challenges.filter((item) => item.principalId !== principal.id);
      state.tokens = state.tokens.filter(
        (item) => item.principalId !== principal.id || item.kind !== "recover"
      );
      state.failures = state.failures.filter(
        (item) => item.key !== rateLimitKey(`password:${principal.name.toLowerCase()}`)
      );
      return this.issueSession(state, principal.id, auth.session.name);
    });
  }
  async enterHousehold(password, deviceName = "Household browser", policy) {
    await this.reserveAttempt("household");
    const snapshot = await this.store.read();
    if (snapshot.mode !== "household" || !snapshot.householdPasswordHash || !await verifyPassword(password, snapshot.householdPasswordHash))
      throw new AccessError("unauthorized");
    const replacement = passwordHashNeedsUpgrade(snapshot.householdPasswordHash) ? await hashConfiguredPassword(password) : snapshot.householdPasswordHash;
    return this.store.transact((state) => {
      if (state.mode !== "household" || state.householdPasswordHash !== snapshot.householdPasswordHash)
        throw new AccessError("unauthorized");
      if (policy && (state.householdEpoch !== policy.householdEpoch || state.policyEpoch !== policy.policyEpoch))
        throw new AccessError("unauthorized");
      if (replacement !== snapshot.householdPasswordHash) {
        state.householdPasswordHash = replacement;
        state.householdEpoch++;
        for (const key of state.passkeys) {
          if (key.scope === "household") key.householdEpoch = state.householdEpoch;
        }
        state.sessions = state.sessions.filter((item) => item.principalId !== null);
      }
      state.failures = state.failures.filter((item) => item.key !== rateLimitKey("household"));
      return this.issueSession(state, null, deviceName, true, "password");
    });
  }
  /** Explicitly enabled household convenience. This grants no authenticated identity. */
  async enterOpenHousehold(deviceName = "Household browser", existingToken) {
    return this.store.transact((state) => this.issueOpenHouseholdSession(state, deviceName, existingToken));
  }
  /** Compose admission with other state mutations in the caller's transaction. */
  issueOpenHouseholdSession(state, deviceName = "Household browser", existingToken) {
    if (!this.allowOpenHousehold) throw new AccessError("forbidden");
    if (state.mode !== "household" || state.householdPasswordHash !== null || !state.principals.some((principal) => principal.role === "owner"))
      throw new AccessError("forbidden");
    const now = this.now();
    if (existingToken && state.sessions.some(
      (session) => session.id === tokenHash(existingToken) && session.principalId === null && session.epoch === state.householdEpoch && session.expiresAt > now
    ))
      return existingToken;
    state.failures = state.failures.filter((attempt) => attempt.expiresAt > now);
    const key = rateLimitKey("open-household");
    const attempts = state.failures.find((attempt) => attempt.key === key);
    if (attempts && attempts.count >= 120) throw new AccessError("rate_limited");
    if (attempts) attempts.count++;
    else {
      if (state.failures.length >= 1e3) throw new AccessError("rate_limited");
      state.failures.push({ key, count: 1, expiresAt: now + 6e4 });
    }
    return this.issueSession(state, null, deviceName, false, "open");
  }
  async supportsOpenHousehold() {
    if (!this.allowOpenHousehold) return false;
    const state = await this.store.read();
    return state.mode === "household" && state.householdPasswordHash === null && state.principals.some((principal) => principal.role === "owner");
  }
  async sessions(token) {
    const state = await this.store.read();
    const auth = this.sessionFromState(state, token);
    return state.sessions.filter(
      (session) => session.expiresAt > this.now() && (this.householdOwnerFromState(state, token) || (auth.principal ? session.principalId === auth.principal.id : session.id === auth.session.id))
    );
  }
  async revokeSession(token, id) {
    await this.store.transact((state) => {
      const auth = this.sessionFromState(state, token);
      const target = state.sessions.find((item) => item.id === id);
      if (!target) return;
      if (!this.householdOwnerFromState(state, token) && (auth.principal ? target.principalId !== auth.principal.id : target.id !== auth.session.id))
        throw new AccessError("forbidden");
      state.sessions = state.sessions.filter((item) => item.id !== id);
    });
  }
  async logout(token) {
    await this.store.transact((state) => {
      state.sessions = state.sessions.filter((session) => session.id !== tokenHash(token));
    });
  }
  async recoveryCodes(token) {
    return this.store.transact((state) => {
      if (state.mode === "household" && !this.allowPrincipalAccessInHousehold)
        throw new AccessError("forbidden");
      const { principal } = this.sessionFromState(state, token, state.mode === "household", true);
      if (!principal) throw new AccessError("forbidden");
      const codes = Array.from({ length: 8 }, newToken);
      state.recoveryCodes = state.recoveryCodes.filter((item) => item.principalId !== principal.id);
      state.recoveryCodes.push(...codes.map((code) => ({ id: tokenHash(code), principalId: principal.id })));
      return codes;
    });
  }
  async recover(code, password) {
    const snapshot = await this.store.read();
    if (snapshot.mode === "household" && !this.allowPrincipalAccessInHousehold)
      throw new AccessError("forbidden");
    const hash = tokenHash(code);
    if (!snapshot.recoveryCodes.some((item) => item.id === hash) && !snapshot.tokens.some(
      (item) => item.id === hash && item.kind === "recover" && item.expiresAt > this.now()
    ))
      throw new AccessError("unauthorized");
    const encoded = await hashPassword(password);
    return this.store.transact((state) => {
      const saved = state.recoveryCodes.find((item) => item.id === hash);
      const operator = state.tokens.find(
        (item) => item.id === hash && item.kind === "recover" && item.expiresAt > this.now()
      );
      const principal = state.principals.find(
        (item) => item.id === (saved?.principalId ?? operator?.principalId)
      );
      if (!principal) throw new AccessError("unauthorized");
      if (!saved && operator?.epoch !== void 0 && operator.epoch !== principal.epoch)
        throw new AccessError("unauthorized");
      if (!saved && operator?.activatePendingOwner) {
        if (operator.epoch === void 0 || principal.pendingRole !== "owner")
          throw new AccessError("unauthorized");
        principal.role = "owner";
        delete principal.pendingRole;
      }
      if (state.mode === "household" && !this.allowPrincipalAccessInHousehold) {
        if (principal.role !== "owner") throw new AccessError("forbidden");
        state.householdPasswordHash = encoded;
        state.householdEpoch++;
        state.passkeys = state.passkeys.filter((key) => key.scope !== "household");
        state.sessions = [];
        state.challenges = state.challenges.filter((item) => !item.kind.endsWith("-household"));
      }
      principal.passwordHash = encoded;
      principal.epoch++;
      state.sessions = state.sessions.filter((item) => item.principalId !== principal.id);
      state.recoveryCodes = state.recoveryCodes.filter((item) => item.principalId !== principal.id);
      state.tokens = state.tokens.filter((item) => item.principalId !== principal.id);
      state.challenges = state.challenges.filter((item) => item.principalId !== principal.id);
      return state.mode === "household" && !this.allowPrincipalAccessInHousehold ? this.issueSession(state, null, "Recovered household", true, "password") : this.issueSession(state, principal.id, "Recovered browser");
    });
  }
};
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
var accessStateSchema = zod.z.object({
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
function initialAccessState() {
  return {
    version: 1,
    initializations: [],
    mode: "household",
    policyEpoch: 0,
    householdPasswordHash: null,
    householdEpoch: 0,
    principals: [],
    sessions: [],
    passkeys: [],
    challenges: [],
    tokens: [],
    deviceTokens: [],
    invitations: [],
    recoveryCodes: [],
    failures: []
  };
}

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

// src/access/identity/profiles.ts
function selectable(principal) {
  return principal.pendingRole !== "owner";
}
function availableProfiles(state) {
  return state.householdProfiles ?? state.principals.filter(selectable);
}
function selectProfile(state, session, profile) {
  session.selectedProfileId = profile.id;
  session.selectedProfileEpoch = profile.epoch;
  if (state.householdProfiles !== void 0) session.selectedProfileSource = "explicit";
  else delete session.selectedProfileSource;
}
var HouseholdProfileService = class {
  constructor(access) {
    this.access = access;
  }
  access;
  async enterOpen(profileId, existingToken) {
    return this.access.store.transact((state) => {
      const profile = availableProfiles(state).find((profile2) => profile2.id === profileId);
      if (!profile) throw new AccessError("forbidden");
      const token = this.access.issueOpenHouseholdSession(state, "Household browser", existingToken);
      const session = this.household(state, token);
      selectProfile(state, session, profile);
      return token;
    });
  }
  async list(token) {
    const state = await this.access.store.read();
    this.household(state, token);
    return availableProfiles(state).map((principal) => ({ id: principal.id, name: principal.name }));
  }
  async select(token, profileId) {
    await this.access.store.transact((state) => {
      const session = this.household(state, token);
      if (profileId === null) {
        delete session.selectedProfileId;
        delete session.selectedProfileEpoch;
        delete session.selectedProfileSource;
        return;
      }
      const profile = availableProfiles(state).find((profile2) => profile2.id === profileId);
      if (!profile) throw new AccessError("forbidden");
      selectProfile(state, session, profile);
    });
  }
  async selected(token) {
    const state = await this.access.store.read();
    return this.selectedFromState(state, token);
  }
  selectedFromState(state, token) {
    const session = this.household(state, token);
    const profile = availableProfiles(state).find((profile2) => profile2.id === session.selectedProfileId);
    if (!profile || profile.epoch !== session.selectedProfileEpoch || state.householdProfiles !== void 0 !== (session.selectedProfileSource === "explicit"))
      return null;
    return { id: profile.id, name: profile.name };
  }
  household(state, token) {
    const auth = this.access.sessionFromState(state, token);
    if (state.mode !== "household" || auth.principal !== null) throw new AccessError("forbidden");
    return auth.session;
  }
};
var HouseholdProfileManagement = class {
  constructor(access, options = {}) {
    this.access = access;
    this.options = options;
    if (!Number.isSafeInteger(options.minimumProfiles ?? 0) || (options.minimumProfiles ?? 0) < 0)
      throw new AccessError("invalid");
  }
  access;
  options;
  authorize(state, credential) {
    if (state.mode !== "household" || state.householdProfiles === void 0)
      throw new AccessError("forbidden");
    if (credential.kind === "session") {
      const { principal } = this.access.sessionFromState(state, credential.token);
      if (this.access.householdOwnerFromState(state, credential.token)) return true;
      if (principal === null && this.options.allowHouseholdManagement) return false;
      throw new AccessError("forbidden");
    }
    if (!this.options.devices) throw new AccessError("forbidden");
    const device = this.options.devices.authenticateFromState(
      state,
      credential.token,
      this.options.requiredDeviceScopes ?? []
    );
    if (device.principal === null && this.options.allowHouseholdManagement) return false;
    if (device.principal?.role === "owner" && this.options.ownerDeviceScope && device.scopes.includes(this.options.ownerDeviceScope))
      return true;
    throw new AccessError("forbidden");
  }
  prepareUpdate(id, displayName) {
    const name = displayName?.trim();
    if (!id || name !== void 0 && (!name || name.length > 100)) throw new AccessError("invalid");
    return {
      id,
      name,
      apply: (state, credential) => {
        const owner = this.authorize(state, credential);
        const profile = state.householdProfiles.find((item) => item.id === id);
        const principal = state.principals.find((item) => item.id === id);
        if (!profile || !principal) throw new AccessError("forbidden");
        if (!owner && (principal.role === "owner" || principal.pendingRole === "owner"))
          throw new AccessError("forbidden");
        if (name !== void 0) profile.name = name;
      }
    };
  }
  /** Application deletion must commit learner data and this mutation together. */
  prepareRemove(id, epoch, confirmed) {
    if (!id || !Number.isSafeInteger(epoch) || epoch < 0 || !confirmed) throw new AccessError("invalid");
    return {
      id,
      apply: (state, credential) => {
        const owner = this.authorize(state, credential);
        if (owner && credential.kind === "session")
          this.access.sessionFromState(state, credential.token, true, true);
        const profile = state.householdProfiles.find((item) => item.id === id);
        const principal = state.principals.find((item) => item.id === id);
        if (!profile || profile.epoch !== epoch) throw new AccessError("conflict");
        if (!principal || principal.role !== "member" || principal.pendingRole)
          throw new AccessError("forbidden");
        if (state.householdProfiles.length <= (this.options.minimumProfiles ?? 0))
          throw new AccessError("conflict", "The last household profile cannot be deleted");
        removePrincipalFromState(state, id);
        state.householdProfiles = state.householdProfiles.filter((item) => item.id !== id);
        state.deviceTokens = state.deviceTokens.filter((device) => device.defaultProfileId !== id);
        state.tokens = state.tokens.filter((token) => token.defaultProfileId !== id);
        for (const session of state.sessions) {
          if (session.selectedProfileId !== id) continue;
          delete session.selectedProfileId;
          delete session.selectedProfileEpoch;
          delete session.selectedProfileSource;
        }
      }
    };
  }
  /** Allocate once before application transaction retries; apply revalidates current authority. */
  prepareCreate(displayName) {
    const name = displayName.trim();
    if (!name || name.length > 100) throw new AccessError("invalid");
    const id = crypto.randomUUID();
    const createdAt = this.access.now();
    return {
      id,
      name,
      apply: (state, credential) => {
        this.authorize(state, credential);
        const base = name.slice(0, 80);
        let loginName = base;
        for (let suffix = 2; state.principals.some((principal) => principal.name.toLowerCase() === loginName.toLowerCase()); suffix++)
          loginName = `${base} (${suffix})`;
        createPrincipalFromState(state, {
          id,
          name: loginName,
          passwordHash: null,
          role: "member",
          epoch: 0,
          createdAt
        });
        state.householdProfiles.push({ id, name, epoch: 0 });
        return id;
      }
    };
  }
};

// src/access/admission/devices.ts
var DeviceService = class {
  constructor(options) {
    this.options = options;
    this.ttl = options.deviceTtlMs ?? 90 * 24 * 60 * 60 * 1e3;
    if (!Number.isSafeInteger(this.ttl) || this.ttl < 1) throw new AccessError("invalid");
    this.limit = options.maxDevicesPerProfile ?? 100;
    if (!Number.isSafeInteger(this.limit) || this.limit < 1) throw new AccessError("invalid");
    this.prefix = options.tokenPrefix ?? "";
    if (typeof this.prefix !== "string" || this.prefix !== "" && !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(this.prefix))
      throw new AccessError("invalid");
    if (options.managementScope !== void 0 && !/^[a-zA-Z0-9_.:-]{1,100}$/.test(options.managementScope))
      throw new AccessError("invalid");
  }
  options;
  ttl;
  prefix;
  limit;
  principal(state, principalId, epoch) {
    if (principalId === null) {
      if (state.mode !== "household" || epoch !== state.householdEpoch) throw new AccessError("unauthorized");
      return null;
    }
    const principal = state.principals.find((item) => item.id === principalId);
    if (!principal || principal.epoch !== epoch) throw new AccessError("unauthorized");
    return {
      id: principal.id,
      name: principal.name,
      role: principal.role,
      epoch: principal.epoch,
      createdAt: principal.createdAt
    };
  }
  scopedPrincipal(state, principal, defaultProfileId) {
    if (principal || !defaultProfileId) return principal;
    const profile = state.householdProfiles?.find((entry) => entry.id === defaultProfileId);
    if (!profile) return null;
    const owner = state.principals.find(
      (entry) => entry.id === (profile.ownerPrincipalId ?? profile.id) && entry.role === "owner"
    );
    return owner ? this.principal(state, owner.id, owner.epoch) : null;
  }
  async issuePairing(sessionToken, scopes, name, options = {}) {
    if (!scopes.length || scopes.length > 32 || scopes.some((scope) => !/^[a-zA-Z0-9_.:-]{1,100}$/.test(scope)) || !name.trim() || name.length > 100)
      throw new AccessError("invalid");
    return this.options.access.store.transact((state) => {
      const auth = this.options.access.sessionFromState(state, sessionToken, false, true);
      let binding;
      if (options.defaultProfileId !== void 0) {
        if (auth.principal !== null) throw new AccessError("forbidden");
        const selected = new HouseholdProfileService(this.options.access).selectedFromState(
          state,
          sessionToken
        );
        const profile = state.householdProfiles?.find((profile2) => profile2.id === selected?.id);
        if (!profile || profile.id !== options.defaultProfileId) throw new AccessError("forbidden");
        binding = { defaultProfileId: profile.id, defaultProfileEpoch: profile.epoch };
      }
      const authority = this.scopedPrincipal(state, auth.principal, binding?.defaultProfileId);
      const allowed = this.options.scopesFor(authority);
      if (scopes.some((scope) => !allowed.includes(scope))) throw new AccessError("forbidden");
      const now = this.options.access.now();
      state.tokens = state.tokens.filter((item) => item.expiresAt > now);
      if (state.tokens.filter((item) => item.kind === "pair" && item.issuerSessionId === auth.session.id).length >= 10)
        throw new AccessError("rate_limited");
      const raw = newToken();
      state.tokens.push({
        id: tokenHash(raw),
        kind: "pair",
        principalId: auth.principal?.id ?? null,
        epoch: auth.session.epoch,
        issuerSessionId: auth.session.id,
        scopes: [...new Set(scopes)],
        deviceName: name.trim(),
        ...binding,
        expiresAt: now + 5 * 60 * 1e3
      });
      return raw;
    });
  }
  async redeemPairing(code) {
    return this.options.access.store.transact((state) => {
      const now = this.options.access.now();
      const pair = state.tokens.find(
        (item) => item.id === tokenHash(code) && item.kind === "pair" && item.expiresAt > now
      );
      if (!pair || pair.epoch === void 0 || !pair.scopes?.length || !pair.issuerSessionId || !pair.deviceName)
        throw new AccessError("unauthorized");
      const issuer = state.sessions.find((item) => item.id === pair.issuerSessionId && item.expiresAt > now);
      if (!issuer || issuer.principalId !== pair.principalId || issuer.epoch !== pair.epoch)
        throw new AccessError("unauthorized");
      const principal = this.principal(state, pair.principalId, pair.epoch);
      if (pair.defaultProfileId !== void 0 && (principal !== null || !state.householdProfiles?.some(
        (profile) => profile.id === pair.defaultProfileId && profile.epoch === pair.defaultProfileEpoch
      )))
        throw new AccessError("unauthorized");
      const allowed = this.options.scopesFor(this.scopedPrincipal(state, principal, pair.defaultProfileId));
      if (pair.scopes.some((scope) => !allowed.includes(scope))) throw new AccessError("forbidden");
      state.deviceTokens = state.deviceTokens.filter(
        (item) => item.expiresAt === null || item.expiresAt > now
      );
      const active = state.deviceTokens.filter((item) => {
        if (item.principalId !== pair.principalId || pair.principalId === null && item.defaultProfileId !== pair.defaultProfileId)
          return false;
        try {
          this.identityFromRecord(state, item, []);
          return true;
        } catch (error) {
          if (isAccessError(error) && error.code === "unauthorized") return false;
          throw error;
        }
      });
      if (active.length >= this.limit) throw new AccessError("rate_limited");
      const raw = this.prefix + newToken();
      state.tokens = state.tokens.filter((item) => item.id !== pair.id);
      state.deviceTokens.push({
        id: tokenHash(raw),
        principalId: pair.principalId,
        issuerSessionId: pair.issuerSessionId,
        epoch: pair.epoch,
        scopes: pair.scopes,
        name: pair.deviceName,
        ...pair.defaultProfileId !== void 0 ? {
          defaultProfileId: pair.defaultProfileId,
          defaultProfileEpoch: pair.defaultProfileEpoch
        } : {},
        createdAt: now,
        expiresAt: now + this.ttl
      });
      return raw;
    });
  }
  async authenticate(token, required) {
    return this.authenticateFromState(await this.options.access.store.read(), token, required);
  }
  /** Local operator primitive. Applications must never expose this method through an unauthenticated route. */
  async issueForOperator(principalId, scopes, name) {
    if (!scopes.length || scopes.length > 32 || scopes.some((scope) => !/^[a-zA-Z0-9_.:-]{1,100}$/.test(scope)) || !name.trim() || name.length > 100)
      throw new AccessError("invalid");
    return this.options.access.store.transact((state) => {
      const principal = state.principals.find((item) => item.id === principalId);
      if (!principal) throw new AccessError("invalid");
      const identity = this.principal(state, principal.id, principal.epoch);
      const allowed = this.options.scopesFor(identity);
      if (scopes.some((scope) => !allowed.includes(scope))) throw new AccessError("forbidden");
      const now = this.options.access.now();
      state.deviceTokens = state.deviceTokens.filter(
        (item) => item.expiresAt === null || item.expiresAt > now
      );
      if (state.deviceTokens.filter((item) => item.principalId === principal.id).length >= this.limit)
        throw new AccessError("rate_limited");
      const raw = this.prefix + newToken();
      state.deviceTokens.push({
        id: tokenHash(raw),
        principalId: principal.id,
        issuerSessionId: null,
        epoch: principal.epoch,
        scopes: [...new Set(scopes)],
        name: name.trim(),
        createdAt: now,
        expiresAt: now + this.ttl
      });
      return raw;
    });
  }
  authenticateFromState(state, token, required) {
    const device = state.deviceTokens.find((item) => item.id === tokenHash(token));
    if (!device) throw new AccessError("unauthorized");
    return this.identityFromRecord(state, device, required);
  }
  /** Display status only. A record ID is never a credential or authorization proof. */
  statusFromState(state, id, required = []) {
    const device = state.deviceTokens.find((item) => item.id === id);
    if (!device) return "unavailable";
    if (device.expiresAt !== null && device.expiresAt <= this.options.access.now()) return "expired";
    try {
      this.identityFromRecord(state, device, required);
      return "active";
    } catch (error) {
      if (isAccessError(error) && ["unauthorized", "forbidden"].includes(error.code)) return "unavailable";
      throw error;
    }
  }
  identityFromRecord(state, device, required) {
    if (device.expiresAt !== null && device.expiresAt <= this.options.access.now())
      throw new AccessError("unauthorized");
    if (device.defaultProfileId && !state.householdProfiles?.some(
      (profile) => profile.id === device.defaultProfileId && profile.epoch === device.defaultProfileEpoch
    ))
      throw new AccessError(
        "unauthorized",
        "The paired profile is no longer available. Pair this device again."
      );
    const principal = this.principal(state, device.principalId, device.epoch);
    const scopedPrincipal = this.scopedPrincipal(state, principal, device.defaultProfileId);
    const allowed = this.options.scopesFor(scopedPrincipal);
    const scopes = device.scopes.filter((scope) => allowed.includes(scope));
    if (required.some((scope) => !scopes.includes(scope))) throw new AccessError("forbidden");
    return {
      id: device.id,
      principal: scopedPrincipal,
      scopes,
      name: device.name,
      expiresAt: device.expiresAt,
      ...device.defaultProfileId ? { defaultProfileId: device.defaultProfileId } : {}
    };
  }
  async list(sessionToken) {
    const state = await this.options.access.store.read();
    const auth = this.options.access.sessionFromState(state, sessionToken);
    return state.deviceTokens.filter(
      (device) => (device.expiresAt === null || device.expiresAt > this.options.access.now()) && (this.options.access.householdOwnerFromState(state, sessionToken) || (auth.principal ? device.principalId === auth.principal.id : device.issuerSessionId === auth.session.id))
    );
  }
  async revoke(sessionToken, id) {
    await this.options.access.store.transact((state) => {
      const auth = this.options.access.sessionFromState(state, sessionToken);
      const device = state.deviceTokens.find((item) => item.id === id);
      if (!device) return;
      if (!this.options.access.householdOwnerFromState(state, sessionToken) && (auth.principal ? device.principalId !== auth.principal.id : device.issuerSessionId !== auth.session.id))
        throw new AccessError("forbidden");
      state.deviceTokens = state.deviceTokens.filter((item) => item.id !== id);
    });
  }
  canManageDevices(identity) {
    return identity.principal?.role === "owner" && this.options.managementScope !== void 0 && identity.scopes.includes(this.options.managementScope);
  }
  async listForDevice(token) {
    const state = await this.options.access.store.read();
    const identity = this.authenticateFromState(state, token, []);
    const manage = this.canManageDevices(identity);
    return state.deviceTokens.filter((device) => manage || device.id === identity.id).map((device) => ({
      id: device.id,
      name: device.name,
      scopes: [...device.scopes],
      createdAt: device.createdAt,
      expiresAt: device.expiresAt
    }));
  }
  async revokeForDevice(token, id) {
    await this.options.access.store.transact((state) => {
      const identity = this.authenticateFromState(state, token, []);
      if (id !== identity.id && !this.canManageDevices(identity)) throw new AccessError("forbidden");
      state.deviceTokens = state.deviceTokens.filter((device) => device.id !== id);
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

// src/access/core/initialization.ts
function initializeHouseholdDevices(state, initialization, devices, allowedScopes) {
  if (!initialization || initialization.length > 200) throw new AccessError("invalid");
  if (state.initializations.includes(initialization)) return false;
  if (state.mode !== "household") throw new AccessError("conflict");
  const ids = new Set(state.deviceTokens.map((device) => device.id));
  const imported = devices.map((device) => {
    const profile = state.householdProfiles?.find((profile2) => profile2.id === device.defaultProfileId);
    if (!/^[a-f0-9]{64}$/.test(device.hash) || ids.has(device.hash) || !profile || !device.scopes.length || device.scopes.some((scope) => !allowedScopes.includes(scope)) || !device.name.trim() || !Number.isSafeInteger(device.createdAt) || device.expiresAt !== null && (!Number.isSafeInteger(device.expiresAt) || device.expiresAt <= device.createdAt))
      throw new AccessError("invalid", "Invalid household device");
    ids.add(device.hash);
    return deviceTokenSchema.parse({
      id: device.hash,
      principalId: null,
      issuerSessionId: `initialize:${initialization}`,
      defaultProfileId: device.defaultProfileId,
      defaultProfileEpoch: profile.epoch,
      epoch: state.householdEpoch,
      scopes: [...new Set(device.scopes)],
      name: device.name,
      createdAt: device.createdAt,
      expiresAt: device.expiresAt
    });
  });
  state.deviceTokens.push(...imported);
  state.initializations.push(initialization);
  return true;
}
async function initializeAccess(store, initialization, input) {
  if (!initialization || initialization.length > 200) throw new AccessError("invalid");
  const principals = input.principals.map((principal) => principalSchema.parse(principal));
  const ids = /* @__PURE__ */ new Set();
  const names = /* @__PURE__ */ new Set();
  for (const principal of principals) {
    if (ids.has(principal.id) || names.has(principal.name)) throw new AccessError("conflict");
    ids.add(principal.id);
    names.add(principal.name);
  }
  for (const encoded of [
    ...principals.map((principal) => principal.passwordHash),
    input.householdPasswordHash
  ]) {
    if (encoded && !/^scrypt:(?:32768|imported):[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded))
      throw new AccessError("invalid", "Invalid password hash format");
  }
  return store.transact((state) => {
    if (state.initializations.includes(initialization)) return false;
    if (state.principals.length || state.sessions.length || state.passkeys.length || state.householdPasswordHash)
      throw new AccessError("conflict");
    state.principals = structuredClone(principals);
    state.mode = input.mode;
    state.householdPasswordHash = input.householdPasswordHash ?? null;
    state.policyEpoch++;
    state.householdEpoch++;
    state.tokens = [];
    state.invitations = [];
    state.deviceTokens = [];
    state.initializations.push(initialization);
    return true;
  });
}
async function hiddenPassword(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode || !process.stderr.isTTY)
    throw new Error("Household setup requires an interactive terminal.");
  process.stderr.write(prompt);
  let value = "";
  process.stdin.setRawMode(true);
  process.stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      const decoder = new TextDecoder();
      const onData = (chunk) => {
        for (const character of decoder.decode(chunk, { stream: true })) {
          if (character === "\r" || character === "\n") {
            process.stdin.off("data", onData);
            resolve(value);
            return;
          }
          if (character === "" || character === "\x1B") {
            process.stdin.off("data", onData);
            reject(new Error("Household setup cancelled."));
            return;
          }
          if (character === "\x7F") value = Array.from(value).slice(0, -1).join("");
          else if (character >= " ") value += character;
        }
      };
      process.stdin.on("data", onData);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stderr.write("\n");
  }
}
async function readLocalSetupInput() {
  if (!process.stdin.isTTY || !process.stderr.isTTY)
    throw new Error("Household setup requires an interactive terminal.");
  const terminal = promises.createInterface({ input: process.stdin, output: process.stderr });
  const name = await terminal.question("First Admin profile name: ");
  terminal.close();
  const password = await hiddenPassword("Shared password: ");
  const confirmation = await hiddenPassword("Confirm shared password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  return { name, password };
}
async function readLocalResetInput() {
  const password = await hiddenPassword("New shared password: ");
  const confirmation = await hiddenPassword("Confirm new shared password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  return password;
}
function parseAccessCommand(args) {
  const [operation, principalId, deviceName] = args;
  if (!operation || !["list", "claim", "recover", "initialize", "device", "setup", "reset"].includes(operation) || (operation === "device" ? args.length < 2 || args.length > 3 || !principalId : args.length !== (operation === "recover" ? 2 : 1)) || operation === "recover" && !principalId)
    throw new Error(
      "Use access list, access setup, access reset, access claim, access recover <principalId>, access device <principalId> [name], or access initialize."
    );
  return { operation, principalId, deviceName };
}
async function executeAccessCommand(access, args, options = {}) {
  const { operation, principalId, deviceName } = parseAccessCommand(args);
  if (operation === "initialize") {
    if (!options.initialize)
      throw new Error("This application does not provide a local access initialization command.");
    const result = await options.initialize();
    return JSON.stringify({ operation, warnings: result.warnings ?? [] });
  }
  if (operation === "list") {
    const state = await access.store.read();
    return JSON.stringify(
      {
        mode: state.mode,
        principals: state.principals.map((principal) => ({
          id: principal.id,
          name: principal.name,
          role: principal.role,
          pendingRole: principal.pendingRole ?? null
        }))
      },
      null,
      2
    );
  }
  if (operation === "setup") {
    if (!options.setupInput) throw new Error("This application does not provide local household setup.");
    const { name, password } = await options.setupInput();
    const code2 = await access.issueOperatorToken();
    await access.claimOwner(code2, name, password, "household");
    return JSON.stringify({ operation, name });
  }
  if (operation === "reset") {
    if (!options.resetInput)
      throw new Error("This application does not provide local household password reset.");
    await access.resetHouseholdPasswordForOperator(await options.resetInput());
    return JSON.stringify({ operation });
  }
  if (operation === "device") {
    if (!options.devices) throw new Error("This application does not provide local device credentials.");
    const token = await options.devices.service.issueForOperator(
      principalId,
      options.devices.scopes,
      deviceName ?? "Local automation"
    );
    return JSON.stringify({
      operation,
      token,
      expiresAt: (await options.devices.service.authenticate(token, [])).expiresAt
    });
  }
  const code = await access.issueOperatorToken(principalId);
  return JSON.stringify({ operation, code, expiresInMinutes: 15 });
}

exports.AccessError = AccessError;
exports.AccessService = AccessService2;
exports.DeviceService = DeviceService;
exports.HouseholdProfileManagement = HouseholdProfileManagement;
exports.HouseholdProfileService = HouseholdProfileService;
exports.InvitationService = InvitationService;
exports.PASSWORD_INPUT_MAX_BYTES = PASSWORD_INPUT_MAX_BYTES;
exports.PasskeyManagement = PasskeyManagement;
exports.PasskeyService = PasskeyService;
exports.PrincipalManagement = PrincipalManagement;
exports.accessStateSchema = accessStateSchema;
exports.executeAccessCommand = executeAccessCommand;
exports.hashConfiguredPassword = hashConfiguredPassword;
exports.hashPassword = hashPassword;
exports.importPasswordHash = importPasswordHash;
exports.initialAccessState = initialAccessState;
exports.initializeAccess = initializeAccess;
exports.initializeHouseholdDevices = initializeHouseholdDevices;
exports.isAccessError = isAccessError;
exports.newToken = newToken;
exports.parseAccessCommand = parseAccessCommand;
exports.passwordHashNeedsUpgrade = passwordHashNeedsUpgrade;
exports.readLocalResetInput = readLocalResetInput;
exports.readLocalSetupInput = readLocalSetupInput;
exports.removePrincipalFromState = removePrincipalFromState;
exports.tokenHash = tokenHash;
exports.transitionAccessMode = transitionAccessMode;
exports.verifyPassword = verifyPassword;
