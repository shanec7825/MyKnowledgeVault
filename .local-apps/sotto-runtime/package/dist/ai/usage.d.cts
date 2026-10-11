import { c as TokenUsage } from '../index-BYxnMqfP.cjs';
import 'zod';
import './browser.cjs';

/** Only terminal CLI events report invocation totals; assistant message usage is partial. */
declare function cliTokenUsage(provider: 'codex' | 'claude-code', event: unknown): TokenUsage | undefined;
declare const incompleteGeneration: unique symbol;
declare const reportedGenerationUsage: unique symbol;
/** Carry measured usage across a failed invocation without retaining provider payloads. */
declare class GenerationUsageError extends Error {
    readonly [reportedGenerationUsage] = true;
    readonly usage: Readonly<TokenUsage>;
    readonly status?: number;
    readonly code?: string;
    constructor(message: string, usage: TokenUsage, options?: ErrorOptions);
}
/** Reported terminal usage survives rejection of an unusable model response. */
declare class IncompleteGenerationError extends Error {
    readonly reason: 'length' | 'tool_calls';
    readonly [incompleteGeneration] = true;
    readonly usage: Readonly<TokenUsage>;
    constructor(reason: 'length' | 'tool_calls', usage?: TokenUsage);
}
/** The cross-bundle brand identifies the error shape; measurements are still validated. */
declare function usageFromGenerationError(error: unknown): TokenUsage;
/** Undefined distinguishes an unrelated error from a measured invocation with unknown totals. */
declare function reportedUsageFromGenerationError(error: unknown): TokenUsage | undefined;
/** Aggregate measurements without treating missing provider data as zero. */
declare function sumTokenUsage(...measurements: readonly TokenUsage[]): TokenUsage;
/** Missing or invalid measurements cannot establish an inclusive token total. */
declare function knownTokenSum(...counts: readonly (number | null | undefined)[]): number | null;
/** Derive omitted partitions only when an authoritative total uniquely determines them. */
declare function inclusiveTokenTotals(parts: {
    input?: number;
    output?: number;
    additionalInput?: number;
    additionalOutput?: number;
    total?: number;
}): {
    inputTokens: number | null;
    outputTokens: number | null;
};

export { GenerationUsageError, IncompleteGenerationError, cliTokenUsage, inclusiveTokenTotals, knownTokenSum, reportedUsageFromGenerationError, sumTokenUsage, usageFromGenerationError };
