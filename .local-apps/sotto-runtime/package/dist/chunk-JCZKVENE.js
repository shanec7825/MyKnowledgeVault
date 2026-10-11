import { providerCredentials } from './chunk-LXCVA42T.js';

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

export { CLI_PROVIDERS, LOCAL_PROVIDERS, LOCAL_PROVIDER_IDS, PROVIDER_IDS, PROVIDER_METADATA, modelPresets, modelSuggestions, providerDescriptors };
