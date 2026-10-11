import { ProcessChunk } from './process.cjs';
import 'node:stream';

interface IsolatedIdentity {
    containerName: string;
    executionId: string;
    daemonId: string;
}
interface IsolatedRequest {
    executionId: string;
    /** Reviewed image including its sha256 digest. No mutable tags. */
    image: string;
    command: readonly [string, ...string[]];
    input?: string;
    signal?: AbortSignal;
    timeoutMs: number;
    maxOutputBytes: number;
    memoryMb: number;
    cpus: number;
    pids: number;
    scratchMb: number;
    /** Only the execution-specific directory containing broker.sock is mounted. */
    brokerDirectory?: string;
    /** Must durably commit before Docker creation. Reconcile these records on restart. */
    recordIdentity(identity: IsolatedIdentity): Promise<void>;
    /** Called only after the daemon confirms absence. */
    recordCleanup(identity: IsolatedIdentity): Promise<void>;
}
declare class IsolatedCleanupError extends Error {
    readonly identity: IsolatedIdentity;
    constructor(identity: IsolatedIdentity);
}
/** Optional Docker transport. Importing this module never contacts Docker. */
declare class DockerIsolatedRunner {
    private readonly dockerCommand;
    private readonly processRunner;
    constructor(dockerCommand?: string);
    private docker;
    private environment;
    reconcile(identity: IsolatedIdentity): Promise<void>;
    stream(request: IsolatedRequest): AsyncGenerator<ProcessChunk>;
    private execute;
    private verifyCreation;
    private recordCleanup;
}

export { DockerIsolatedRunner, IsolatedCleanupError, type IsolatedIdentity, type IsolatedRequest };
