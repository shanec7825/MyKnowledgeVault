import { P as ProviderAdapter } from '../index-BYxnMqfP.cjs';
import { ProviderDescriptor } from './browser.cjs';
import 'zod';

/** Gemini API transport. Full signed thought parts stay in encrypted registry continuation. */
declare function createGoogleProvider(descriptor: ProviderDescriptor, options?: {
    streaming?: boolean;
}): ProviderAdapter;

export { createGoogleProvider };
