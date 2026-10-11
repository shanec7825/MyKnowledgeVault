import { AccessError, removePrincipalFromState, createPrincipalFromState, newToken, tokenHash, isAccessError, deviceTokenSchema, principalSchema } from '../chunk-7HX5FRYO.js';
export { AccessError, AccessService, InvitationService, PASSWORD_INPUT_MAX_BYTES, PasskeyManagement, PasskeyService, PrincipalManagement, accessStateSchema, hashConfiguredPassword, hashPassword, importPasswordHash, initialAccessState, isAccessError, newToken, passwordHashNeedsUpgrade, removePrincipalFromState, tokenHash, transitionAccessMode, verifyPassword } from '../chunk-7HX5FRYO.js';
import { randomUUID } from 'crypto';
import { createInterface } from 'readline/promises';

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
    const id = randomUUID();
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
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
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

export { DeviceService, HouseholdProfileManagement, HouseholdProfileService, executeAccessCommand, initializeAccess, initializeHouseholdDevices, parseAccessCommand, readLocalResetInput, readLocalSetupInput };
