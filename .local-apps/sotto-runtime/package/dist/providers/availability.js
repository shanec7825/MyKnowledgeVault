import { OptimisticStateStore } from '../chunk-RTEH6BHA.js';
import { providerIdentity, providerCreditsExhausted } from '../chunk-LXCVA42T.js';
import { createHash, createHmac, randomUUID } from 'crypto';
import { z } from 'zod';

var ProviderCreditsExhaustedError = class extends Error {
  constructor(provider, options) {
    super(
      `${providerIdentity(provider).label} credits are exhausted. Verify provider access before retrying.`,
      options
    );
    this.provider = provider;
    this.name = "ProviderCreditsExhaustedError";
  }
  provider;
  code = "PROVIDER_CREDITS_EXHAUSTED";
};
var storedState = z.object({
  version: z.literal(1),
  identity: z.string().regex(/^[a-f0-9]{64}$/),
  provider: z.string().min(1),
  origin: z.string().min(1),
  status: z.discriminatedUnion("state", [
    z.object({ state: z.literal("unobserved"), checkedAt: z.null() }).strict(),
    z.object({
      state: z.enum(["credits_exhausted", "verified_available"]),
      checkedAt: z.number().finite().nonnegative()
    }).strict()
  ])
}).strict();
var ProviderAvailability = class {
  prefix;
  accounts = /* @__PURE__ */ new WeakSet();
  options;
  constructor(options) {
    if (!options.namespace.trim() || !options.instanceId.trim())
      throw new Error("Provider availability requires an instance and namespace.");
    this.options = Object.freeze({ ...options });
    this.prefix = `availability:${createHash("sha256").update(JSON.stringify([options.namespace, options.instanceId])).digest("hex")}:`;
  }
  captureAccount(selection) {
    providerIdentity(selection.provider);
    if (!selection.credential.trim()) throw new Error("Provider account requires a credential.");
    const url = new URL(selection.origin);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw new Error("Provider account requires a canonical billing origin.");
    const account = Object.freeze({
      provider: selection.provider,
      origin: url.origin,
      identity: createHmac("sha256", selection.credential).update(
        JSON.stringify([this.options.namespace, this.options.instanceId, selection.provider, url.origin])
      ).digest("hex")
    });
    this.accounts.add(account);
    return account;
  }
  state(account) {
    if (!this.accounts.has(account)) throw new Error("Provider account belongs to another registry.");
    const backend = this.options.backend(`${this.prefix}${account.identity}`);
    const parse = (value) => {
      const state = storedState.parse(value);
      if (state.identity !== account.identity || state.provider !== account.provider || state.origin !== account.origin)
        throw new Error("Stored provider availability belongs to another account.");
      return state;
    };
    const initial = () => parse({ version: 1, ...account, status: { state: "unobserved", checkedAt: null } });
    return { backend, parse, initial, store: new OptimisticStateStore({ backend, parse, initial }) };
  }
  /** verified_available records a past validated request, never a current balance guarantee. */
  async status(account) {
    return (await this.state(account).store.read()).status;
  }
  async assertAvailable(account) {
    if ((await this.status(account)).state === "credits_exhausted")
      throw new ProviderCreditsExhaustedError(account.provider);
  }
  async observeFailure(account, response) {
    const state = this.state(account);
    if (!providerCreditsExhausted(account.provider, account.origin, response)) return false;
    await state.store.transact((current) => {
      current.status = { state: "credits_exhausted", checkedAt: Date.now() };
    });
    return true;
  }
  /** Run one explicitly requested check. No provider operation or validation is retried. */
  async recheck(account, operation, validate, signal) {
    signal?.throwIfAborted();
    const state = this.state(account);
    const original = await state.backend.read();
    if (original) state.parse(original.state);
    signal?.throwIfAborted();
    const result = await operation();
    signal?.throwIfAborted();
    await validate(result);
    signal?.throwIfAborted();
    const next = state.initial();
    next.status = { state: "verified_available", checkedAt: Date.now() };
    if (!await state.backend.compareAndSwap(original?.revision ?? null, {
      revision: randomUUID(),
      state: next
    })) {
      await this.assertAvailable(account);
      throw new Error("Provider availability changed during verification.");
    }
    return result;
  }
};

export { ProviderAvailability, ProviderCreditsExhaustedError };
