/** Public bootstrap for the reviewed Claude 2.1.283 text-only API protocol.
 * The application supplies { token, args, prompt, maxOutputTokens } on stdin.
 * A reviewed image must provide Node and the pinned claude executable.
 */
declare const isolatedClaudeRelay: string;

interface CredentialBrokerOptions {
    executionId: string;
    protocol: 'anthropic-messages' | 'openai-chat';
    /** Exact HTTPS provider endpoint, selected by trusted application configuration. */
    endpoint: string;
    model: string;
    credential: string;
    expiresAt: number;
    maxOutputTokens: number;
    maxRequestBytes: number;
    maxResponseBytes: number;
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    signal?: AbortSignal;
    /** Must atomically reserve an attempt and revalidate authority. Throw to deny. */
    admit(request: {
        executionId: string;
        model: string;
        maxOutputTokens: number;
        signal: AbortSignal;
    }): Promise<void>;
    /** Trusted provider transport, allowing applications to retain credential admission. */
    fetch?: typeof globalThis.fetch;
}
interface CredentialBroker {
    directory: string;
    socketPath: string;
    /** Execution-scoped capability only. Never the provider credential. */
    token: string;
    close(): Promise<void>;
}
declare class CredentialBrokerCleanupError extends Error {
    constructor();
}
/** Parent-owned Unix socket. Only normalized text-generation requests can leave it. */
declare function startCredentialBroker(options: CredentialBrokerOptions): Promise<CredentialBroker>;

export { type CredentialBroker, CredentialBrokerCleanupError, type CredentialBrokerOptions, isolatedClaudeRelay, startCredentialBroker };
