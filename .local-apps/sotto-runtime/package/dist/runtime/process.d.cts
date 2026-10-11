import { Readable } from 'node:stream';

interface ProcessRequest {
    command: string;
    args: readonly string[];
    environment: Readonly<Record<string, string | undefined>>;
    cwd?: string;
    input?: string | Uint8Array;
    /** A fresh, owned byte stream. The runner destroys it when execution ends. */
    inputStream?: () => Readable;
    /** Keep the transport open for supervised SSH disconnect detection. */
    keepInputOpen?: boolean;
    signal?: AbortSignal;
    /** Null explicitly preserves workloads without a wall-clock deadline. Cleanup stays bounded. */
    timeoutMs?: number | null;
    maxOutputBytes?: number;
    /** Optional per-stream bound, in addition to the combined output bound. */
    maxOutputBytesPerChannel?: number;
}
interface ProcessChunk {
    channel: 'stdout' | 'stderr';
    text: string;
}
interface ProcessByteRequest extends Omit<ProcessRequest, 'maxOutputBytes'> {
    /** Null permits unlimited cumulative output without retaining it in memory. */
    maxOutputBytes?: number | null;
    /** Queue high-water mark. Incoming pipe chunks and stream buffers are additional. */
    maxBufferedBytes?: number;
}
interface ProcessByteChunk {
    channel: 'stdout' | 'stderr';
    bytes: Uint8Array;
}
declare class ProcessExecutionError extends Error {
    readonly code: 'start_failed' | 'exit_failed' | 'output_limit' | 'busy' | 'cleanup_failed';
    readonly exitCode: number | null;
    /** Caller-visible diagnostics. Excluded from message and routine telemetry. */
    diagnostics?: {
        stdout: string;
        stderr: string;
    };
    /** Validated supervisor reason codes, without provider content or transport diagnostics. */
    remoteFailureCodes?: readonly string[];
    constructor(code: 'start_failed' | 'exit_failed' | 'output_limit' | 'busy' | 'cleanup_failed', exitCode?: number | null, options?: ErrorOptions);
}
/** Limits apply across simultaneous invocations sharing this runner. No implicit shell or inherited secrets. */
declare class ProcessRunner {
    private readonly maxConcurrent;
    private active;
    constructor(maxConcurrent?: number);
    stream(request: ProcessRequest): AsyncGenerator<ProcessChunk>;
    streamBytes(request: ProcessByteRequest): AsyncGenerator<ProcessByteChunk>;
    private decode;
    private run;
    execute(request: ProcessRequest): Promise<{
        stdout: string;
        stderr: string;
    }>;
}

export { type ProcessByteChunk, type ProcessByteRequest, type ProcessChunk, ProcessExecutionError, type ProcessRequest, ProcessRunner };
