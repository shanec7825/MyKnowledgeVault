'use strict';

var crypto = require('crypto');
var zod = require('zod');

// src/providers/availability.ts
var OptimisticStateStore = class {
  constructor(options) {
    this.options = options;
    this.attempts = options.maxAttempts ?? 20;
    if (!Number.isSafeInteger(this.attempts) || this.attempts < 1)
      throw new Error("Transaction attempts must be positive");
  }
  options;
  attempts;
  async read() {
    const snapshot = await this.options.backend.read();
    return this.options.parse(snapshot ? snapshot.state : this.options.initial());
  }
  async transact(operation) {
    for (let attempt = 0; attempt < this.attempts; attempt++) {
      const snapshot = await this.options.backend.read();
      const state = this.options.parse(structuredClone(snapshot ? snapshot.state : this.options.initial()));
      const result = operation(state);
      if (result instanceof Promise) throw new Error("State transaction callbacks must be synchronous");
      const detachedResult = structuredClone(result);
      const next = { revision: crypto.randomUUID(), state: this.options.parse(state) };
      if (await this.options.backend.compareAndSwap(snapshot?.revision ?? null, next)) return detachedResult;
      await new Promise((resolve) => setTimeout(resolve, Math.min(100, 5 * (attempt + 1))));
    }
    throw new Error("State transaction conflicted with concurrent updates");
  }
};

