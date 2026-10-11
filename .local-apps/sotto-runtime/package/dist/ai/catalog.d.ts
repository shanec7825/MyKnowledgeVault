import { ProviderDescriptor } from './browser.js';

interface ModelPreset {
    id: string;
    displayName: string;
    shortDisplayName: string;
    tier: 'fast' | 'balanced' | 'best' | 'max';
    contextWindow: number;
    /** Null when the provider has not published a numeric output ceiling. */
    maxOutputTokens: number | null;
    pricing?: {
        inputPerMTok: number;
        outputPerMTok: number;
    };
    isReasoning?: boolean;
}
/** Each consumer receives independent metadata for pricing enrichment and presentation. */
declare function modelPresets(provider: string): ModelPreset[];

interface ModelInfo {
    id: string;
    name: string;
    costPer1kInput: number;
    costPer1kOutput: number;
}
interface ProviderMeta {
    displayName: string;
    models: ModelInfo[];
    allowCustomModel?: boolean;
    allowCustomBaseUrl?: boolean;
    defaultBaseUrl?: string;
}
/** Existing extraction presets. Runtime discovery supplies additional models without changing app defaults. */
declare const definitions: {
    anthropic: {
        displayName: string;
        defaultBaseUrl: string;
        allowCustomBaseUrl: true;
        models: {
            id: string;
            name: string;
            costPer1kInput: number;
            costPer1kOutput: number;
        }[];
    };
    openai: {
        displayName: string;
        defaultBaseUrl: string;
        allowCustomModel: true;
        allowCustomBaseUrl: true;
        models: {
            id: string;
            name: string;
            costPer1kInput: number;
            costPer1kOutput: number;
        }[];
    };
    ollama: {
        displayName: string;
        allowCustomModel: true;
        allowCustomBaseUrl: true;
        defaultBaseUrl: string;
        models: never[];
    };
    llamacpp: {
        displayName: string;
        allowCustomModel: true;
        allowCustomBaseUrl: true;
        defaultBaseUrl: string;
        models: never[];
    };
    vllm: {
        displayName: string;
        allowCustomModel: true;
        allowCustomBaseUrl: true;
        defaultBaseUrl: string;
        models: never[];
    };
    google: {
        displayName: string;
        allowCustomModel: true;
        models: {
            id: string;
            name: string;
            costPer1kInput: number;
            costPer1kOutput: number;
        }[];
    };
    'claude-code': {
        displayName: string;
        models: {
            id: string;
            name: string;
            costPer1kInput: number;
            costPer1kOutput: number;
        }[];
    };
    codex: {
        displayName: string;
        models: {
            id: string;
            name: string;
            costPer1kInput: number;
            costPer1kOutput: number;
        }[];
    };
    meta: {
        displayName: string;
        defaultBaseUrl: string;
        models: {
            id: string;
            name: string;
            costPer1kInput: number;
            costPer1kOutput: number;
        }[];
    };
};
type ProviderId = keyof typeof definitions;
declare const PROVIDER_IDS: ProviderId[];
declare const PROVIDER_METADATA: Record<string, ProviderMeta>;
declare const CLI_PROVIDERS: Record<string, string>;
declare const LOCAL_PROVIDER_IDS: readonly ["ollama", "llamacpp", "vllm"];
declare const LOCAL_PROVIDERS: Set<string>;
declare function modelSuggestions(provider: string, profile?: 'document' | 'extraction'): string[];
declare function providerDescriptors(): ProviderDescriptor[];

export { CLI_PROVIDERS, LOCAL_PROVIDERS, LOCAL_PROVIDER_IDS, type ModelInfo, type ModelPreset, PROVIDER_IDS, PROVIDER_METADATA, type ProviderId, type ProviderMeta, modelPresets, modelSuggestions, providerDescriptors };
