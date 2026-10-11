import { CredentialField } from '../ai/browser.js';

type ProviderModality = 'text' | 'speech' | 'transcription' | 'music' | 'visual' | 'storage' | 'pricing';
interface CompatibleApiConnection {
    baseURL: string;
}
declare function providerIdentity(provider: string): {
    id: string;
    label: string;
    modalities: ProviderModality[];
};
/** Exact known billing responses only. Authentication and rate limits remain separate. */
declare function providerCreditsExhausted(provider: string, origin: string, response: {
    status: number;
    body: unknown;
}): boolean;
declare function providerCompatibleConnection(provider: string): CompatibleApiConnection | null;
/** Descriptors only. Credentials must be selected by the caller; this module never reads the environment. */
declare function providerCredentials(provider: string, modality: ProviderModality): {
    provider: string;
    modality: ProviderModality;
    credentialProvider: string;
    configurationFields: readonly CredentialField[];
    helpUrl: string;
    fields: {
        helpUrl: string;
        placeholder?: string;
        label: string;
        id: string;
        secret: boolean;
        required: boolean;
        kind: "string" | "number" | "boolean";
    }[];
};

export { type CompatibleApiConnection, type ProviderModality, providerCompatibleConnection, providerCredentials, providerCreditsExhausted, providerIdentity };
