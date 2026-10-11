import { randomBytes, timingSafeEqual, createHash, randomUUID, scrypt } from 'crypto';
import { z } from 'zod';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';

// src/access/core/error-brand.ts
var ACCESS_ERROR_BRAND = /* @__PURE__ */ Symbol.for("thesidedoor.access.error");
function hasAccessErrorBrand(error, kind) {
  return error instanceof Error && error[ACCESS_ERROR_BRAND] === kind;
}
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
    scrypt(password, salt, 64, { N: cost, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (error, key) => {
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
  const salt = randomBytes(16).toString("hex");
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
    if (timingSafeEqual(await derive(password, match[1], cost), expected)) return true;
  }
  return false;
}
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
  createHash("sha256").update(token).digest("hex")
);
var rateLimitKey = (scope) => `rate:${scope}`;
var newToken = () => randomBytes(32).toString("base64url");
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
var AccessService = class {
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
        id: randomUUID(),
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

// src/access/identity/principals.ts
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
    const id = mutation.kind === "create" ? randomUUID() : mutation.id;
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
var principalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["owner", "member"]),
  passwordHash: z.string().nullable(),
  epoch: z.number().int().nonnegative(),
  sourceVersion: z.string().optional(),
  pendingRole: z.literal("owner").optional(),
  createdAt: z.number()
});
var sessionSchema = z.object({
  id: z.string(),
  selectedProfileId: z.string().min(1).optional(),
  selectedProfileEpoch: z.number().int().nonnegative().optional(),
  selectedProfileSource: z.literal("explicit").optional(),
  principalId: z.string().nullable(),
  epoch: z.number().int(),
  name: z.string(),
  createdAt: z.number(),
  authenticatedAt: z.number(),
  expiresAt: z.number(),
  householdEnrollmentAvailable: z.boolean().optional(),
  admission: z.enum(["password", "passkey", "invitation", "open"]).optional()
});
var passkeyTransportsSchema = z.array(
  z.enum(["usb", "nfc", "ble", "cable", "internal", "hybrid", "smart-card"])
);
var passkeyFields = {
  id: z.string(),
  publicKey: z.string(),
  counter: z.number(),
  transports: passkeyTransportsSchema,
  name: z.string(),
  createdAt: z.number(),
  backedUp: z.boolean()
};
var passkeySchema = z.union([
  z.object({ ...passkeyFields, scope: z.literal("principal").optional(), principalId: z.string() }),
  z.object({
    ...passkeyFields,
    scope: z.literal("household"),
    principalId: z.null(),
    householdEpoch: z.number().int().nonnegative()
  })
]);
var challengeSchema = z.object({
  id: z.string(),
  challenge: z.string(),
  kind: z.enum([
    "register",
    "register-household",
    "authenticate",
    "authenticate-household",
    "reauthenticate"
  ]),
  principalId: z.string().nullable(),
  sessionId: z.string().nullable(),
  originalSessionId: z.string().optional(),
  principalEpoch: z.number().int().nonnegative().optional(),
  householdEpoch: z.number().int().nonnegative().optional(),
  verificationAttempts: z.number().int().nonnegative().optional(),
  rpId: z.string(),
  origin: z.string(),
  expiresAt: z.number()
});
var tokenSchema = z.object({
  id: z.string(),
  kind: z.enum(["claim", "recover", "invite", "pair"]),
  principalId: z.string().nullable(),
  expiresAt: z.number(),
  issuerSessionId: z.string().optional(),
  epoch: z.number().int().optional(),
  activatePendingOwner: z.literal(true).optional(),
  scopes: z.array(z.string()).optional(),
  deviceName: z.string().optional(),
  defaultProfileId: z.string().min(1).optional(),
  defaultProfileEpoch: z.number().int().nonnegative().optional()
}).refine(
  (token) => token.defaultProfileId === void 0 ? token.defaultProfileEpoch === void 0 : token.kind === "pair" && token.principalId === null && token.defaultProfileEpoch !== void 0,
  "Only household pairing tokens can bind a default profile and its generation"
);
var deviceTokenSchema = z.object({
  id: z.string(),
  principalId: z.string().nullable(),
  issuerSessionId: z.string().nullable(),
  defaultProfileId: z.string().min(1).optional(),
  defaultProfileEpoch: z.number().int().nonnegative().optional(),
  epoch: z.number().int(),
  scopes: z.array(z.string()),
  name: z.string(),
  createdAt: z.number(),
  expiresAt: z.number().finite().nullable()
}).refine(
  (device) => device.issuerSessionId !== null || device.principalId !== null,
  "Every device requires a session or local operator principal"
).refine(
  (device) => device.defaultProfileId === void 0 ? device.defaultProfileEpoch === void 0 : device.principalId === null && device.defaultProfileEpoch !== void 0,
  "A household default profile requires its generation and cannot grant principal authority"
);
var accessStateSchema = z.object({
  version: z.literal(1),
  initializations: z.array(z.string()).default([]),
  mode: z.enum(["household", "individual"]),
  policyEpoch: z.number().int().nonnegative().default(0),
  householdPasswordHash: z.string().nullable(),
  householdEpoch: z.number().int().nonnegative(),
  principals: z.array(principalSchema),
  householdProfiles: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      epoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      ownerPrincipalId: z.string().min(1).optional()
    })
  ).refine(
    (profiles) => new Set(profiles.map((profile) => profile.id)).size === profiles.length,
    "Household profile ids must be unique"
  ).optional(),
  sessions: z.array(sessionSchema),
  passkeys: z.array(passkeySchema),
  challenges: z.array(challengeSchema),
  tokens: z.array(tokenSchema),
  deviceTokens: z.array(deviceTokenSchema).default([]),
  invitations: z.array(
    z.object({
      id: z.string(),
      issuerPrincipalId: z.string(),
      issuerEpoch: z.number().int(),
      policyEpoch: z.number().int(),
      householdEpoch: z.number().int(),
      mode: z.enum(["household", "individual"]),
      remaining: z.number().int().positive().nullable(),
      expiresAt: z.number()
    })
  ).default([]),
  recoveryCodes: z.array(z.object({ id: z.string(), principalId: z.string() })),
  failures: z.array(z.object({ key: z.string(), count: z.number().int(), expiresAt: z.number() }))
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
    const options = await generateRegistrationOptions({
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
    const result = await verifyRegistrationResponse({
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
    const options = await generateAuthenticationOptions({
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
    const result = await verifyAuthenticationResponse({
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
        principalId = randomUUID();
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

export { AccessError, AccessService, InvitationService, PASSWORD_INPUT_MAX_BYTES, PasskeyManagement, PasskeyService, PrincipalManagement, accessStateSchema, createPrincipalFromState, deviceTokenSchema, hasAccessErrorBrand, hashConfiguredPassword, hashPassword, importPasswordHash, initialAccessState, isAccessError, newToken, passwordHashNeedsUpgrade, principalSchema, removePrincipalFromState, tokenHash, transitionAccessMode, verifyPassword };
