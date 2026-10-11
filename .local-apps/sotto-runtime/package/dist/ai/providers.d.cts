import { C as CredentialValues, R as RegistryOptions, P as ProviderAdapter, a as ProviderRegistry } from '../index-BYxnMqfP.cjs';
export { providerConnection } from './connection.cjs';
import { Capability, ProviderDescriptor } from './browser.cjs';
import 'zod';

interface CompatibleApiSelectionInput {
    provider: string;
    label: string;
    endpoint: string;
    apiKey?: string;
    /** Require a key when validating or executing, rather than while capturing configuration. */
    requiresKey?: boolean;
    transport?: 'api' | 'local';
    capabilities?: readonly Capability[];
    /** Supply the saved credential's binding after authorizing its owner and revision. */
    credentialBinding?: {
        protocol: string;
        endpoint: string;
    };
}
type CompatibleApiSelection = Extract<SelectedApi, {
    transport: 'compatible';
}>;
type CompatibleModelSelection = CompatibleApiSelection & {
    model: string;
};
/** Capture one explicit compatible endpoint without looking up credentials or choosing a backend. */
declare function captureCompatibleApi(input: CompatibleApiSelectionInput): CompatibleApiSelection;
/** Model IDs belong to the server. Applications remove any product-specific routing prefix first. */
declare function captureCompatibleModel(input: CompatibleApiSelectionInput & {
    model: string;
}): CompatibleModelSelection;

interface CapturedApiIdentity {
    descriptor: ProviderDescriptor;
    credentials: CredentialValues;
}
type SelectedApi = CapturedApiIdentity & ({
    transport: 'compatible';
    baseUrl: string;
    requiresKey: boolean;
} | {
    transport: 'responses';
    baseUrl?: string;
    webSearchType?: 'web_search' | 'web_search_preview';
} | {
    transport: 'anthropic';
});
interface SelectedApiOptions {
    fetch?: typeof fetch;
    streaming?: boolean;
    maxRetries?: number;
    timeoutMode?: RegistryOptions['timeoutMode'];
    compatible?: {
        normalizeV1?: boolean;
        maxTokensParameter?: 'max_tokens' | 'max_completion_tokens';
        assistantImages?: boolean;
    };
    anthropic?: {
        webSearchMaxUses?: number | null;
    };
}
/** Generation and validation share this exact captured transport and credential selection. */
declare function createSelectedApiRegistry(selection: SelectedApi, options?: SelectedApiOptions): ProviderRegistry;
/** Provider-specific construction is owned here. Consumers supply credentials and select capabilities. */
declare function apiProviders(options?: {
    openaiTransport?: 'chat' | 'responses';
    streaming?: boolean;
    maxTokensParameter?: 'max_tokens' | 'max_completion_tokens';
}): ProviderAdapter[];

export { type CompatibleApiSelection, type CompatibleApiSelectionInput, type CompatibleModelSelection, type SelectedApi, type SelectedApiOptions, apiProviders, captureCompatibleApi, captureCompatibleModel, createSelectedApiRegistry };
