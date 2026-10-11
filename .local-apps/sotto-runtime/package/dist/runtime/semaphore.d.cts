interface SemaphoreConnectionPort extends SemaphoreRedis {
    connect(): Promise<void>;
    end(): Promise<void>;
    onError(listener: (error: Error) => void): () => void;
    onEnd(listener: () => void): () => void;
}
/** Own an unused connection with reconnect, offline queuing and command replay disabled. */
declare function openSemaphoreSession(client: SemaphoreConnectionPort, options: {
    namespace: string;
    resource: string;
    limit: number;
    ttlMs: number;
    connectMs: number;
    commandMs: number;
    closeMs: number;
}): Promise<{
    token: string;
    key: string;
    acquire: () => Promise<boolean>;
    inspect: () => Promise<{
        expiresAt: number;
    } | null>;
    renew: () => Promise<boolean>;
    release: () => Promise<void>;
    wait(waitOptions: Parameters<typeof waitForSemaphore>[1]): Promise<boolean>;
}>;

/** Commands must execute in order on one Redis connection, without replay after release. */
interface SemaphoreRedis {
    eval(script: string, keys: readonly string[], args: readonly string[]): Promise<unknown>;
}
declare class SemaphoreOperationError extends Error {
    readonly operation: string;
    readonly key: string;
    readonly token: string;
    constructor(operation: string, key: string, token: string, options: ErrorOptions);
}
declare class SemaphoreCleanupError extends AggregateError {
    readonly key: string;
    readonly token: string;
    constructor(key: string, token: string, errors: readonly unknown[], options: ErrorOptions);
}
/**
 * Advisory capacity only. Expiration never proves an external operation has stopped.
 * A token belongs to one logical execution and one handle. Never share it across
 * handles or reuse it for later work, including after expiration or release.
 */
declare class RedisSemaphoreLease {
    #private;
    readonly token: string;
    readonly key: string;
    constructor(redis: SemaphoreRedis, options: {
        namespace: string;
        resource: string;
        limit: number;
        ttlMs: number;
        token?: string;
    });
    /** A rejected response can be reconciled by repeating this call with this same token. */
    acquire(): Promise<boolean>;
    renew(): Promise<boolean>;
    inspect(): Promise<{
        expiresAt: number;
    } | null>;
    /** Repeat after an unknown response. It can never release another token's slot. */
    release(): Promise<void>;
}
/** Waiting owns the original token until successful admission or confirmed release. */
declare function waitForSemaphore(lease: RedisSemaphoreLease, options: {
    signal?: AbortSignal;
    delaysMs: readonly number[];
    shouldStop?: () => Promise<boolean>;
}): Promise<boolean>;

export { RedisSemaphoreLease, SemaphoreCleanupError, type SemaphoreConnectionPort, SemaphoreOperationError, type SemaphoreRedis, openSemaphoreSession, waitForSemaphore };
