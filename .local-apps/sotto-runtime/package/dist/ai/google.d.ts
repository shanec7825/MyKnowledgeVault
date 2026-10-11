import { P as ProviderAdapter } from '../index-THd9yLQB.js';
import { ProviderDescriptor } from './browser.js';
import 'zod';

/** Gemini API transport. Full signed thought parts stay in encrypted registry continuation. */
declare function createGoogleProvider(descriptor: ProviderDescriptor, options?: {
    streaming?: boolean;
}): ProviderAdapter;

export { createGoogleProvider };
