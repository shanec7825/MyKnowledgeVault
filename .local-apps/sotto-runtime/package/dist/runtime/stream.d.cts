/** Stop waiting even when an external adapter fails to honor cancellation. */
declare function abortable<Result>(work: Promise<Result>, signal: AbortSignal): Promise<Result>;

declare class ResponseBodyTooLargeError extends Error {
    readonly maxBytes: number;
    constructor(maxBytes: number);
}
/** The caller combines cancellation and its total request deadline in signal. */
declare function readResponseText(response: Pick<Response, 'body'>, options: {
    signal: AbortSignal;
    maxBytes: number;
}): Promise<string>;
/** Owned binary response read. The caller selects a bound supported by its allocation/runtime policy. */
declare function readResponseBytes(response: Pick<Response, 'body'>, options: {
    signal: AbortSignal;
    maxBytes: number;
}): Promise<Uint8Array>;

interface StreamGuard {
    /** Throw when the original authorization is no longer valid. */
    validate(): undefined;
    release(): void | Promise<void>;
}
/**
 * Abort before queuing iterator closure behind a pending read. The lazy source
 * must honor its signal and finish owned cleanup before settling. Classify
 * cleanup errors explicitly so cancellation itself does not make return fail.
 */
declare function interruptibleStream<T>(open: (signal: AbortSignal) => AsyncGenerator<T>, options: {
    signal?: AbortSignal;
    isCleanupError: (error: unknown) => boolean;
}): AsyncGenerator<T>;
/**
 * Preserve backpressure and revalidate each chunk before exposing its bytes.
 * The source must settle cancellation after stopping its I/O. Resource release
 * waits for that acknowledgement so cleanup cannot race an active upstream.
 */
declare function guardStream<Chunk>(source: ReadableStream<Chunk>, guard: StreamGuard): ReadableStream<Chunk>;

export { ResponseBodyTooLargeError, type StreamGuard, abortable, guardStream, interruptibleStream, readResponseBytes, readResponseText };
