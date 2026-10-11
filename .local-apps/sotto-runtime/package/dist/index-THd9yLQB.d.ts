import { z } from 'zod';
import { ProviderDescriptor, ProviderReadiness, ModelDescriptor, Capability, CredentialValidation } from './ai/browser.js';

interface ExecutionContext {
    collector: MetricCollector;
    operation: string;
    provider?: string;
    model?: string;
    consumerId?: string;
    credentialOwnerId?: string;
    signal?: AbortSignal;
}
interface ExecutionObserver {
    readonly signal: AbortSignal;
    output(): void;
    /** Supply authoritative final measurements, never estimates from text length. */
    usage(value: TokenUsage): void;
}
declare function observeExecution<T>(context: ExecutionContext, run: (observer: ExecutionObserver) => Promise<T>): Promise<T>;
/** Abort before queuing return behind a pending read. Adapters must honor observer.signal. */
declare function observeStream<T>(context: ExecutionContext, open: (observer: ExecutionObserver) => AsyncIterable<T>, isOutput: (value: T) => boolean): AsyncGenerator<T>;

/** No arbitrary metadata, content, exception messages, URLs, or credential fields. */
declare const metricEventSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    id: z.ZodString;
    timestamp: z.ZodNumber;
    kind: z.ZodEnum<{
        access: "access";
        delivery: "delivery";
        execution: "execution";
        setup: "setup";
        health: "health";
    }>;
    operation: z.ZodString;
    outcome: z.ZodEnum<{
        success: "success";
        error: "error";
        cancelled: "cancelled";
    }>;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    consumerId: z.ZodOptional<z.ZodString>;
    credentialOwnerId: z.ZodOptional<z.ZodString>;
    durationMs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    firstOutputMs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    queueMs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    retryCount: z.ZodOptional<z.ZodNumber>;
    inputTokens: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    outputTokens: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    cachedInputTokens: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    cacheWriteTokens: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    reasoningTokens: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    audioSeconds: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    estimatedCost: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    currency: z.ZodOptional<z.ZodString>;
    pricingVersion: z.ZodOptional<z.ZodString>;
    errorCode: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type MetricEvent = z.infer<typeof metricEventSchema>;
interface MetricSink {
    /** Persist by event ID for idempotence. Must honor cancellation. */
    write(events: readonly MetricEvent[], signal: AbortSignal): Promise<void>;
}
interface CollectorOptions {
    sink: MetricSink;
    capacity?: number;
    batchSize?: number;
    timeoutMs?: number;
}
/** Explicit local sink; never starts a network exporter or background timer. */
declare class MetricCollector {
    private readonly options;
    private readonly pending;
    private running;
    private readonly capacity;
    private readonly batchSize;
    private readonly timeoutMs;
    private dropped;
    private rejected;
    private failures;
    private closed;
    constructor(options: CollectorOptions);
    record(value: unknown): boolean;
    status(): {
        pending: number;
        dropped: number;
        rejected: number;
        failures: number;
        closed: boolean;
    };
    flush(): Promise<void>;
    close(): Promise<void>;
    private drain;
}
declare function sumKnownCosts(events: readonly MetricEvent[]): number | null;

