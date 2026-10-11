import { SshConnection } from './environment.cjs';
import { ProcessRequest, ProcessRunner, ProcessChunk } from './process.cjs';
import { z } from 'zod';
import { S as StateStore } from '../index-8r2v4WCa.cjs';
import 'node:stream';

/** Python is an explicit remote prerequisite. The supervisor owns the agent's process group. */
declare const remoteSupervisor = "\nimport base64, json, os, select, signal, subprocess, sys, threading, time\nchild = None\nterminated = False\ndef terminate(*args):\n    global terminated\n    if child is not None and not terminated:\n        terminated = True\n        try: os.killpg(child.pid, signal.SIGKILL)\n        except ProcessLookupError: pass\ndef interrupted(*args):\n    terminate()\n    sys.exit(125)\nfor event in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):\n    signal.signal(event, interrupted)\nsignal.signal(signal.SIGALRM, interrupted)\nsignal.alarm(30)\nline = sys.stdin.buffer.readline(32 * 1024 * 1024 + 1)\nif len(line) > 32 * 1024 * 1024 or not line.endswith(b'\\n'): sys.exit(126)\npayload = json.loads(line)\ntimeout = payload['timeoutMs'] / 1000\nif timeout <= 0 or timeout > 86400: sys.exit(126)\ndeadline = time.monotonic() + timeout\nsignal.alarm(0)\nenvironment = {key: os.environ[key] for key in payload['environmentKeys'] if key in os.environ}\nenvironment.update(payload['environment'])\ntry:\n    child = subprocess.Popen(payload['argv'], stdin=subprocess.PIPE, start_new_session=True, env=environment)\n    data = base64.b64decode(payload['input'], validate=True)\n    def feed():\n        try:\n            child.stdin.write(data)\n            child.stdin.close()\n        except BrokenPipeError: pass\n    threading.Thread(target=feed, daemon=True).start()\n    while child.poll() is None:\n        if time.monotonic() >= deadline:\n            terminate()\n            sys.exit(124)\n        ready, _, _ = select.select([sys.stdin], [], [], 0.1)\n        if ready and not os.read(sys.stdin.fileno(), 1):\n            terminate()\n            sys.exit(125)\n    sys.exit(child.returncode if child.returncode >= 0 else 128 - child.returncode)\nfinally:\n    terminate()\n    if child is not None:\n        try: child.wait(timeout=1)\n        except subprocess.TimeoutExpired: pass\n";
interface RemoteAgentRequest {
    connection: SshConnection;
    command: string;
    args: readonly string[];
    input?: string | Uint8Array;
    /** Named remote environment fields only. Provider adapters choose the credential fields. */
    remoteEnvironmentKeys: readonly string[];
    remoteEnvironment?: Readonly<Record<string, string>>;
    transportEnvironment: Readonly<Record<string, string | undefined>>;
    timeoutMs?: number;
    maxOutputBytes?: number;
    signal?: AbortSignal;
}
declare function supervisedRemoteRequest(request: RemoteAgentRequest): ProcessRequest;
interface RemoteSessionRequest extends Omit<RemoteAgentRequest, 'args'> {
    remoteUser?: string;
    /** Persist this identity before connecting. Reuse it only for recovery, never another execution. */
    operationId: string;
    args: readonly (string | {
        file: number;
    })[];
    files: readonly string[];
    operationRoot?: string;
}
/** One supervised transport owns attachment writes, execution, and cleanup. */
declare function supervisedSessionRequest(request: RemoteSessionRequest, remainingMs?: () => number): Promise<ProcessRequest>;
declare function remoteRecoveryRequest(request: Pick<RemoteSessionRequest, 'operationId' | 'operationRoot' | 'remoteUser' | 'connection' | 'transportEnvironment' | 'signal'>): ProcessRequest;

/** The transport carries framed output. Agent output cannot impersonate cleanup acknowledgements. */
declare const remoteSessionSupervisor: string;

