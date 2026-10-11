'use strict';

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

// src/ai/configuration/model-presets.ts
var presets = {
  meta: [
    {
      id: "muse-spark-1.3",
      displayName: "Muse Spark 1.3 (Standard)",
      shortDisplayName: "Spark 1.3",
      tier: "balanced",
      contextWindow: 1048576,
      maxOutputTokens: null,
      isReasoning: true,
      pricing: { inputPerMTok: 1.25, outputPerMTok: 4.25 }
    }
  ],
  anthropic: [
    {
      id: "claude-haiku-4-5-20251001",
      displayName: "Claude Haiku 4.5",
      shortDisplayName: "Haiku 4.5",
      tier: "fast",
      contextWindow: 2e5,
      maxOutputTokens: 64e3
    },
    {
      id: "claude-sonnet-4-6",
      displayName: "Claude Sonnet 4.6",
      shortDisplayName: "Sonnet 4.6",
      tier: "balanced",
      contextWindow: 2e5,
      maxOutputTokens: 64e3
    },
    {
      id: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      shortDisplayName: "Opus 4.6",
      tier: "best",
      contextWindow: 2e5,
      maxOutputTokens: 128e3
    }
  ],
  openai: [
    {
      id: "gpt-5-nano",
      displayName: "GPT-5 Nano",
      shortDisplayName: "5 Nano",
      tier: "fast",
      contextWindow: 4e5,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5-mini",
      displayName: "GPT-5 Mini",
      shortDisplayName: "5 Mini",
      tier: "fast",
      contextWindow: 4e5,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5",
      displayName: "GPT-5",
      shortDisplayName: "5",
      tier: "balanced",
      contextWindow: 4e5,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5.2",
      displayName: "GPT-5.2",
      shortDisplayName: "5.2",
      tier: "best",
      contextWindow: 4e5,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5.4-nano",
      displayName: "GPT-5.4 Nano",
      shortDisplayName: "5.4 Nano",
      tier: "fast",
      contextWindow: 4e5,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5.4-mini",
      displayName: "GPT-5.4 Mini",
      shortDisplayName: "5.4 Mini",
      tier: "fast",
      contextWindow: 4e5,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5.4",
      displayName: "GPT-5.4",
      shortDisplayName: "5.4",
      tier: "balanced",
      contextWindow: 105e4,
      maxOutputTokens: 128e3,
      isReasoning: true
    },
    {
      id: "gpt-5.4-pro",
      displayName: "GPT-5.4 Pro",
      shortDisplayName: "5.4 Pro",
      tier: "best",
      contextWindow: 105e4,
      maxOutputTokens: 128e3,
      isReasoning: true
    }
  ],
  "claude-code": [
    {
      id: "haiku",
      displayName: "Haiku",
      shortDisplayName: "Haiku 4.5",
      tier: "fast",
      contextWindow: 2e5,
      maxOutputTokens: 64e3
    },
    {
      id: "sonnet",
      displayName: "Sonnet",
      shortDisplayName: "Sonnet 4.6",
      tier: "balanced",
      contextWindow: 2e5,
      maxOutputTokens: 64e3
    },
    {
      id: "opus",
      displayName: "Opus",
      shortDisplayName: "Opus 4.6",
      tier: "best",
      contextWindow: 2e5,
      maxOutputTokens: 128e3
    }
  ],
  codex: [],
  local: [],
  together: [],
  deepgram: [],
  assemblyai: [],
  groq: [
    {
      id: "llama-3.1-8b-instant",
      displayName: "Llama 3.1 8B Instant",
      shortDisplayName: "Llama 8B",
      tier: "fast",
      contextWindow: 131072,
      maxOutputTokens: 131072,
      pricing: {
        inputPerMTok: 0.05,
        outputPerMTok: 0.08
      }
    },
    {
      id: "llama-3.3-70b-versatile",
      displayName: "Llama 3.3 70B Versatile",
      shortDisplayName: "Llama 70B",
      tier: "balanced",
      contextWindow: 131072,
      maxOutputTokens: 32768,
      pricing: {
        inputPerMTok: 0.59,
        outputPerMTok: 0.79
      }
    },
    {
      id: "openai/gpt-oss-120b",
      displayName: "GPT-OSS 120B",
      shortDisplayName: "GPT-OSS 120B",
      tier: "best",
      contextWindow: 131072,
      maxOutputTokens: 65536,
      isReasoning: true,
      pricing: {
        inputPerMTok: 0.15,
        outputPerMTok: 0.6
      }
    }
  ],
  xai: [
    {
      id: "grok-4-fast",
      displayName: "Grok 4 Fast",
      shortDisplayName: "Grok 4 Fast",
      tier: "balanced",
      contextWindow: 1e6,
      maxOutputTokens: 32768,
      pricing: {
        inputPerMTok: 1.25,
        outputPerMTok: 2.5
      }
    },
    {
      id: "grok-4",
      displayName: "Grok 4",
      shortDisplayName: "Grok 4",
      tier: "best",
      contextWindow: 1e6,
      maxOutputTokens: 32768,
      isReasoning: true,
      pricing: {
        inputPerMTok: 1.25,
        outputPerMTok: 2.5
      }
    }
  ],
  deepseek: [
    {
      id: "deepseek-v4-flash",
      displayName: "DeepSeek V4 Flash",
      shortDisplayName: "V4 Flash",
      tier: "balanced",
      contextWindow: 1e6,
      maxOutputTokens: 65536,
      pricing: {
        inputPerMTok: 0.14,
        outputPerMTok: 0.28
      }
    },
    {
      id: "deepseek-v4-pro",
      displayName: "DeepSeek V4 Pro",
      shortDisplayName: "V4 Pro",
      tier: "best",
      contextWindow: 1e6,
      maxOutputTokens: 65536,
      isReasoning: true,
      pricing: {
        inputPerMTok: 0.435,
        outputPerMTok: 0.87
      }
    }
  ],
  mistral: [
    {
      id: "mistral-small-latest",
      displayName: "Mistral Small",
      shortDisplayName: "Small",
      tier: "fast",
      contextWindow: 128e3,
      maxOutputTokens: 16384,
      pricing: {
        inputPerMTok: 0.15,
        outputPerMTok: 0.6
      }
    },
    {
      id: "mistral-medium-latest",
      displayName: "Mistral Medium",
      shortDisplayName: "Medium",
      tier: "balanced",
      contextWindow: 131072,
      maxOutputTokens: 16384,
      pricing: {
        inputPerMTok: 0.4,
        outputPerMTok: 2
      }
    },
    {
      id: "mistral-large-latest",
      displayName: "Mistral Large",
      shortDisplayName: "Large",
      tier: "best",
      contextWindow: 256e3,
      maxOutputTokens: 32768,
      pricing: {
        inputPerMTok: 0.5,
        outputPerMTok: 1.5
      }
    }
  ],
  nvidia: [
    {
      id: "nvidia/llama-3.3-nemotron-super-49b-v1",
      displayName: "Nemotron Super 49B",
      shortDisplayName: "Nemotron 49B",
      tier: "balanced",
      contextWindow: 131072,
      maxOutputTokens: 65536,
      isReasoning: true
    },
    {
      id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      displayName: "Nemotron Ultra 253B",
      shortDisplayName: "Nemotron 253B",
      tier: "best",
      contextWindow: 131072,
      maxOutputTokens: 32768,
      isReasoning: true
    }
  ],
  gladia: [],
  speechmatics: [],
  google: [
    {
      id: "gemini-3.1-flash-lite-preview",
      displayName: "Gemini 3.1 Flash Lite",
      shortDisplayName: "Flash Lite 3.1",
      tier: "fast",
      contextWindow: 1e6,
      maxOutputTokens: 64e3
    },
    {
      id: "gemini-3.1-pro-preview",
      displayName: "Gemini 3.1 Pro",
      shortDisplayName: "Pro 3.1",
      tier: "balanced",
      contextWindow: 1e6,
      maxOutputTokens: 64e3
    }
  ]
};
function modelPresets(provider) {
  const models = presets[provider];
  if (!models) throw new Error(`Unknown model preset provider: ${provider}`);
  return structuredClone(models);
}
var documentSuggestions = {
  "claude-code": ["fable", "opus", "sonnet", "haiku"],
  codex: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"],
  anthropic: ["claude-fable-5", "claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"],
  openai: ["gpt-5.5", "gpt-5.5-mini"],
  ollama: ["qwen3:4b", "qwen3:8b", "gemma3:4b"],
  llamacpp: [],
  vllm: []
};

