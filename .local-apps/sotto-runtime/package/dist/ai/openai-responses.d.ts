import { P as ProviderAdapter } from '../index-THd9yLQB.js';
import { ProviderDescriptor } from './browser.js';
import 'zod';

interface ResponsesProviderOptions {
    defaultBaseUrl?: string;
    webSearchType?: 'web_search' | 'web_search_preview';
    descriptor: ProviderDescriptor;
    fetch?: typeof fetch;
    maxRetries?: number;
    streaming?: boolean;
}
/** Explicit Responses transport. Provider-side storage is disabled; continuation stays with the application. */
declare function createResponsesProvider(options: ResponsesProviderOptions): ProviderAdapter;

export { type ResponsesProviderOptions, createResponsesProvider };
