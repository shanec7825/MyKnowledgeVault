import { A as AccessService, D as DeviceService, g as HouseholdProfileService, b as AccessError } from '../devices-1kuthJEN.cjs';
import '../index-8r2v4WCa.cjs';
import 'node:stream';
import 'zod';

/** Stable HTTP status for a rejected access operation, including custom app routes. */
declare function accessErrorStatus(error: AccessError): number;
interface AccessHttpOptions {
    access: AccessService;
    origin: string;
    /** Explicit browser origins sharing password authority. WebAuthn ceremonies use origin only. */
    passwordOrigins?: string[];
    /** Enable only behind a trusted ingress that supplies internal request URLs. Browser hints select configured origins only. */
    trustedProxy?: boolean;
    /** Use the direct Host authority when a framework normalizes Request.url. This does not trust forwarded headers. */
    useHostHeader?: boolean;
    /** Allow native JSON clients without browser headers. Does not enable CORS or relax passkey origins. */
    allowOriginlessJsonClients?: boolean;
    name: string;
    cookieName?: string;
    devices?: Pick<DeviceService, 'list' | 'issuePairing' | 'revoke'>;
    profiles?: HouseholdProfileService;
}
declare function readAccessJson(request: Request): Promise<unknown>;
declare function cookieValue(request: Request, name: string): string | null;
declare function validateAccessOrigins(options: Pick<AccessHttpOptions, 'origin' | 'passwordOrigins'>): {
    canonicalOrigin: string;
    passwordOrigins: string[];
};
/** Mount beneath an application-owned route. Authenticated mutation checks also run in the service. */
declare function createAccessHandler(options: AccessHttpOptions): (request: Request, action: string) => Promise<Response>;

export { type AccessHttpOptions, accessErrorStatus, cookieValue, createAccessHandler, readAccessJson, validateAccessOrigins };