// src/providers/catalog.ts
var identities = {
  meta: {
    compatibleApi: { baseURL: "https://api.meta.ai/v1" },
    label: "Meta (Muse)",
    helpUrl: "https://dev.meta.ai/",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["text"]
  },
  pricetoken: {
    label: "PriceToken",
    helpUrl: "https://pricetoken.com",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["pricing"]
  },
  r2: {
    label: "Cloudflare R2",
    helpUrl: "https://developers.cloudflare.com/r2/api/s3/tokens/",
    fields: [
      { id: "accessKeyId", label: "Access Key ID", kind: "string", required: true, secret: true },
      {
        id: "secretAccessKey",
        label: "Secret Access Key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["storage"]
  },
  s3: {
    label: "Amazon S3",
    helpUrl: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
    fields: [
      { id: "accessKeyId", label: "Access Key ID", kind: "string", required: true, secret: true },
      {
        id: "secretAccessKey",
        label: "Secret Access Key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["storage"]
  },
  sunoapi: {
    label: "Suno API (sunoapi.org)",
    helpUrl: "https://docs.sunoapi.org/suno-api/quickstart",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["music"]
  },
  suno: {
    label: "Suno",
    helpUrl: "https://docs.sunoapi.org/suno-api/quickstart",
    fields: [],
    credentialProvider: "sunoapi",
    modalities: ["music"]
  },
  pexels: {
    label: "Pexels",
    helpUrl: "https://www.pexels.com/api/documentation/",
    fields: [{ id: "apiKey", label: "API Key", kind: "string", required: true, secret: true }],
    modalities: ["visual"]
  },
  anthropic: {
    label: "Anthropic (Claude)",
    helpUrl: "https://console.anthropic.com/settings/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-ant-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  openai: {
    creditExhaustion: {
      origin: "https://api.openai.com",
      rules: [
        { status: 429, path: ["error", "code"], value: "insufficient_quota" },
        { status: 429, path: ["error", "code"], value: "credit_balance_exhausted" }
      ]
    },
    label: "OpenAI",
    helpUrl: "https://platform.openai.com/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "speech", "transcription", "storage"]
  },
  "claude-code": {
    label: "Claude Code (CLI)",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  codex: {
    label: "Codex (CLI)",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  local: {
    label: "Local model (Ollama / vLLM / LM Studio)",
    helpUrl: "",
    fields: [],
    fieldsByModality: {
      text: [{ id: "apiKey", label: "API key", kind: "string", required: false, secret: true }],
      speech: [{ id: "apiKey", label: "API key", kind: "string", required: false, secret: true }],
      transcription: [{ id: "apiKey", label: "API key", kind: "string", required: false, secret: true }]
    },
    modalities: ["text", "speech", "transcription"]
  },
  together: {
    compatibleApi: { baseURL: "https://api.together.xyz/v1" },
    label: "Together AI",
    helpUrl: "https://api.together.xyz/settings/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "transcription"]
  },
  deepgram: {
    label: "Deepgram (STT)",
    helpUrl: "https://console.deepgram.com/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech", "transcription"]
  },
  assemblyai: {
    label: "AssemblyAI (STT)",
    helpUrl: "https://www.assemblyai.com/app",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["transcription"]
  },
  groq: {
    compatibleApi: { baseURL: "https://api.groq.com/openai/v1" },
    label: "Groq",
    helpUrl: "https://console.groq.com/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "gsk_...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "transcription"]
  },
  xai: {
    compatibleApi: { baseURL: "https://api.x.ai/v1" },
    label: "xAI (Grok)",
    helpUrl: "https://console.x.ai/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "xai-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  deepseek: {
    compatibleApi: { baseURL: "https://api.deepseek.com/v1" },
    label: "DeepSeek",
    helpUrl: "https://platform.deepseek.com/api_keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  mistral: {
    compatibleApi: { baseURL: "https://api.mistral.ai/v1" },
    label: "Mistral",
    helpUrl: "https://console.mistral.ai/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "Your Mistral API key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text", "speech"]
  },
  nvidia: {
    compatibleApi: { baseURL: "https://integrate.api.nvidia.com/v1" },
    label: "NVIDIA NIM",
    helpUrl: "https://build.nvidia.com/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "nvapi-...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  gladia: {
    label: "Gladia (STT)",
    helpUrl: "https://app.gladia.io/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["transcription"]
  },
  speechmatics: {
    label: "Speechmatics (STT)",
    helpUrl: "https://portal.speechmatics.com/",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["transcription"]
  },
  google: {
    label: "Google (Gemini)",
    helpUrl: "https://aistudio.google.com/apikey",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "AIza...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["text"]
  },
  elevenlabs: {
    creditExhaustion: {
      origin: "https://api.elevenlabs.io",
      rules: [
        { status: 401, path: ["detail", "status"], value: "quota_exceeded" },
        { status: 402, path: ["detail", "code"], value: "insufficient_credits" }
      ]
    },
    label: "ElevenLabs",
    helpUrl: "https://elevenlabs.io/app/settings/api-keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "xi-xxxxxxxxxxxxxxxxxxxx",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech", "transcription"]
  },
  cartesia: {
    creditExhaustion: {
      origin: "https://api.cartesia.ai",
      rules: [{ status: 402, path: [], value: "Model credits limit reached:", prefix: true }]
    },
    configurationFields: [
      { id: "usagePlan", label: "Usage Plan", kind: "string", required: false, secret: false }
    ],
    label: "Cartesia",
    helpUrl: "https://play.cartesia.ai/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "sk_car_...",
        kind: "string",
        required: true,
        secret: true
      },
      {
        id: "adminApiKey",
        label: "Admin API Key",
        placeholder: "sk_car_admin_... (optional, for usage)",
        kind: "string",
        required: false,
        secret: true
      },
      {
        id: "monthlyCreditLimit",
        label: "Monthly Credit Limit",
        placeholder: "Optional, e.g. 1000000",
        kind: "number",
        required: false,
        secret: false
      },
      {
        id: "billingResetDay",
        label: "Billing Reset Day",
        placeholder: "Optional, 1-31",
        kind: "number",
        required: false,
        secret: false
      }
    ],
    modalities: ["speech", "transcription"]
  },
  hume: {
    label: "Hume AI",
    helpUrl: "https://platform.hume.ai/settings/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "Your Hume AI API key",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  fal: {
    label: "Fal",
    helpUrl: "https://fal.ai/dashboard/keys",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "fal_sk_...",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  minimax: {
    label: "MiniMax",
    helpUrl: "",
    fields: [],
    modalities: ["speech"],
    credentialProvider: "fal",
    fieldPresentation: { apiKey: { placeholder: "Your FAL API key" } }
  },
  replicate: {
    label: "Replicate",
    helpUrl: "https://replicate.com/account/api-tokens",
    fields: [
      {
        id: "apiKey",
        label: "API Token",
        placeholder: "r8_xxxxxxxxxxxx",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  kokoro: {
    label: "Kokoro (Local)",
    helpUrl: "",
    fields: [],
    modalities: ["speech"]
  },
  rime: {
    label: "Rime",
    helpUrl: "https://app.rime.ai/tokens",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  playht: {
    label: "PlayHT",
    helpUrl: "https://play.ht/studio/api-access",
    fields: [
      {
        id: "apiKey",
        label: "API Key",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      },
      {
        id: "userId",
        label: "User ID",
        placeholder: "",
        kind: "string",
        required: true,
        secret: true
      }
    ],
    modalities: ["speech"]
  },
  ollama: {
    label: "Ollama",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  llamacpp: {
    label: "llama.cpp",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  },
  vllm: {
    label: "vLLM",
    helpUrl: "",
    fields: [],
    modalities: ["text"]
  }
};
function identity(provider) {
  if (!Object.hasOwn(identities, provider)) throw new Error(`Unknown provider: ${provider}`);
  return identities[provider];
}
function providerIdentity(provider) {
  const entry = identity(provider);
  return { id: provider, label: entry.label, modalities: [...entry.modalities] };
}
function providerCreditsExhausted(provider, origin, response) {
  const policy = identity(provider).creditExhaustion;
  if (!policy || policy.origin !== origin) return false;
  return policy.rules.some((rule) => {
    if (response.status !== rule.status) return false;
    let value = response.body;
    for (const key of rule.path) {
      if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) return false;
      value = value[key];
    }
    return typeof value === "string" && (rule.prefix ? value.startsWith(rule.value) : value === rule.value);
  });
}

// src/providers/availability.ts
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
var storedState = zod.z.object({
  version: zod.z.literal(1),
  identity: zod.z.string().regex(/^[a-f0-9]{64}$/),
  provider: zod.z.string().min(1),
  origin: zod.z.string().min(1),
  status: zod.z.discriminatedUnion("state", [
    zod.z.object({ state: zod.z.literal("unobserved"), checkedAt: zod.z.null() }).strict(),
    zod.z.object({
      state: zod.z.enum(["credits_exhausted", "verified_available"]),
      checkedAt: zod.z.number().finite().nonnegative()
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
    this.prefix = `availability:${crypto.createHash("sha256").update(JSON.stringify([options.namespace, options.instanceId])).digest("hex")}:`;
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
      identity: crypto.createHmac("sha256", selection.credential).update(
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
      revision: crypto.randomUUID(),
      state: next
    })) {
      await this.assertAvailable(account);
      throw new Error("Provider availability changed during verification.");
    }
    return result;
  }
};

exports.ProviderAvailability = ProviderAvailability;
exports.ProviderCreditsExhaustedError = ProviderCreditsExhaustedError;
