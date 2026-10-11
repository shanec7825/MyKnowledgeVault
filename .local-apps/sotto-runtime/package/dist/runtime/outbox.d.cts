import { z } from 'zod';
import { a as SqlExecutor, E as ExecutionWorkspacePlan, b as ExecutionWorkspace } from '../index-8r2v4WCa.cjs';
import 'node:stream';

/** Immutable bounded pages. All writes belong to the caller's atomic transaction. */
declare class JobSnapshot {
    private readonly database;
    private readonly dialect;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private backend;
    private metadata;
    create(id: string, binding: string): Promise<void>;
    /** The retention policy fixes snapshot identity to its owning job, with no independent ID. */
    createForJob(job: {
        id: string;
        fingerprint: string;
    }): Promise<void>;
    append(id: string, binding: string, index: number, items: readonly unknown[]): Promise<void>;
    seal(id: string, binding: string): Promise<number>;
    read(id: string, binding: string, index: number): Promise<{
        items: z.core.util.JSONType[];
        pages: number;
        next: number | null;
    }>;
    /**
     * Caller must prove authorization and exact parent binding before each transaction.
     * Deletes at most ten pages atomically with the cursor. Captured worker memory is not
     * revoked; workers must still recheck deletion admission before committing effects.
     */
    eraseNext(id: string, binding: string): Promise<{
        complete: boolean;
    }>;
}

declare const binding: z.ZodObject<{
    id: z.ZodUUID;
    parentId: z.ZodUUID;
    fingerprint: z.ZodString;
    executorId: z.ZodUUID;
}, z.core.$strict>;
declare const recordSchema$1: z.ZodObject<{
    id: z.ZodUUID;
    parentId: z.ZodUUID;
    fingerprint: z.ZodString;
    executorId: z.ZodUUID;
    kind: z.ZodLiteral<"job_execution">;
    scopeDigests: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        active: "active";
        settled: "settled";
        "cleanup-unconfirmed": "cleanup-unconfirmed";
    }>;
    workspace: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
        locationId: z.ZodUUID;
        executionId: z.ZodUUID;
        root: z.ZodObject<{
            root: z.ZodString;
            device: z.ZodString;
            inode: z.ZodString;
            binding: z.ZodString;
        }, z.core.$strict>;
        directory: z.ZodObject<{
            root: z.ZodString;
            device: z.ZodString;
            inode: z.ZodString;
            binding: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        locationId: z.ZodUUID;
        executionId: z.ZodUUID;
        root: z.ZodObject<{
            root: z.ZodString;
            device: z.ZodString;
            inode: z.ZodString;
            binding: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>]>>;
}, z.core.$strict>;
type JobExecutionBinding = z.infer<typeof binding>;
type JobExecutionRecord = z.infer<typeof recordSchema$1>;
declare class JobExecutionAdmissionConflict extends Error {
    constructor(message: string);
}
/**
 * Use caller-owned Serializable transactions. Begin before external effects, with a fresh
 * execution and supervisor-instance UUID. A queue failure, expired lease or dead worker
 * is never cleanup proof. This journal records caller-verified cleanup, not termination.
 * Records retain only opaque identities and scope digests after application erasure.
 */
declare class JobExecutionJournal {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private backend;
    private gate;
    private scopePrefix;
    private owned;
    begin(input: JobExecutionBinding, workspaceInput?: ExecutionWorkspacePlan): Promise<JobExecutionRecord>;
    read(input: JobExecutionBinding): Promise<JobExecutionRecord>;
    /** Attach only the identity created from the admitted intent, before any child effects. */
    attachWorkspace(input: JobExecutionBinding, workspaceInput: ExecutionWorkspace): Promise<void>;
    /**
     * Record verified removal only after the exact executor and its I/O have stopped.
     * After a lost commit response, read the exact execution: absent workspace confirms
     * release. Do not blindly replay this operation or recapture an attached identity.
     */
    releaseWorkspace(input: JobExecutionBinding, expectedInput: ExecutionWorkspacePlan | ExecutionWorkspace): Promise<void>;
    markCleanupUnconfirmed(input: JobExecutionBinding): Promise<void>;
    /**
     * Call only after all owned processes, streams and temporary resources have settled.
     * Recovery callers must verify the exact supervisor instance and containment scope.
     * Local cancellation alone does not establish remote provider termination.
     */
    settle(input: JobExecutionBinding): Promise<void>;
    requireParentDrained(parentId: string, fingerprint: string): Promise<void>;
    blockingStatus(parentId: string, fingerprint: string): Promise<'active' | 'cleanup-unconfirmed' | null>;
    /** Bounded scan across attempts. Retry and deletion admission must check all relevant scopes. */
    listUnresolved(scope: {
        subjectId: string;
        generation: number;
    }, after?: string | null): Promise<{
        executions: {
            id: string;
            parentId: string;
            fingerprint: string;
            executorId: string;
            kind: "job_execution";
            scopeDigests: string[];
            status: "active" | "settled" | "cleanup-unconfirmed";
            workspace?: {
                locationId: string;
                executionId: string;
                root: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
                directory: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
            } | {
                locationId: string;
                executionId: string;
                root: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
            } | undefined;
        }[];
        cursor: string | null;
    }>;
}

