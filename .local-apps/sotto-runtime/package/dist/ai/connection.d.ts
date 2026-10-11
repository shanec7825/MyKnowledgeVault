import { C as CredentialValues } from '../index-THd9yLQB.js';
import 'zod';
import './browser.js';

/** Select credentials for the effective endpoint before constructing an SDK client. */
declare function providerConnection(credentials: CredentialValues, options: {
    defaultBaseUrl: string;
    normalizeV1?: boolean;
    requiresKey: boolean;
    allowAnonymous?: boolean;
}): {
    baseUrl: string;
    apiKey: string;
};

export { providerConnection };
