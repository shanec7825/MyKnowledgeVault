import { startAuthentication, startRegistration, WebAuthnAbortService } from '@simplewebauthn/browser';
export { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, startRegistration } from '@simplewebauthn/browser';

// src/access/transport/browser.ts
var AccessClientError = class extends Error {
  constructor(code, status = 0) {
    super(code);
    this.code = code;
    this.status = status;
    this.name = "AccessClientError";
  }
  code;
  status;
};
var activeCeremony = null;
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var changesCredential = (action) => ![
  "login",
  "household",
  "open-household",
  "authentication-options",
  "household-authentication-options",
  "reauthentication-options",
  "register-options",
  "household-register-options",
  "session",
  "capabilities"
].includes(action);
var invalidSuccess = (action) => new AccessClientError(changesCredential(action) ? "outcome_unknown" : "invalid_response", 200);
var AccessClient = class {
  endpoint;
  fetcher;
  constructor(options = {}) {
    const endpoint = options.endpoint ?? "/api/access";
    if (!/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(endpoint))
      throw new Error("Access endpoint must be a same-origin path");
    this.endpoint = endpoint.replace(/\/+$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }
  async request(action, body, signal) {
    if (!/^[a-z-]+$/.test(action)) throw new Error("Invalid access action");
    signal?.throwIfAborted();
    let response;
    try {
      response = await this.fetcher(`${this.endpoint}/${action}`, {
        method: body === void 0 ? "GET" : "POST",
        credentials: "same-origin",
        redirect: "error",
        cache: "no-store",
        signal,
        headers: {
          ...body === void 0 ? {} : { "Content-Type": "application/json" },
          ...globalThis.location?.origin ? { "X-Sidedoor-Origin": globalThis.location.origin } : {}
        },
        body: body === void 0 ? void 0 : JSON.stringify(body)
      });
    } catch {
      const uncertain = body !== void 0 && changesCredential(action);
      throw new AccessClientError(
        uncertain ? "outcome_unknown" : signal?.aborted ? "cancelled" : "network_error"
      );
    }
    const value = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status >= 500 && body !== void 0 && changesCredential(action))
        throw new AccessClientError("outcome_unknown", response.status);
      const code = value && typeof value === "object" && "error" in value && typeof value.error === "string" ? value.error : "request_failed";
      throw new AccessClientError(code, response.status);
    }
    if (!record(value)) throw invalidSuccess(action);
    return value;
  }
  async capabilities(signal) {
    const result = await this.request("capabilities", void 0, signal);
    if (typeof result.password !== "boolean" || typeof result.passkeys !== "boolean")
      throw invalidSuccess("capabilities");
    if (result.openHousehold !== void 0 && typeof result.openHousehold !== "boolean")
      throw invalidSuccess("capabilities");
    if (result.householdPasskeys !== void 0 && typeof result.householdPasskeys !== "boolean")
      throw invalidSuccess("capabilities");
    return {
      password: result.password,
      passkeys: result.passkeys,
      ...typeof result.householdPasskeys === "boolean" ? { householdPasskeys: result.householdPasskeys } : {},
      ...typeof result.openHousehold === "boolean" ? { openHousehold: result.openHousehold } : {}
    };
  }
  async sessionRequest(action, body, signal) {
    const result = await this.request(action, body, signal);
    const principal = result.principal;
    if (typeof result.expiresAt !== "number" || !Number.isFinite(result.expiresAt) || result.expiresAt <= 0 || principal !== null && (!record(principal) || typeof principal.id !== "string" || !principal.id || typeof principal.name !== "string" || !principal.name || principal.role !== "owner" && principal.role !== "member"))
      throw invalidSuccess(action);
    if (result.sessionId !== void 0 && typeof result.sessionId !== "string") throw invalidSuccess(action);
    return {
      expiresAt: result.expiresAt,
      principal,
      ...typeof result.sessionId === "string" ? { sessionId: result.sessionId } : {}
    };
  }
  async passkeys(signal) {
    return this.passkeyList("passkeys", signal);
  }
  async householdPasskeys(signal) {
    return this.passkeyList("household-passkeys", signal);
  }
  async passkeyList(action, signal) {
    const result = await this.request(action, void 0, signal);
    if (!Array.isArray(result.passkeys) || !result.passkeys.every(
      (key) => record(key) && typeof key.id === "string" && typeof key.name === "string" && typeof key.createdAt === "number" && typeof key.backedUp === "boolean"
    ))
      throw new AccessClientError("invalid_response");
    return result.passkeys;
  }
  async sessions(signal) {
    const result = await this.request("sessions", void 0, signal);
    if (!Array.isArray(result.sessions) || !result.sessions.every(
      (session) => record(session) && typeof session.id === "string" && typeof session.name === "string" && typeof session.expiresAt === "number" && (session.principalId === null || typeof session.principalId === "string")
    ))
      throw new AccessClientError("invalid_response");
    return result.sessions;
  }
  async recoveryCodes(signal) {
    const result = await this.request("recovery-codes", {}, signal);
    if (!Array.isArray(result.codes) || !result.codes.length || !result.codes.every((code) => typeof code === "string" && code.length > 0))
      throw invalidSuccess("recovery-codes");
    return result.codes;
  }
  changePassword(password, signal) {
    return this.sessionRequest("change-password", { password }, signal);
  }
  async mutation(action, body, signal) {
    const result = await this.request(action, body, signal);
    if (result.ok !== true) throw invalidSuccess(action);
  }
  session(signal) {
    return this.sessionRequest("session", void 0, signal);
  }
  login(name, password, signal) {
    return this.sessionRequest("login", { name, password }, signal);
  }
  enterHousehold(password, signal) {
    return this.sessionRequest("household", { password }, signal);
  }
  enterOpenHousehold(signal) {
    return this.sessionRequest("open-household", {}, signal);
  }
  redeemInvitation(code, enrollment, signal) {
    return this.sessionRequest("redeem-invitation", { code, ...enrollment ? { enrollment } : {} }, signal);
  }
  claim(token, name, password, mode, signal) {
    return this.sessionRequest("claim", { token, name, password, mode }, signal);
  }
  recover(code, password, signal) {
    return this.sessionRequest("recover", { code, password }, signal);
  }
  async ceremony(operation, signal) {
    signal?.throwIfAborted();
    if (activeCeremony) throw new AccessClientError("ceremony_busy");
    const owner = {};
    activeCeremony = owner;
    const abort = () => {
      if (activeCeremony === owner) WebAuthnAbortService.cancelCeremony();
    };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AccessClientError) throw error;
      if (signal?.aborted || error instanceof Error && ["NotAllowedError", "AbortError"].includes(error.name))
        throw new AccessClientError("cancelled");
      throw new AccessClientError("passkey_failed");
    } finally {
      signal?.removeEventListener("abort", abort);
      if (activeCeremony === owner) activeCeremony = null;
    }
  }
  authenticatePasskey(signal) {
    return this.passkeyAuthentication(false, signal);
  }
  authenticateHouseholdPasskey(signal) {
    return this.passkeyAuthentication(false, signal, true);
  }
  reauthenticatePasskey(signal) {
    return this.passkeyAuthentication(true, signal);
  }
  reauthenticatePassword(password, signal) {
    return this.sessionRequest("reauthenticate", { password }, signal);
  }
  passkeyAuthentication(reauthenticate, signal, household = false) {
    return this.ceremony(async () => {
      const ceremony = await this.request(
        reauthenticate ? "reauthentication-options" : household ? "household-authentication-options" : "authentication-options",
        {},
        signal
      );
      if (typeof ceremony.ceremony !== "string" || !ceremony.ceremony || !record(ceremony.options) || typeof ceremony.options.challenge !== "string" || typeof ceremony.options.rpId !== "string")
        throw invalidSuccess("authentication-options");
      signal?.throwIfAborted();
      const response = await startAuthentication({ optionsJSON: ceremony.options });
      signal?.throwIfAborted();
      return this.sessionRequest(
        reauthenticate ? "reauthenticate-passkey" : household ? "authenticate-household-passkey" : "authenticate-passkey",
        { ceremony: ceremony.ceremony, response },
        signal
      );
    }, signal);
  }
  registerPasskey(name, signal) {
    return this.registerPasskeyFor(name, signal, false);
  }
  registerHouseholdPasskey(name, signal) {
    return this.registerPasskeyFor(name, signal, true);
  }
  registerPasskeyFor(name, signal, household) {
    return this.ceremony(async () => {
      const ceremony = await this.request(household ? "household-register-options" : "register-options", {}, signal);
      if (typeof ceremony.ceremony !== "string" || !ceremony.ceremony || !record(ceremony.options) || typeof ceremony.options.challenge !== "string" || !record(ceremony.options.rp) || !record(ceremony.options.user) || !Array.isArray(ceremony.options.pubKeyCredParams))
        throw invalidSuccess("register-options");
      signal?.throwIfAborted();
      const response = await startRegistration({ optionsJSON: ceremony.options });
      signal?.throwIfAborted();
      const result = await this.request(
        household ? "register-household-passkey" : "register-passkey",
        { ceremony: ceremony.ceremony, response, name },
        signal
      );
      if (result.ok !== true) throw invalidSuccess("register-passkey");
      return { ok: true };
    }, signal);
  }
};

export { AccessClient, AccessClientError };