declare const remoteHostKeySchema: z.ZodObject<{
    algorithm: z.ZodEnum<{
        "ssh-ed25519": "ssh-ed25519";
        "ecdsa-sha2-nistp256": "ecdsa-sha2-nistp256";
        "ecdsa-sha2-nistp384": "ecdsa-sha2-nistp384";
        "ecdsa-sha2-nistp521": "ecdsa-sha2-nistp521";
        "ssh-rsa": "ssh-rsa";
    }>;
    key: z.ZodString;
}, z.core.$strict>;
declare const reason: z.ZodEnum<{
    cleanup_failed: "cleanup_failed";
    transport_failed: "transport_failed";
    protocol_failed: "protocol_failed";
    insufficient_containment: "insufficient_containment";
}>;
declare const binding: z.ZodObject<{
    connection: z.ZodObject<{
        host: z.ZodString;
        identityFile: z.ZodOptional<z.ZodString>;
        knownHostsFile: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    hostKey: z.ZodObject<{
        algorithm: z.ZodEnum<{
            "ssh-ed25519": "ssh-ed25519";
            "ecdsa-sha2-nistp256": "ecdsa-sha2-nistp256";
            "ecdsa-sha2-nistp384": "ecdsa-sha2-nistp384";
            "ecdsa-sha2-nistp521": "ecdsa-sha2-nistp521";
            "ssh-rsa": "ssh-rsa";
        }>;
        key: z.ZodString;
    }, z.core.$strict>;
    remoteUser: z.ZodString;
    operationRoot: z.ZodString;
    consumer: z.ZodObject<{
        id: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const record: z.ZodObject<{
    connection: z.ZodObject<{
        host: z.ZodString;
        identityFile: z.ZodOptional<z.ZodString>;
        knownHostsFile: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    hostKey: z.ZodObject<{
        algorithm: z.ZodEnum<{
            "ssh-ed25519": "ssh-ed25519";
            "ecdsa-sha2-nistp256": "ecdsa-sha2-nistp256";
            "ecdsa-sha2-nistp384": "ecdsa-sha2-nistp384";
            "ecdsa-sha2-nistp521": "ecdsa-sha2-nistp521";
            "ssh-rsa": "ssh-rsa";
        }>;
        key: z.ZodString;
    }, z.core.$strict>;
    remoteUser: z.ZodString;
    operationRoot: z.ZodString;
    consumer: z.ZodObject<{
        id: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
    operationId: z.ZodString;
    registrationToken: z.ZodString;
    createdAt: z.ZodNumber;
    cancelAfter: z.ZodNumber;
    status: z.ZodEnum<{
        active: "active";
        uncertain: "uncertain";
        prepared: "prepared";
    }>;
    reason: z.ZodOptional<z.ZodEnum<{
        cleanup_failed: "cleanup_failed";
        transport_failed: "transport_failed";
        protocol_failed: "protocol_failed";
        insufficient_containment: "insufficient_containment";
    }>>;
}, z.core.$strict>;
declare const remoteJournalStateSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    operations: z.ZodArray<z.ZodObject<{
        connection: z.ZodObject<{
            host: z.ZodString;
            identityFile: z.ZodOptional<z.ZodString>;
            knownHostsFile: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        hostKey: z.ZodObject<{
            algorithm: z.ZodEnum<{
                "ssh-ed25519": "ssh-ed25519";
                "ecdsa-sha2-nistp256": "ecdsa-sha2-nistp256";
                "ecdsa-sha2-nistp384": "ecdsa-sha2-nistp384";
                "ecdsa-sha2-nistp521": "ecdsa-sha2-nistp521";
                "ssh-rsa": "ssh-rsa";
            }>;
            key: z.ZodString;
        }, z.core.$strict>;
        remoteUser: z.ZodString;
        operationRoot: z.ZodString;
        consumer: z.ZodObject<{
            id: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
        operationId: z.ZodString;
        registrationToken: z.ZodString;
        createdAt: z.ZodNumber;
        cancelAfter: z.ZodNumber;
        status: z.ZodEnum<{
            active: "active";
            uncertain: "uncertain";
            prepared: "prepared";
        }>;
        reason: z.ZodOptional<z.ZodEnum<{
            cleanup_failed: "cleanup_failed";
            transport_failed: "transport_failed";
            protocol_failed: "protocol_failed";
            insufficient_containment: "insufficient_containment";
        }>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type RemoteJournalState = z.infer<typeof remoteJournalStateSchema>;
type RemoteOperation = z.infer<typeof record>;
type RemoteHostKey = z.infer<typeof remoteHostKeySchema>;
declare const initialRemoteJournalState: () => RemoteJournalState;
interface RemoteCleanupReceipt {
    operationId: string;
    remoteUser: string;
    operationRoot: string;
    /** The key enforced by the SSH transport, never an unverified remote JSON field. */
    hostKey: RemoteHostKey;
    containment: 'descendants' | 'process-group';
}
/** Private recovery metadata. Never expire or evict operations whose cleanup is unconfirmed. */
declare class RemoteOperationJournal {
    private readonly options;
    private readonly now;
    private readonly maximum;
    constructor(options: {
        store: StateStore<RemoteJournalState>;
        now?: () => number;
        maxPending?: number;
    });
    /** The runner must enforce this maximum lifetime, including upload and cleanup allowance. */
    register(input: z.infer<typeof binding> & {
        maximumLifetimeMs: number;
    }): Promise<RemoteOperation>;
    pending(): Promise<RemoteOperation[]>;
    current(expected: RemoteOperation): Promise<RemoteOperation | undefined>;
    /** Persist before spawning SSH. An uncertain write result must prevent execution. */
    connecting(expected: RemoteOperation): Promise<void>;
    /** Only a durable pre-connection record can be discarded without a remote receipt. */
    discardUnstarted(expected: RemoteOperation): Promise<void>;
    /** Deadline expiry authorizes timeout cancellation. It does not prove remote termination. */
    dueForCancellation(): Promise<RemoteOperation[]>;
    uncertain(expected: RemoteOperation, failure: z.infer<typeof reason>): Promise<void>;
    acknowledge(expected: RemoteOperation, receipt: RemoteCleanupReceipt): Promise<boolean>;
    private match;
}

interface PinnedSshConnection {
    connection: SshConnection;
    /** Release only after every process using this connection has settled. */
    release(primary?: {
        error: unknown;
    }): Promise<void>;
}
interface PinRequest {
    connection: SshConnection;
    remoteUser: string;
    hostKey: RemoteHostKey;
}
/** Endpoint pinning still trusts local SSH routing configuration, including ProxyCommand. */
declare function acquirePinnedSshConnection(request: PinRequest): Promise<PinnedSshConnection>;
/** The callback must await every SSH process before returning. */
declare function withPinnedSshConnection<Result>(request: PinRequest, run: (connection: SshConnection) => Promise<Result>): Promise<Result>;

declare class RemoteCleanupUncertainError extends Error {
    readonly operationId: string;
    readonly code: 'transport_failed' | 'protocol_failed' | 'cleanup_failed' | 'insufficient_containment';
    constructor(operationId: string, code: 'transport_failed' | 'protocol_failed' | 'cleanup_failed' | 'insufficient_containment', options?: ErrorOptions);
}
/** Explicitly cancels the recorded remote operation, including an operation still running there. */
declare class RemoteOperationRecovery {
    private readonly journal;
    private readonly runner;
    constructor(journal: RemoteOperationJournal, runner?: ProcessRunner);
    recover(operation: RemoteOperation, options: {
        environment: Readonly<Record<string, string | undefined>>;
        signal?: AbortSignal;
    }): Promise<void>;
}

declare const cleanupSchema: z.ZodObject<{
    type: z.ZodLiteral<"cleaned">;
    operationId: z.ZodString;
    remoteUser: z.ZodString;
    operationRoot: z.ZodString;
    exitCode: z.ZodNumber;
    containment: z.ZodEnum<{
        descendants: "descendants";
        "process-group": "process-group";
    }>;
}, z.core.$strict>;
type RemoteCleanupFrame = z.infer<typeof cleanupSchema>;
interface RemoteSessionOutput {
    channel: 'stdout' | 'stderr' | 'transport-stderr';
    text: string;
}
declare class RemoteProtocolError extends Error {
    readonly code: 'protocol_failed' | 'output_limit';
    constructor(code: 'protocol_failed' | 'output_limit');
}
/** The supervisor emits ASCII JSON. Child bytes are base64 and decode independently per channel. */
declare class RemoteOutputDecoder {
    private readonly expected;
    private pending;
    private bytes;
    private diagnosticBytes;
    private readonly decoders;
    private cleanup?;
    private failures;
    private finished;
    private invalid;
    private readonly maximum;
    private readonly diagnosticsMaximum;
    constructor(expected: {
        operationId: string;
        remoteUser: string;
        operationRoot: string;
        maxOutputBytes?: number;
        maxDiagnosticBytes?: number;
    });
    push(chunk: ProcessChunk): RemoteSessionOutput[];
    /** Call only after stdout EOF and transport settlement. Cleanup never converts execution failure to success. */
    finish(transport: {
        error?: unknown;
    }): {
        cleanup?: RemoteCleanupFrame;
        failures: readonly string[];
        transportError?: unknown;
    };
    private frame;
}

interface RemoteExecutionRequest extends Omit<RemoteSessionRequest, 'operationId'> {
    remoteUser: string;
    operationRoot: string;
    hostKey: RemoteHostKey;
    consumer: {
        id: string;
        generation: number;
    };
    maxDiagnosticBytes?: number;
}
/** Owns one execution attempt. Recovery may repeat, but execution is never replayed. */
declare class RemoteSessionRunner {
    private readonly journal;
    private readonly runner;
    private readonly recovery;
    constructor(journal: RemoteOperationJournal, runner?: ProcessRunner);
    stream(request: RemoteExecutionRequest): AsyncGenerator<RemoteSessionOutput, void, unknown>;
    private execute;
    private close;
}

export { type PinnedSshConnection, type RemoteAgentRequest, type RemoteCleanupFrame, type RemoteCleanupReceipt, RemoteCleanupUncertainError, type RemoteExecutionRequest, type RemoteHostKey, type RemoteJournalState, type RemoteOperation, RemoteOperationJournal, RemoteOperationRecovery, RemoteOutputDecoder, RemoteProtocolError, type RemoteSessionOutput, type RemoteSessionRequest, RemoteSessionRunner, acquirePinnedSshConnection, initialRemoteJournalState, remoteHostKeySchema, remoteJournalStateSchema, remoteRecoveryRequest, remoteSessionSupervisor, remoteSupervisor, supervisedRemoteRequest, supervisedSessionRequest, withPinnedSshConnection };
