interface ProviderRequestRule {
    method: string;
    url: string;
    /** Match descendants of a path ending in '/', for example authenticated polling IDs. */
    descendants?: boolean;
    allowQuery?: boolean;
}
interface ProviderRequestAdmission {
    readonly url: string;
    readonly method: string;
}
interface ProviderResponseConsumption {
    readonly status: number;
}
interface ProviderTransport {
    authenticatedFetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1], observation?: {
        /** Transport invocation is beginning; this does not prove bytes reached the provider. */
        onDispatch: () => void;
        /** The complete HTTP response body was consumed. The provider decides whether this is terminal. */
        onConsumed?: (response: ProviderResponseConsumption) => void;
    }) => ReturnType<typeof fetch>;
}
/** Each actual HTTP attempt, including SDK retries, must pass its captured destination and admission policy. */
declare function createProviderTransport(options: {
    rules: readonly ProviderRequestRule[];
    /** Must check cancellation before committing admission side effects. */
    admit: (request: ProviderRequestAdmission, signal: AbortSignal) => Promise<void>;
    signal?: AbortSignal;
    implementation?: typeof fetch;
    /** Reports cleanup failures after cancellation has already returned to the caller. */
    onCleanupError?: (error: unknown) => void;
}): ProviderTransport;
interface MediaTransport {
    downloadMedia(url: string, options?: {
        signal?: AbortSignal;
    }): Promise<Uint8Array>;
}
/** Credential-free buffered downloads. The caller admits each destination and execution owner. */
declare function createMediaTransport(options: {
    admit: (request: ProviderRequestAdmission, signal: AbortSignal) => Promise<void>;
    maxBytes: number;
    timeoutMs: number;
    maxRedirects?: number;
    signal?: AbortSignal;
    implementation?: typeof fetch;
    onCleanupError?: (error: unknown) => void;
}): MediaTransport;

export { type MediaTransport, type ProviderRequestAdmission, type ProviderRequestRule, type ProviderResponseConsumption, type ProviderTransport, createMediaTransport, createProviderTransport };
