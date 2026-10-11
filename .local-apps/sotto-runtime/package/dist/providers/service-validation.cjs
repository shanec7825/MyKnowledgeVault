'use strict';

var zod = require('zod');

// src/providers/service-validation.ts

// src/runtime/process/abort.ts
function abortable(work, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}

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
function providerCredentials(provider, modality) {
  const entry = identity(provider);
  if (!entry.modalities.includes(modality))
    throw new Error(`Provider ${provider} does not support ${modality}`);
  const credentialProvider = entry.credentialProvider ?? provider;
  const authority = identity(credentialProvider);
  return {
    provider,
    modality,
    credentialProvider,
    configurationFields: structuredClone(authority.configurationFields ?? []),
    helpUrl: authority.helpUrl,
    fields: structuredClone(authority.fieldsByModality?.[modality] ?? authority.fields).map((field) => ({
      ...field,
      ...entry.fieldPresentation?.[field.id],
      helpUrl: authority.helpUrl
    }))
  };
}

// src/providers/service-validation.ts
var nonempty = zod.z.string().min(1);
var record = zod.z.record(zod.z.string(), zod.z.unknown());
var integer = zod.z.number().int().nonnegative();
var protocols = {
  pexels: {
    origin: "https://api.pexels.com",
    path: "/v1/search?query=language%20learning&per_page=1",
    header: "authorization",
    prefix: "",
    proof: zod.z.object({
      photos: zod.z.array(zod.z.object({ id: zod.z.number().int().positive() })),
      page: integer,
      per_page: integer,
      total_results: integer
    })
  },
  google: {
    origin: "https://generativelanguage.googleapis.com",
    path: "/v1beta/models?pageSize=1",
    header: "x-goog-api-key",
    prefix: "",
    proof: zod.z.object({ models: zod.z.array(zod.z.object({ name: nonempty })) })
  },
  elevenlabs: {
    origin: "https://api.elevenlabs.io",
    path: "/v1/user",
    header: "xi-api-key",
    prefix: "",
    proof: zod.z.object({ user_id: nonempty, subscription: record })
  },
  cartesia: {
    origin: "https://api.cartesia.ai",
    path: "/voices?limit=1",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ data: zod.z.array(zod.z.object({ id: nonempty })), has_more: zod.z.boolean() })
  },
  hume: {
    origin: "https://api.hume.ai",
    path: "/v0/tts/voices?provider=CUSTOM_VOICE&page_size=1",
    header: "X-Hume-Api-Key",
    prefix: "",
    proof: zod.z.object({
      voices_page: zod.z.array(record),
      page_number: integer,
      page_size: integer,
      total_pages: integer
    })
  },
  fal: {
    origin: "https://api.fal.ai",
    path: "/v1/models/pricing?endpoint_id=fal-ai/flux/dev",
    header: "authorization",
    prefix: "Key ",
    proof: zod.z.object({
      prices: zod.z.array(
        zod.z.object({
          endpoint_id: nonempty,
          unit_price: zod.z.number().nonnegative(),
          unit: nonempty,
          currency: nonempty
        })
      ).refine((prices) => prices.some((price) => price.endpoint_id === "fal-ai/flux/dev")),
      has_more: zod.z.boolean(),
      next_cursor: zod.z.string().nullable()
    })
  },
  replicate: {
    origin: "https://api.replicate.com",
    path: "/v1/account",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ username: nonempty, type: zod.z.enum(["user", "organization"]) })
  },
  assemblyai: {
    origin: "https://api.assemblyai.com",
    path: "/v2/transcript?limit=1",
    header: "authorization",
    prefix: "",
    proof: zod.z.object({
      transcripts: zod.z.array(record),
      page_details: zod.z.object({ limit: integer, result_count: integer })
    })
  },
  gladia: {
    origin: "https://api.gladia.io",
    path: "/v2/pre-recorded",
    header: "x-gladia-key",
    prefix: "",
    proof: zod.z.object({
      items: zod.z.array(record),
      first: zod.z.string(),
      current: zod.z.string(),
      next: zod.z.string().nullable()
    })
  },
  playht: {
    origin: "https://api.play.ht",
    path: "/api/v2/cloned-voices",
    header: "authorization",
    prefix: "",
    proof: zod.z.array(zod.z.object({ id: nonempty, name: zod.z.string() }))
  },
  deepgram: {
    origin: "https://api.deepgram.com",
    path: "/v1/projects",
    header: "authorization",
    prefix: "Token ",
    proof: zod.z.object({ projects: zod.z.array(zod.z.object({ project_id: nonempty, name: zod.z.string() })) })
  },
  speechmatics: {
    origin: "https://eu1.asr.api.speechmatics.com",
    path: "/v2/jobs?limit=1",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ jobs: zod.z.array(record) })
  },
  rime: {
    origin: "https://users.rime.ai",
    path: "/oov",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.array(zod.z.string())
  },
  sunoapi: {
    origin: "https://api.sunoapi.org",
    path: "/api/v1/generate/credit",
    header: "authorization",
    prefix: "Bearer ",
    proof: zod.z.object({ code: zod.z.literal(200), data: integer, msg: zod.z.string() })
  }
};
function providerServiceProtocol(provider, modality) {
  const authority = providerCredentials(provider, modality).credentialProvider;
  return Object.hasOwn(protocols, authority) ? authority : null;
}
function serviceCredentialOrigin(protocol) {
  if (!Object.hasOwn(protocols, protocol)) throw new Error("Unknown credential protocol");
  return protocols[protocol].origin;
}
function result(status, code, action) {
  return {
    status,
    readiness: {
      code,
      checkedAt: Date.now(),
      ...action ? { action } : {},
      ...status === "valid" ? { authentication: "verified" } : {}
    }
  };
}
async function validateServiceCredentials(selection, signal) {
  signal?.throwIfAborted();
  if (!Object.hasOwn(protocols, selection.protocol)) throw new Error("Unknown credential protocol");
  const protocol = protocols[selection.protocol];
  let origin;
  try {
    origin = new URL(selection.origin);
  } catch {
    return result("inconclusive", "not_configured", "configure");
  }
  if (origin.href !== `${protocol.origin}/`) return result("inconclusive", "unsupported", "configure");
  const { apiKey, userId } = selection.credentials;
  if (!apiKey?.trim() || selection.protocol === "playht" && !userId?.trim())
    return result("missing", "missing_credentials", "configure");
  if (selection.protocol === "cartesia" && !selection.apiVersion?.trim())
    return result("inconclusive", "not_configured", "configure");
  const deadline = AbortSignal.timeout(1e4);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const protocolId = selection.protocol;
  const headers = new Headers();
  try {
    headers.set(protocol.header, `${protocol.prefix}${apiKey}`);
    if (protocolId === "playht") headers.set("x-user-id", userId);
    if (protocolId === "cartesia") headers.set("Cartesia-Version", selection.apiVersion);
    if (protocolId === "rime") headers.set("content-type", "application/json");
  } catch {
    return result("inconclusive", "not_configured", "configure");
  }
  const work = async () => {
    const response = await fetch(new URL(protocol.path, origin), {
      headers,
      signal: combined,
      redirect: "error",
      ...protocolId === "rime" ? { method: "POST", body: JSON.stringify({ text: "hello" }) } : {}
    });
    if (combined.aborted) {
      await response.body?.cancel();
      combined.throwIfAborted();
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      return response.status === 401 ? result("rejected", "not_authenticated", "login") : result(
        "inconclusive",
        "unreachable",
        protocolId === "google" && response.status === 403 ? "configure" : "retry"
      );
    }
    const bytes = await readRequestBytes({ body: response.body, signal: combined }, 64 * 1024);
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (protocolId === "sunoapi" && zod.z.object({ code: zod.z.literal(401), msg: zod.z.string() }).safeParse(body).success)
      return result("rejected", "not_authenticated", "login");
    return protocol.proof.safeParse(body).success ? result("valid", "ready") : result("inconclusive", "unreachable", "retry");
  };
  try {
    const validation = await abortable(work(), combined);
    signal?.throwIfAborted();
    return validation;
  } catch {
    signal?.throwIfAborted();
    return result("inconclusive", "unreachable", "retry");
  }
}

exports.providerServiceProtocol = providerServiceProtocol;
exports.serviceCredentialOrigin = serviceCredentialOrigin;
exports.validateServiceCredentials = validateServiceCredentials;