// src/ai/configuration/catalog.ts
var definitions = {
  anthropic: {
    displayName: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    allowCustomBaseUrl: true,
    models: [
      {
        id: "claude-haiku-4-5-20251001",
        name: "Claude Haiku 4.5",
        costPer1kInput: 1e-3,
        costPer1kOutput: 5e-3
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        costPer1kInput: 3e-3,
        costPer1kOutput: 0.015
      }
    ]
  },
  openai: {
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    models: [{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini", costPer1kInput: 4e-4, costPer1kOutput: 16e-4 }]
  },
  ollama: {
    displayName: "Ollama",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434/v1",
    models: []
  },
  llamacpp: {
    displayName: "llama.cpp",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    defaultBaseUrl: "http://localhost:8080/v1",
    models: []
  },
  vllm: {
    displayName: "vLLM",
    allowCustomModel: true,
    allowCustomBaseUrl: true,
    defaultBaseUrl: "http://localhost:8000/v1",
    models: []
  },
  google: {
    displayName: "Google",
    allowCustomModel: true,
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", costPer1kInput: 15e-5, costPer1kOutput: 35e-4 }
    ]
  },
  "claude-code": {
    displayName: "Claude Code (Max)",
    models: [
      { id: "sonnet", name: "Claude Sonnet (via CLI)", costPer1kInput: 0, costPer1kOutput: 0 },
      { id: "opus", name: "Claude Opus (via CLI)", costPer1kInput: 0, costPer1kOutput: 0 }
    ]
  },
  codex: {
    displayName: "OpenAI Codex (CLI)",
    models: [{ id: "codex", name: "Codex CLI", costPer1kInput: 0, costPer1kOutput: 0 }]
  },
  meta: {
    displayName: "Meta (Muse)",
    defaultBaseUrl: "https://api.meta.ai/v1",
    models: [
      {
        id: "muse-spark-1.3",
        name: "Muse Spark 1.3 (Standard)",
        costPer1kInput: 125e-5,
        costPer1kOutput: 425e-5
      }
    ]
  }
};
var PROVIDER_IDS = Object.keys(definitions);
var PROVIDER_METADATA = definitions;
var CLI_PROVIDERS = { "claude-code": "claude", codex: "codex" };
var LOCAL_PROVIDER_IDS = ["ollama", "llamacpp", "vllm"];
var LOCAL_PROVIDERS = new Set(LOCAL_PROVIDER_IDS);
function modelSuggestions(provider, profile = "extraction") {
  if (profile === "document" && documentSuggestions[provider]) return [...documentSuggestions[provider]];
  const metadata = PROVIDER_METADATA[provider];
  if (!metadata) throw new Error(`Unknown model suggestion provider: ${provider}`);
  return metadata.models.map((model) => model.id);
}
function providerDescriptors() {
  return Object.entries(PROVIDER_METADATA).map(([id, metadata]) => {
    const cli = Boolean(CLI_PROVIDERS[id]);
    const capabilities = ["text", "vision", "structured"];
    if (!cli) capabilities.push("tools");
    if (["anthropic", "google", "claude-code", "codex"].includes(id)) capabilities.push("web");
    return {
      id,
      label: metadata.displayName,
      transport: cli ? "cli" : LOCAL_PROVIDERS.has(id) ? "local" : "api",
      capabilities,
      fields: [
        ...providerCredentials(id, "text").fields.map((field) => ({
          ...field,
          label: field.id === "apiKey" ? "API key" : field.label
        })),
        ...metadata.allowCustomBaseUrl ? [
          {
            id: "baseUrl",
            label: "API endpoint",
            kind: "string",
            secret: false,
            required: false,
            placeholder: metadata.defaultBaseUrl
          },
          {
            id: "compatibleApiKey",
            label: "Custom endpoint API key",
            kind: "string",
            secret: true,
            required: false
          },
          {
            id: "allowAnonymous",
            label: "Endpoint needs no API key",
            kind: "boolean",
            secret: false,
            required: false
          }
        ] : []
      ].filter((field) => field.id !== "allowAnonymous" || id !== "anthropic"),
      models: metadata.models.map((model) => ({ id: model.id, label: model.name, capabilities }))
    };
  });
}

exports.CLI_PROVIDERS = CLI_PROVIDERS;
exports.LOCAL_PROVIDERS = LOCAL_PROVIDERS;
exports.LOCAL_PROVIDER_IDS = LOCAL_PROVIDER_IDS;
exports.PROVIDER_IDS = PROVIDER_IDS;
exports.PROVIDER_METADATA = PROVIDER_METADATA;
exports.modelPresets = modelPresets;
exports.modelSuggestions = modelSuggestions;
exports.providerDescriptors = providerDescriptors;
