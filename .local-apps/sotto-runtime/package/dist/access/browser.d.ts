export { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, startRegistration } from '@simplewebauthn/browser';

interface BrowserSession {
    principal: {
        id: string;
        name: string;
        role: 'owner' | 'member';
    } | null;
    expiresAt: number;
    sessionId?: string;
}
interface BrowserPasskey {
    id: string;
    name: string;
    createdAt: number;
    backedUp: boolean;
}
interface BrowserStoredSession {
    id: string;
    name: string;
    expiresAt: number;
    principalId: string | null;
}
interface AccessCapabilities {
    password: boolean;
    passkeys: boolean;
    householdPasskeys?: boolean;
    openHousehold?: boolean;
}
declare class AccessClientError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, status?: number);
}
/** Browser-only client. Cookies remain HttpOnly; credentials never enter URLs or browser storage. */
declare class AccessClient {
    private readonly endpoint;
    private readonly fetcher;
    constructor(options?: {
        endpoint?: string;
        fetch?: typeof fetch;
    });
    request<Result>(action: string, body?: unknown, signal?: AbortSignal): Promise<Result>;
    capabilities(signal?: AbortSignal): Promise<AccessCapabilities>;
    private sessionRequest;
    passkeys(signal?: AbortSignal): Promise<BrowserPasskey[]>;
    householdPasskeys(signal?: AbortSignal): Promise<BrowserPasskey[]>;
    private passkeyList;
    sessions(signal?: AbortSignal): Promise<BrowserStoredSession[]>;
    recoveryCodes(signal?: AbortSignal): Promise<string[]>;
    changePassword(password: string, signal?: AbortSignal): Promise<BrowserSession>;
    mutation(action: string, body: unknown, signal?: AbortSignal): Promise<void>;
    session(signal?: AbortSignal): Promise<BrowserSession>;
    login(name: string, password: string, signal?: AbortSignal): Promise<BrowserSession>;
    enterHousehold(password: string, signal?: AbortSignal): Promise<BrowserSession>;
    enterOpenHousehold(signal?: AbortSignal): Promise<BrowserSession>;
    redeemInvitation(code: string, enrollment?: {
        name: string;
        password: string;
    }, signal?: AbortSignal): Promise<BrowserSession>;
    claim(token: string, name: string, password: string, mode: 'household' | 'individual', signal?: AbortSignal): Promise<BrowserSession>;
    recover(code: string, password: string, signal?: AbortSignal): Promise<BrowserSession>;
    private ceremony;
    authenticatePasskey(signal?: AbortSignal): Promise<BrowserSession>;
    authenticateHouseholdPasskey(signal?: AbortSignal): Promise<BrowserSession>;
    reauthenticatePasskey(signal?: AbortSignal): Promise<BrowserSession>;
    reauthenticatePassword(password: string, signal?: AbortSignal): Promise<BrowserSession>;
    private passkeyAuthentication;
    registerPasskey(name: string, signal?: AbortSignal): Promise<{
        ok: true;
    }>;
    registerHouseholdPasskey(name: string, signal?: AbortSignal): Promise<{
        ok: true;
    }>;
    private registerPasskeyFor;
}

export { type AccessCapabilities, AccessClient, AccessClientError, type BrowserPasskey, type BrowserSession, type BrowserStoredSession };
