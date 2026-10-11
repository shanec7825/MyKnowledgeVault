import { A as AtomicStateBackend } from '../index-8r2v4WCa.cjs';
import 'node:stream';
import 'zod';

declare class ProviderCreditsExhaustedError extends Error {
    readonly provider: string;
    readonly code = "PROVIDER_CREDITS_EXHAUSTED";
    constructor(provider: string, options?: ErrorOptions);
}
type ProviderAccount = Readonly<{
    provider: string;
    origin: string;
    identity: string;
}>;
type ProviderAvailabilityStatus = {
    state: 'unobserved';
    checkedAt: null;
} | {
    state: 'credits_exhausted' | 'verified_available';
    checkedAt: number;
};
/** Callers supply persistent state under their existing authorization, transaction and erasure policy. */
declare class ProviderAvailability {
    private readonly prefix;
    private readonly accounts;
    private readonly options;
    constructor(options: {
        namespace: string;
        instanceId: string;
        backend: (id: string) => AtomicStateBackend;
    });
    captureAccount(selection: {
        provider: string;
        origin: string;
        credential: string;
    }): ProviderAccount;
    private state;
    /** verified_available records a past validated request, never a current balance guarantee. */
    status(account: ProviderAccount): Promise<ProviderAvailabilityStatus>;
    assertAvailable(account: ProviderAccount): Promise<void>;
    observeFailure(account: ProviderAccount, response: {
        status: number;
        body: unknown;
    }): Promise<boolean>;
    /** Run one explicitly requested check. No provider operation or validation is retried. */
    recheck<T>(account: ProviderAccount, operation: () => Promise<T>, validate: (result: T) => Promise<void>, signal?: AbortSignal): Promise<T>;
}

export { type ProviderAccount, ProviderAvailability, type ProviderAvailabilityStatus, ProviderCreditsExhaustedError };
