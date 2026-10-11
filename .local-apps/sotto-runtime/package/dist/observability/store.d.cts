import { z } from 'zod';
import { S as StateStore } from '../index-8r2v4WCa.cjs';
import { e as MetricSink, f as MetricEvent } from '../index-BYxnMqfP.cjs';
import 'node:stream';
import '../ai/browser.cjs';

declare const metricStateSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    events: z.ZodArray<z.ZodObject<{
        version: z.ZodLiteral<1>;
        id: z.ZodString;
        timestamp: z.ZodNumber;
        kind: z.ZodEnum<{
            execution: "execution";
            access: "access";
            setup: "setup";
            delivery: "delivery";
            health: "health";
        }>;
        operation: z.ZodString;
        outcome: z.ZodEnum<{
            error: "error";
            success: "success";
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
    }, z.core.$strip>>;
}, z.core.$strip>;
type MetricState = z.infer<typeof metricStateSchema>;
declare const initialMetricState: () => MetricState;
interface LocalMetricOptions {
    store: StateStore<MetricState>;
    retentionMs?: number;
    maxEvents?: number;
    now?: () => number;
}
declare class LocalMetricStore implements MetricSink {
    private readonly options;
    private readonly retention;
    private readonly capacity;
    private readonly now;
    constructor(options: LocalMetricOptions);
    write(events: readonly MetricEvent[], signal: AbortSignal): Promise<void>;
    query(filter?: {
        consumerId?: string;
        provider?: string;
        since?: number;
        limit?: number;
    }): Promise<MetricEvent[]>;
    eraseConsumer(consumerId: string): Promise<void>;
    prune(): Promise<void>;
}

export { type LocalMetricOptions, LocalMetricStore, type MetricState, initialMetricState, metricStateSchema };