declare class JobExecutionCleanupError extends Error {
    constructor(options: ErrorOptions);
}
/** Shared ownership failures cannot be downgraded by an application's classifier. */
declare function isJobExecutionCleanupFailure(error: unknown): boolean;
/**
 * Every transaction callback must run in a fresh caller-owned Serializable transaction.
 * run must await its owned I/O or report uncertain cleanup. The workspace root and
 * location identity must be initialized before invocation. No automatic crash recovery.
 */
declare function runJobExecution<Database, Result>(options: {
    namespace: string;
    dialect: 'postgres' | 'sqlite';
    executorId: string;
    parentId: string;
    fingerprint: string;
    signal: AbortSignal;
    transaction: <Value>(operation: (database: Database) => Promise<Value>, signal?: AbortSignal) => Promise<Value>;
    executor: (database: Database) => SqlExecutor;
    validate: (database: Database) => Promise<boolean>;
    isCleanupFailure: (error: unknown) => boolean;
    workspace?: {
        root: string;
        locationId: string;
    };
    run: (context: {
        markCleanupUnconfirmed: () => void;
        directory?: string;
    }) => Promise<Result>;
}): Promise<Result | undefined>;

/**
 * Caller-owned Serializable steps. Applications opting into this policy must use job-ID
 * snapshots and fence final mutations of non-storage workers against deletion admission.
 */
declare class JobRetentionCleanup {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private admission;
    step(id: string): Promise<{
        complete: boolean;
    }>;
}

declare const referenceSchema: z.ZodObject<{
    id: z.ZodUUID;
    fingerprint: z.ZodString;
}, z.core.$strict>;
declare const pageSchema: z.ZodObject<{
    jobs: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        fingerprint: z.ZodString;
    }, z.core.$strict>>;
    cursor: z.ZodNullable<z.ZodUUID>;
}, z.core.$strict>;
type JobDeliveryReference = z.infer<typeof referenceSchema>;
type JobDeliveryOutcome = 'delivered' | 'complete' | 'erased';
type JobDeliveryResult = JobDeliveryReference & ({
    status: JobDeliveryOutcome;
} | {
    status: 'failed';
    error: unknown;
});
/** Reconcile one bounded page outside the listing transaction. The caller owns the cursor. */
declare function reconcileOutboxPage(options: {
    cursor: string | null;
    signal: AbortSignal;
    listIncomplete: (cursor: string | null) => Promise<z.infer<typeof pageSchema>>;
    deliver: (reference: JobDeliveryReference, signal: AbortSignal) => Promise<JobDeliveryOutcome>;
}): Promise<{
    cursor: string | null;
    results: JobDeliveryResult[];
}>;

