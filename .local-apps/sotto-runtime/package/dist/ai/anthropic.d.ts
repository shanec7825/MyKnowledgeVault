import { P as ProviderAdapter } from '../index-THd9yLQB.js';
import { ProviderDescriptor } from './browser.js';
import 'zod';

interface AnthropicProviderOptions {
    descriptor: ProviderDescriptor;
    fetch?: typeof fetch;
    maxRetries?: number;
    streaming?: boolean;
    /** Null leaves the provider's web search limit unspecified. */
    webSearchMaxUses?: number | null;
}
declare function createAnthropicProvider(options: AnthropicProviderOptions): ProviderAdapter;

export { type AnthropicProviderOptions, createAnthropicProvider };