type CredentialValues = Record<string, string | number | boolean>;
type ContentPart = {
    type: 'text';
    text: string;
} | {
    type: 'image_url';
    url: string;
} | {
    type: 'image' | 'audio';
    mediaType: string;
    data: Uint8Array;
};
interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: readonly ContentPart[];
    toolCallId?: string;
    toolCalls?: readonly {
        id: string;
        name: string;
        arguments: Record<string, unknown>;
    }[];
}
interface ToolDefinition {
    name: string;
    description: string;
    schema: Record<string, unknown>;
}
declare const webSearchOptionsSchema: z.ZodObject<{
    allowedDomains: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    blockedDomains: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString>>>;
    maxUses: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    userLocation: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        type: z.ZodLiteral<"approximate">;
        city: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        country: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        region: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        timezone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
type WebSearchOptions = z.infer<typeof webSearchOptionsSchema>;
interface GenerationRequest {
    provider: string;
    model: string;
    messages: readonly Message[];
    required?: readonly Capability[];
    tools?: readonly ToolDefinition[];
    schema?: Record<string, unknown>;
    schemaName?: string;
    responseFormat?: 'json_object';
    allowWeb?: boolean;
    webSearch?: WebSearchOptions;
    effort?: string;
    adaptiveThinking?: boolean;
    maxOutputTokens?: number;
    temperature?: number;
    maxOutputBytes?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
    consumerId?: string;
    conversationId?: string;
    credentialOwnerId?: string;
    /** Server-side transcript state emitted by the same provider and model, including encrypted reasoning. */
    continuation?: {
        provider: string;
        model: string;
        data: unknown;
        signature?: string;
    };
}
interface TokenUsage {
    /** Inclusive total, including cached reads and cache creation. Null when not fully measured. */
    inputTokens: number | null;
    /** Inclusive total, including reasoning. Breakdown fields are subsets, never additional usage. */
    outputTokens: number | null;
    cachedInputTokens?: number | null;
    cacheWriteTokens?: number | null;
    reasoningTokens?: number | null;
}
type GenerationEvent = {
    type: 'text';
    text: string;
} | {
    type: 'audio';
    data: Uint8Array;
    mediaType: string;
} | {
    type: 'tool_call';
    id: string;
    name: string;
    arguments: Record<string, unknown>;
} | {
    type: 'usage';
    usage: TokenUsage;
} | {
    type: 'continuation';
    provider: string;
    model: string;
    data: unknown;
    signature?: string;
} | {
    type: 'citation';
    url: string;
    title: string;
    start: number;
    end: number;
} | {
    type: 'finish';
    reason: 'complete' | 'length' | 'tool_calls';
    usage?: TokenUsage;
};
interface ProviderContext {
    credentials: CredentialValues;
    signal: AbortSignal;
    onRetry?: () => void;
}
interface ProviderAdapter {
    descriptor: ProviderDescriptor;
    supportsWebSearchOptions?: boolean;
    /** The transport supplies HTTP attempt deadlines, not a total generation deadline. */
    managesAttemptTimeouts?: boolean;
    /** Validate endpoint and credential selection locally, without contacting the provider. */
    validateConfiguration?(context: ProviderContext): void;
    readiness(context: ProviderContext): Promise<ProviderReadiness>;
    models(context: ProviderContext): Promise<readonly ModelDescriptor[]>;
    generate(request: GenerationRequest, context: ProviderContext): AsyncIterable<GenerationEvent>;
}
interface CredentialStore {
    /** Resolves this provider's explicitly configured instance credentials only. */
    resolve(provider: string): Promise<CredentialValues>;
}
interface RegistryOptions {
    providers: readonly ProviderAdapter[];
    credentials: CredentialStore;
    metrics?: MetricCollector;
    /** Provider mode has no whole-request deadline and rejects request.timeoutMs. */
    timeoutMode?: 'request' | 'provider';
    /** Supply the same secret to workers that must resume each other's server-side tool turns. */
    continuationSecret?: Uint8Array;
}
declare class ProviderError extends Error {
    readonly code: 'unknown_provider' | 'unsupported_capability' | 'invalid_request' | 'invalid_stream';
    constructor(code: 'unknown_provider' | 'unsupported_capability' | 'invalid_request' | 'invalid_stream', message: string);
}
declare class MissingProviderCredentialsError extends ProviderError {
    constructor(message: string);
}
declare function validateTemperature(value: number | undefined): number | undefined;
declare function imageUrl(value: string): string;
declare function responseSchemaName(value: string | undefined): string;
declare class ProviderCleanupError extends Error {
    readonly unconfirmed: boolean;
    readonly code = "cleanup_failed";
    constructor(unconfirmed: boolean, options: ErrorOptions);
}
/** One selected backend per request. Failures propagate; they never select another provider. */
declare class ProviderRegistry {
    private readonly options;
    private readonly providers;
    private readonly continuationSecret;
    constructor(options: RegistryOptions);
    descriptors(): ProviderDescriptor[];
    private signContinuation;
    private adapter;
    readiness(provider: string, signal?: AbortSignal): Promise<ProviderReadiness>;
    models(provider: string, signal?: AbortSignal): Promise<readonly ModelDescriptor[]>;
    /** Reuse the selected transport's probe without treating outages as rejected credentials. */
    validateCredentials(provider: string, signal?: AbortSignal): Promise<CredentialValidation>;
    generate(request: GenerationRequest): AsyncGenerator<GenerationEvent>;
    private run;
}

export { type CredentialValues as C, type ExecutionContext as E, type GenerationRequest as G, MetricCollector as M, type ProviderAdapter as P, type RegistryOptions as R, type ToolDefinition as T, type WebSearchOptions as W, ProviderRegistry as a, type GenerationEvent as b, type TokenUsage as c, type CredentialStore as d, type MetricSink as e, type MetricEvent as f, type CollectorOptions as g, type ExecutionObserver as h, observeStream as i, type ContentPart as j, type Message as k, MissingProviderCredentialsError as l, metricEventSchema as m, ProviderCleanupError as n, observeExecution as o, type ProviderContext as p, ProviderError as q, imageUrl as r, sumKnownCosts as s, responseSchemaName as t, validateTemperature as v, webSearchOptionsSchema as w };
