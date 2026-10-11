import { P as ProviderAdapter } from '../index-THd9yLQB.js';
import { ProviderDescriptor } from './browser.js';
import 'zod';

interface CompatibleProviderOptions {
    descriptor: ProviderDescriptor;
    defaultBaseUrl: string;
    requiresKey: boolean;
    normalizeV1?: boolean;
    maxTokensParameter?: 'max_tokens' | 'max_completion_tokens';
    streaming?: boolean;
    maxRetries?: number;
    /** Permit compatible endpoints that accept image parts in assistant history. */
    assistantImages?: boolean;
    fetch?: typeof fetch;
}
/** Official and local Chat Completions transports share this adapter; endpoints never fail over. */
declare function createCompatibleProvider(options: CompatibleProviderOptions): ProviderAdapter;

export { type CompatibleProviderOptions, createCompatibleProvider };