declare const jobSchema: z.ZodObject<{
    id: z.ZodUUID;
    namespace: z.ZodString;
    handler: z.ZodString;
    version: z.ZodNumber;
    payload: z.ZodJSONSchema;
    scopes: z.ZodArray<z.ZodObject<{
        subjectId: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>>;
    delivery: z.ZodObject<{
        attempts: z.ZodNumber;
        priority: z.ZodNumber;
        availableAt: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const recordSchema: z.ZodObject<{
    kind: z.ZodLiteral<"outbox_job">;
    job: z.ZodObject<{
        id: z.ZodUUID;
        namespace: z.ZodString;
        handler: z.ZodString;
        version: z.ZodNumber;
        payload: z.ZodJSONSchema;
        scopes: z.ZodArray<z.ZodObject<{
            subjectId: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>>;
        delivery: z.ZodObject<{
            attempts: z.ZodNumber;
            priority: z.ZodNumber;
            availableAt: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    fingerprint: z.ZodString;
    delivered: z.ZodBoolean;
    complete: z.ZodBoolean;
}, z.core.$strict>;
type PreparedJob = z.infer<typeof jobSchema>;
type OutboxJob = z.infer<typeof recordSchema>;
declare const erasedSchema: z.ZodObject<{
    kind: z.ZodLiteral<"outbox_erased">;
    namespace: z.ZodString;
    id: z.ZodUUID;
    handler: z.ZodString;
    version: z.ZodNumber;
    fingerprint: z.ZodString;
    scopeDigests: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
type ErasedJobReceipt = z.infer<typeof erasedSchema>;
declare class JobErasedError extends Error {
    readonly receipt: ErasedJobReceipt;
    constructor(receipt: ErasedJobReceipt);
}
/** Prepare outside transaction retries. Payloads must contain references, never provider credentials. */
declare function prepareJob(input: Omit<PreparedJob, 'id'> & {
    id?: string;
}): PreparedJob;
/**
 * Bind every mutation to the caller's Serializable transaction alongside application changes.
 * Delivery is at least once. Workers revalidate captured scopes, then call complete before
 * applying their final database mutations in that same transaction. A false result skips
 * those mutations. External effects need their own durable protocol, such as storage intents.
 */
declare class JobOutbox {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private key;
    private backend;
    private scopePrefix;
    private validate;
    private parse;
    read(id: string): Promise<OutboxJob | null>;
    /** Parent cancellation is terminal, but never evidence that its application work succeeded. */
    readParent(id: string, expected: {
        fingerprint: string;
        handler: string;
        version: number;
        scopes: readonly {
            subjectId: string;
            generation: number;
        }[];
    }): Promise<{
        status: "erased";
        record?: undefined;
    } | {
        status: "complete" | "pending";
        record: {
            kind: "outbox_job";
            job: {
                id: string;
                namespace: string;
                handler: string;
                version: number;
                payload: z.core.util.JSONType;
                scopes: {
                    subjectId: string;
                    generation: number;
                }[];
                delivery: {
                    attempts: number;
                    priority: number;
                    availableAt: number;
                };
            };
            fingerprint: string;
            delivered: boolean;
            complete: boolean;
        };
    }>;
    /** A terminal erased receipt is distinct from successful application completion. */
    receipt(id: string): Promise<{
        status: "complete" | "pending";
        id: string;
        handler: string;
        version: number;
        fingerprint: string;
    } | {
        status: "erased";
        id: string;
        handler: string;
        version: number;
        fingerprint: string;
    } | null>;
    /** Caller must drain writers and cancel dependent work before erasing retained payloads. */
    erase(id: string, fingerprint: string, captured: {
        subjectId: string;
        generation: number;
    }): Promise<void>;
    enqueue(input: PreparedJob): Promise<OutboxJob>;
    private indexScopes;
    /** Backfill old retained work. Persist the returned cursor in this same transaction. */
    backfillScopeIndex(after?: string | null): Promise<{
        indexed: number;
        cursor: string | null;
    }>;
    /** Ten validated jobs per page, including completed work and retained erased receipts. */
    listForScope(subjectId: string, generation: number, after?: string | null): Promise<{
        jobs: {
            id: string;
            fingerprint: string;
        }[];
        cursor: string | null;
    }>;
    private list;
    /** Only identifiers are paged, so large payloads never multiply the page memory bound. */
    listPending(after?: string | null): Promise<{
        jobs: Array<{
            id: string;
            fingerprint: string;
        }>;
        cursor: string | null;
    }>;
    /** Reconcile these operations with the queue even after acceptance, including after Redis data loss. */
    listIncomplete(after?: string | null): Promise<{
        jobs: Array<{
            id: string;
            fingerprint: string;
        }>;
        cursor: string | null;
    }>;
    private update;
    /** Call only after observing acceptance of this exact immutable operation by the queue. */
    acknowledgeDelivery(id: string, fingerprint: string): Promise<boolean>;
    /** Permanent receipt prevents duplicate final application commits after queue retention expires. */
    complete(id: string, fingerprint: string): Promise<boolean>;
}

export { type ErasedJobReceipt, type JobDeliveryOutcome, type JobDeliveryReference, type JobDeliveryResult, JobErasedError, JobExecutionAdmissionConflict, type JobExecutionBinding, JobExecutionCleanupError, JobExecutionJournal, type JobExecutionRecord, JobOutbox, JobRetentionCleanup, JobSnapshot, type OutboxJob, type PreparedJob, isJobExecutionCleanupFailure, prepareJob, reconcileOutboxPage, runJobExecution };
