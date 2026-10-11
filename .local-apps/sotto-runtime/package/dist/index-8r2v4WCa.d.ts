import { Readable } from 'node:stream';
import { z } from 'zod';

/**
 * The parent directory must already exist inside trusted application storage.
 * Creation is allowed only while holding the authoritative credential-state
 * transaction and after confirming that it contains no encrypted records.
 * Reads may create the stable lock anchor, but never the key itself.
 */
declare function localEncryptionKey(path: string, options: {
    create: boolean;
}): Uint8Array;

interface StateSnapshot {
    revision: string;
    state: unknown;
}
interface AtomicStateBackend {
    read(): Promise<StateSnapshot | null>;
    /** Must atomically compare the previous revision and persist both new revision and state. */
    compareAndSwap(previous: string | null, next: StateSnapshot): Promise<boolean>;
}
interface OptimisticOptions<State> {
    backend: AtomicStateBackend;
    parse(value: unknown): State;
    initial(): State;
    maxAttempts?: number;
}
/** Supports database adapters without coupling the shared package to a particular ORM. */
declare class OptimisticStateStore<State> implements StateStore<State> {
    private readonly options;
    private readonly attempts;
    constructor(options: OptimisticOptions<State>);
    read(): Promise<State>;
    transact<Result>(operation: (state: State) => Result): Promise<Result>;
}

declare function isSerializationConflict(error: unknown): boolean;
/**
 * Each attempt must open and finish a fresh Serializable database transaction.
 * Retryable work may contain database changes and repeatable computation only.
 * External requests, filesystem writes and notifications belong outside this callback.
 * Ten attempts use exponential equal jitter (5..500ms per sleep), at most 2130ms
 * total backoff. Jitter separates competing writers without an unbounded retry loop.
 */
declare function retrySerializableTransaction<Result>(runTransaction: () => Promise<Result>, options?: {
    signal?: AbortSignal;
}): Promise<Result>;
interface SqlExecutor {
    /** Parameterized query against the caller's existing connection or transaction. */
    query(sql: string, values: readonly unknown[]): Promise<readonly Record<string, unknown>[]>;
}
/** Optional database work inside a caller-owned transaction. Conflicts retry the whole transaction. */
declare function optionalSqlWrite<Result>(database: SqlExecutor, operation: () => Promise<Result>): Promise<{
    ok: true;
    value: Result;
} | {
    ok: false;
    error: unknown;
}>;
/** Bounded keyset scan over colon-terminated namespaces using the state table's pattern index. */
declare function sqlStateRows(database: SqlExecutor, dialect: 'postgres' | 'sqlite', prefix: string, after: string | null, limit?: number, cursorKind?: 'digest' | 'uuid' | 'compoundDigest'): Promise<readonly Record<string, unknown>[]>;
/** Uses the caller-migrated SidedoorState table. No connection pool or schema changes are implicit. */
declare function sqlStateBackend(database: SqlExecutor, dialect: 'postgres' | 'sqlite', id: string): AtomicStateBackend;

interface StorageInstanceScope {
    instanceId: string;
    subjectId: string;
    generation: 0;
}
/**
 * Bootstrap and reset compose these operations in caller-owned Serializable transactions.
 * Runtime reads never initialize missing control. Resets retain all allocation and journal rows.
 */
declare class StorageInstanceControl {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private control;
    private allocated;
    private writes;
    private current;
    private reserve;
    /** Prepare the UUID outside retries. Invoke only from explicit bootstrap or migration. */
    initialize(preparedInstanceId: string): Promise<StorageInstanceScope>;
    /** Final reference transactions must compare this ID with the operation's captured ID. */
    read(): Promise<StorageInstanceScope>;
    /** Compose with old-instance cleanup registration and tombstoning in the reset transaction. */
    rotate(expectedInstanceId: string, preparedInstanceId: string): Promise<StorageInstanceScope>;
}

declare const storageCleanupDescriptorSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"local">;
    identity: z.ZodObject<{
        root: z.ZodString;
        device: z.ZodString;
        inode: z.ZodString;
        binding: z.ZodString;
    }, z.core.$strict>;
    referenceRoot: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"object">;
    location: z.ZodObject<{
        kind: z.ZodLiteral<"object">;
        endpoint: z.ZodString;
        bucket: z.ZodString;
    }, z.core.$strict>;
    binding: z.ZodString;
    access: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        provider: z.ZodString;
        credentialRevision: z.ZodUUID;
        signingRegion: z.ZodString;
    }, z.core.$strict>>>;
    publicUrl: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    referenceEncoding: z.ZodDefault<z.ZodEnum<{
        raw: "raw";
        percent: "percent";
    }>>;
}, z.core.$strict>], "kind">;
type StorageCleanupDescriptor = z.infer<typeof storageCleanupDescriptorSchema>;
declare const registrationSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"storage_backend">;
    namespace: z.ZodString;
    id: z.ZodString;
    binding: z.ZodString;
    descriptor: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"local">;
        identity: z.ZodObject<{
            root: z.ZodString;
            device: z.ZodString;
            inode: z.ZodString;
            binding: z.ZodString;
        }, z.core.$strict>;
        referenceRoot: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        kind: z.ZodLiteral<"object">;
        location: z.ZodObject<{
            kind: z.ZodLiteral<"object">;
            endpoint: z.ZodString;
            bucket: z.ZodString;
        }, z.core.$strict>;
        binding: z.ZodString;
        access: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            provider: z.ZodString;
            credentialRevision: z.ZodUUID;
            signingRegion: z.ZodString;
        }, z.core.$strict>>>;
        publicUrl: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        referenceEncoding: z.ZodDefault<z.ZodEnum<{
            raw: "raw";
            percent: "percent";
        }>>;
    }, z.core.$strict>], "kind">;
}, z.core.$strict>;
type PreparedStorageBackend = z.infer<typeof registrationSchema>;
/** Historical aliases and their encoding are immutable snapshots, separate from physical bindings. */
declare function prepareStorageBackend(namespace: string, input: z.input<typeof storageCleanupDescriptorSchema>): PreparedStorageBackend;
/** Caller-owned SQL transactions retain descriptors as long as any intent or cleanup target references them. */
declare class StorageBackendRegistry {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly namespaceHash;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private backend;
    private validate;
    get(id: string): Promise<PreparedStorageBackend | null>;
    register(prepared: PreparedStorageBackend): Promise<void>;
}

declare const referenceSchema: z.ZodObject<{
    namespace: z.ZodString;
    operationId: z.ZodUUID;
    reference: z.ZodString;
    localRoutePrefix: z.ZodOptional<z.ZodString>;
    target: z.ZodObject<{
        backendId: z.ZodString;
        binding: z.ZodString;
        key: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    }, z.core.$strict>;
    scopes: z.ZodArray<z.ZodObject<{
        subjectId: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>>;
}, z.core.$strict>;
type PreparedStorageReference = z.infer<typeof referenceSchema>;
/** Valid attribution exists, but the requested application consumer does not own it. */
declare class StorageReferenceConsumerMismatchError extends Error {
    constructor();
}
/** Prepare once outside transaction retries, after the writer returns its captured reference. */
declare function prepareStorageReference(input: PreparedStorageReference): PreparedStorageReference;
/** Capture the complete immutable consumer claims before storage I/O begins. */
declare function prepareStorageReferenceClaims(input: ReadonlyArray<{
    consumer: string;
    previousReference: string | null;
}>): {
    consumer: string;
    previousReference: string | null;
}[];
/**
 * All operations belong to the caller's Serializable reference transaction.
 * Retirement preserves attribution, it never grants permission to delete bytes.
 * Cleanup must validate every current consumer and erasure scope before deleting.
 */
declare class StorageReferenceRegistry {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private backend;
    private validate;
    /** Validate captured cleanup attribution even after its asset row was erased. No access grant. */
    validateRetainedAttribution(input: {
        assetId: string;
        prepared: PreparedStorageReference;
    }): Promise<{
        assetId: string;
        prepared: {
            namespace: string;
            operationId: string;
            reference: string;
            target: {
                backendId: string;
                binding: string;
                key: string;
            };
            scopes: {
                subjectId: string;
                generation: number;
            }[];
            localRoutePrefix?: string | undefined;
        };
        backend: {
            schemaVersion: 1;
            kind: "storage_backend";
            namespace: string;
            id: string;
            binding: string;
            descriptor: {
                kind: "local";
                identity: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
                referenceRoot: string;
            } | {
                kind: "object";
                location: {
                    kind: "object";
                    endpoint: string;
                    bucket: string;
                };
                binding: string;
                access: {
                    provider: string;
                    credentialRevision: string;
                    signingRegion: string;
                } | null;
                publicUrl: string | null;
                referenceEncoding: "raw" | "percent";
            };
        };
    }>;
    /** Retained attribution remains readable after the last application consumer retires. */
    readAsset(id: string): Promise<{
        asset: {
            schemaVersion: 1;
            kind: "storage_asset";
            id: string;
            prepared: {
                namespace: string;
                operationId: string;
                reference: string;
                target: {
                    backendId: string;
                    binding: string;
                    key: string;
                };
                scopes: {
                    subjectId: string;
                    generation: number;
                }[];
                localRoutePrefix?: string | undefined;
            };
            consumers: string[];
        };
        backend: {
            schemaVersion: 1;
            kind: "storage_backend";
            namespace: string;
            id: string;
            binding: string;
            descriptor: {
                kind: "local";
                identity: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
                referenceRoot: string;
            } | {
                kind: "object";
                location: {
                    kind: "object";
                    endpoint: string;
                    bucket: string;
                };
                binding: string;
                access: {
                    provider: string;
                    credentialRevision: string;
                    signingRegion: string;
                } | null;
                publicUrl: string | null;
                referenceEncoding: "raw" | "percent";
            };
        };
    } | null>;
    /** Historical lookup does not grant current consumer ownership or application access. */
    readReference(reference: string): Promise<{
        asset: {
            schemaVersion: 1;
            kind: "storage_asset";
            id: string;
            prepared: {
                namespace: string;
                operationId: string;
                reference: string;
                target: {
                    backendId: string;
                    binding: string;
                    key: string;
                };
                scopes: {
                    subjectId: string;
                    generation: number;
                }[];
                localRoutePrefix?: string | undefined;
            };
            consumers: string[];
        };
        backend: {
            schemaVersion: 1;
            kind: "storage_backend";
            namespace: string;
            id: string;
            binding: string;
            descriptor: {
                kind: "local";
                identity: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
                referenceRoot: string;
            } | {
                kind: "object";
                location: {
                    kind: "object";
                    endpoint: string;
                    bucket: string;
                };
                binding: string;
                access: {
                    provider: string;
                    credentialRevision: string;
                    signingRegion: string;
                } | null;
                publicUrl: string | null;
                referenceEncoding: "raw" | "percent";
            };
        };
    } | null>;
    /** Immutable claims captured by the original replacement transaction. */
    readAllocation(id: string): Promise<{
        kind: "storage_reference_allocation";
        namespace: string;
        operationId: string;
        assetId: string;
        claims: {
            consumer: string;
            previousReference: string | null;
        }[];
    } | null>;
    /** Exact replacement evidence. Unknown historical ownership stays explicitly unresolved. */
    readRetirement(operationId: string, consumer: string): Promise<{
        schemaVersion: 1;
        kind: "storage_reference_retirement";
        namespace: string;
        operationId: string;
        consumer: string;
        previousReference: string;
        replacementAssetId: string | null;
        attribution: {
            assetId: string;
            prepared: {
                namespace: string;
                operationId: string;
                reference: string;
                target: {
                    backendId: string;
                    binding: string;
                    key: string;
                };
                scopes: {
                    subjectId: string;
                    generation: number;
                }[];
                localRoutePrefix?: string | undefined;
            };
        } | null;
        status: "pending" | "unresolved";
    } | null>;
    /**
     * Scan every page in the caller's Serializable snapshot before removing application rows.
     * Empty consumer lists remain discoverable: retirement does not erase asset ownership scopes.
     * The application determines which scopes belong to its deletion operation.
     */
    listAssets(after?: string | null): Promise<{
        assets: {
            schemaVersion: 1;
            kind: "storage_asset";
            id: string;
            prepared: {
                namespace: string;
                operationId: string;
                reference: string;
                target: {
                    backendId: string;
                    binding: string;
                    key: string;
                };
                scopes: {
                    subjectId: string;
                    generation: number;
                }[];
                localRoutePrefix?: string | undefined;
            };
            consumers: string[];
        }[];
        cursor: string | null;
    }>;
    /** Includes unresolved references with no asset row. Consumer ownership is application-defined. */
    listRetirements(after?: string | null): Promise<{
        retirements: {
            schemaVersion: 1;
            kind: "storage_reference_retirement";
            namespace: string;
            operationId: string;
            consumer: string;
            previousReference: string;
            replacementAssetId: string | null;
            attribution: {
                assetId: string;
                prepared: {
                    namespace: string;
                    operationId: string;
                    reference: string;
                    target: {
                        backendId: string;
                        binding: string;
                        key: string;
                    };
                    scopes: {
                        subjectId: string;
                        generation: number;
                    }[];
                    localRoutePrefix?: string | undefined;
                };
            } | null;
            status: "pending" | "unresolved";
        }[];
        cursor: string | null;
    }>;
    private decode;
    private attributed;
    replace(input: {
        consumer: string;
        previousReference: string | null;
        next: PreparedStorageReference;
    }): Promise<void>;
    /** Resolve current consumer attribution in the caller's Serializable snapshot.
     * Unknown references require explicit adoption. This never grants application access.
     */
    resolve(input: {
        consumer: string;
        reference: string;
    }): Promise<{
        assetId: string;
        prepared: {
            namespace: string;
            operationId: string;
            reference: string;
            target: {
                backendId: string;
                binding: string;
                key: string;
            };
            scopes: {
                subjectId: string;
                generation: number;
            }[];
            localRoutePrefix?: string | undefined;
        };
        backend: {
            schemaVersion: 1;
            kind: "storage_backend";
            namespace: string;
            id: string;
            binding: string;
            descriptor: {
                kind: "local";
                identity: {
                    root: string;
                    device: string;
                    inode: string;
                    binding: string;
                };
                referenceRoot: string;
            } | {
                kind: "object";
                location: {
                    kind: "object";
                    endpoint: string;
                    bucket: string;
                };
                binding: string;
                access: {
                    provider: string;
                    credentialRevision: string;
                    signingRegion: string;
                } | null;
                publicUrl: string | null;
                referenceEncoding: "raw" | "percent";
            };
        };
    } | null>;
    private validateBackend;
    /** Allocate one immutable asset for all of its application references in the caller's transaction. */
    replaceMany(input: {
        consumers: ReadonlyArray<{
            consumer: string;
            previousReference: string | null;
        }>;
        next: PreparedStorageReference;
    }): Promise<void>;
    /** Commit with removal of the application's reference, including selection of a bundled asset. */
    retire(input: {
        operationId: string;
        consumer: string;
        previousReference: string;
    }): Promise<void>;
    private retireReference;
}

declare const errorBrand: unique symbol;
declare class ReferenceSetError extends Error {
    readonly code: 'invalid' | 'conflict';
    readonly [errorBrand] = true;
    constructor(code: 'invalid' | 'conflict', message: string);
}
declare function isReferenceSetError(error: unknown): error is ReferenceSetError;
interface ReferenceSetAdmission<Snapshot> {
    readonly instanceId: string;
    readonly scopes: ReadonlyArray<{
        readonly subjectId: string;
        readonly generation: number;
    }>;
    readonly snapshot: Snapshot;
}
interface ReferenceSetWriter {
    readonly descriptor: StorageCleanupDescriptor;
    readonly localRoutePrefix?: string;
    /** The port must address the captured descriptor. A rejected remote request remains uncertain. */
    write(key: string, body: Uint8Array | Readable, contentType: string, signal: AbortSignal): Promise<string>;
}
interface ReferenceSetArtifact<Snapshot> {
    readonly name: string;
    readonly prefix: string;
    readonly extension: string;
    readonly contentType: string;
    readonly body: Uint8Array | Readable;
    captureWriter(): Promise<ReferenceSetWriter>;
    consumers(snapshot: Snapshot): ReadonlyArray<{
        consumer: string;
        previousReference: string | null;
    }>;
}
interface ReferenceSetOptions<Transaction, Snapshot> {
    namespace: string;
    dialect: 'postgres' | 'sqlite';
    signal: AbortSignal;
    artifacts: readonly ReferenceSetArtifact<Snapshot>[];
    /** Each invocation owns a fresh Serializable transaction, retrying only its callback. */
    transaction<Result>(operation: (tx: Transaction) => Promise<Result>): Promise<Result>;
    executor(tx: Transaction): SqlExecutor;
    captureAdmission(tx: Transaction): Promise<ReferenceSetAdmission<Snapshot>>;
    /** Recovery must prove all resulting URLs and retire-only application changes. */
    validateAdmission(tx: Transaction, admission: ReferenceSetAdmission<Snapshot>, published?: Readonly<Record<string, string>>): Promise<void>;
    retirements?(snapshot: Snapshot): ReadonlyArray<{
        consumer: string;
        previousReference: string;
    }>;
    /** Outside transaction retries, after a confirmed upload and before any publication. */
    verifyArtifact?(artifact: {
        name: string;
        operationId: string;
        reference: string;
        target: PreparedStorageReference['target'];
        descriptor: StorageCleanupDescriptor;
    }, signal: AbortSignal): Promise<void>;
    commit(tx: Transaction, published: Readonly<Record<string, string>>, snapshot: Snapshot): Promise<void>;
}
/** Own all streams from entry. Publish distinct assets and retirements in one reference transaction. */
declare function writeReferenceSet<Transaction, Snapshot>(options: ReferenceSetOptions<Transaction, Snapshot>): Promise<Readonly<Record<string, string>>>;

declare const inputSchema: z.ZodObject<{
    operationId: z.ZodUUID;
    sourceAssetId: z.ZodString;
    destinationAssetId: z.ZodString;
    consumers: z.ZodArray<z.ZodString>;
    sourceRead: z.ZodObject<{
        sha256: z.ZodString;
        bytes: z.ZodNumber;
        assetId: z.ZodString;
    }, z.core.$strict>;
    destinationRead: z.ZodObject<{
        sha256: z.ZodString;
        bytes: z.ZodNumber;
        assetId: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
type StorageRelocationInput = z.infer<typeof inputSchema>;
/**
 * Caller-owned Serializable transactions. Only a migration copy orchestrator may
 * record receipts, after hashing source bytes and independent destination readback.
 * Supplied evidence is trusted caller testimony, not a cryptographic attestation.
 * Retain receipts and source attribution with their owning storage scopes.
 */
declare class StorageRelocationRegistry {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly prefix;
    private readonly references;
    private readonly writes;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private receipt;
    private allocation;
    private successor;
    private scopePrefix;
    private remove;
    /** Retain cleanup dependencies and erase one bounded page in the caller's Serializable transaction. */
    eraseForSubject(input: {
        subjectId: string;
        generation: number;
        jobId: string;
        epoch: number;
        after?: string | null;
    }): Promise<{
        erased: number;
        cursor: string | null;
    }>;
    /** Bounded discovery remains available after tombstoning for the owning erasure workflow. */
    listForSubject(subjectId: string, after?: string | null): Promise<{
        receipts: {
            schemaVersion: 1;
            kind: "storage_relocation";
            namespace: string;
            operationId: string;
            sourceAssetId: string;
            destinationAssetId: string;
            consumers: string[];
            content: {
                sha256: string;
                bytes: number;
            };
            scopes: {
                subjectId: string;
                generation: number;
            }[];
        }[];
        cursor: string | null;
    }>;
    private validate;
    record(input: StorageRelocationInput): Promise<void>;
    /** Ordinary replacements have no relocation edge and never prove equivalent content. */
    resolve(input: {
        consumer: string;
        originalReference: string;
        currentReference: string;
        /** Explicit caller policy. Exceeding it rejects proof rather than accepting a partial chain. */
        maxHops: number;
        signal?: AbortSignal;
        /** Require this exact validated copy operation on the traversed chain. */
        requiredOperation?: {
            operationId: string;
            sourceAssetId: string;
            destinationAssetId: string;
        };
    }): Promise<{
        originalAssetId: string;
        current: {
            assetId: string;
            prepared: {
                namespace: string;
                operationId: string;
                reference: string;
                target: {
                    backendId: string;
                    binding: string;
                    key: string;
                };
                scopes: {
                    subjectId: string;
                    generation: number;
                }[];
                localRoutePrefix?: string | undefined;
            };
            backend: {
                schemaVersion: 1;
                kind: "storage_backend";
                namespace: string;
                id: string;
                binding: string;
                descriptor: {
                    kind: "local";
                    identity: {
                        root: string;
                        device: string;
                        inode: string;
                        binding: string;
                    };
                    referenceRoot: string;
                } | {
                    kind: "object";
                    location: {
                        kind: "object";
                        endpoint: string;
                        bucket: string;
                    };
                    binding: string;
                    access: {
                        provider: string;
                        credentialRevision: string;
                        signingRegion: string;
                    } | null;
                    publicUrl: string | null;
                    referenceEncoding: "raw" | "percent";
                };
            };
        };
        content: {
            sha256: string;
            bytes: number;
        } | null;
    } | null>;
}

interface LocalCleanupIdentity {
    root: string;
    device: string;
    inode: string;
    binding: string;
}
/**
 * For application-owned directories with trusted filesystem writers. Checks reject
 * symlinks, but cannot prevent a hostile local process racing filesystem operations.
 */
declare class LocalStorageCleanup {
    readonly identity: Readonly<LocalCleanupIdentity>;
    private activeListings;
    private activeDeletions;
    private constructor();
    static capture(root: string): Promise<LocalStorageCleanup>;
    /** Reopen an outbox location only when the original directory still exists. */
    static restore(identity: LocalCleanupIdentity): Promise<LocalStorageCleanup>;
    private verifyRoot;
    private verifyAbsence;
    /** Stream exact keys under an owned directory prefix without following links. */
    list(prefix: string): AsyncGenerator<string>;
    private listExact;
    private walk;
    /** Verify one exact regular file, including root-level references. */
    has(key: string): Promise<boolean>;
    /** Exact keys only. Missing objects are already deleted; other failures remain visible. */
    delete(key: string): Promise<void>;
    private deleteExact;
}

interface ExecutionLocation {
    locationId: string;
    root: Readonly<LocalCleanupIdentity>;
}
/**
 * Initialize only a newly created private root. Existing roots require their valid
 * inode-bound marker, including after crashes. Trusted filesystem writers required.
 * Initialization is explicit; reads never recreate missing roots or markers.
 */
declare function openExecutionLocation(input: string, options?: {
    create?: boolean;
    signal?: AbortSignal;
}): Promise<ExecutionLocation>;

declare const executionWorkspacePlanSchema: z.ZodObject<{
    locationId: z.ZodUUID;
    executionId: z.ZodUUID;
    root: z.ZodObject<{
        root: z.ZodString;
        device: z.ZodString;
        inode: z.ZodString;
        binding: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const executionWorkspaceSchema: z.ZodObject<{
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
}, z.core.$strict>;
type ExecutionWorkspacePlan = z.infer<typeof executionWorkspacePlanSchema>;
type ExecutionWorkspace = z.infer<typeof executionWorkspaceSchema>;
/** Persist this intent before creating a directory. Location IDs identify an operator-managed filesystem. */
declare function planExecutionWorkspace(root: string, locationId: string, executionId: string): Promise<ExecutionWorkspacePlan>;
/** Existing directories conflict. Persist the returned identity before starting any child work. */
declare function createExecutionWorkspace(input: ExecutionWorkspacePlan): Promise<ExecutionWorkspace>;
/**
 * Recover only an admitted intent whose directory identity was never attached.
 * The caller must first confirm termination of the exact executor and all its I/O.
 * An already attached identity must be used directly, never recaptured through this path.
 */
declare function recoverExecutionWorkspace(input: ExecutionWorkspacePlan, locationId: string): Promise<ExecutionWorkspace | null>;
/**
 * Caller must first establish that the exact executor and all its owned I/O have stopped.
 * Neither a missing directory nor successful removal establishes process termination.
 * Trusted local filesystem writers are required, as for LocalStorageCleanup.
 */
declare function removeExecutionWorkspace(input: ExecutionWorkspace, locationId: string): Promise<void>;

declare class StorageReadCleanupError extends Error {
    constructor(options: ErrorOptions);
}
interface OwnedByteReader {
    read(): Promise<Uint8Array | null>;
    /** Stop pending reads and release the source. May run concurrently with read(). */
    close(): Promise<void>;
}
/** Evidence of copied bytes and confirmed handle closure, not an fsync durability guarantee. */
interface StorageCopyContent {
    sha256: string;
    bytes: number;
}
/**
 * Own acquisition, sequential copying and explicit cleanup. openSource must clean
 * up its own partially acquired resources if it rejects. Failed copies leave
 * partial destination files for the caller. Cleanup timeout means uncertainty,
 * while late acquisitions and writes retain their eventual close continuations.
 */
declare function copyOwnedBytesToFile(options: {
    openSource: () => Promise<OwnedByteReader>;
    destination: string;
    signal?: AbortSignal;
}): Promise<StorageCopyContent>;

/** Captured roots require trusted filesystem writers. Failed copies may leave partial temporary files. */
declare class LocalStorageReader {
    readonly identity: Readonly<LocalCleanupIdentity>;
    private constructor();
    static restore(identity: LocalCleanupIdentity): Promise<LocalStorageReader>;
    copyToFile(key: string, destination: string, signal?: AbortSignal): Promise<StorageCopyContent>;
}

/** Observe every source before dispatch and close all sources concurrently on every exit. */
declare function withOwnedReadables<Result>(streams: readonly Readable[], run: () => Promise<Result>): Promise<Result>;
/**
 * Own the actual Node stream returned by a transport, including late acquisition.
 * Streams must emit close after destruction. Error/close events cannot distinguish
 * every read failure from failed automatic destruction, so ambiguous stream errors
 * retain cleanup uncertainty. A transport needing finer proof should supply an
 * explicit OwnedByteReader to copyOwnedBytesToFile instead.
 */
declare function copyOwnedReadableToFile(options: {
    openSource: () => Promise<Readable>;
    destination: string;
    signal?: AbortSignal;
}): Promise<StorageCopyContent>;

declare class LocalStorageWriteError extends Error {
    readonly created: boolean;
    constructor(created: boolean, cause: unknown);
}
/**
 * Immutable writes in application-owned directories with trusted filesystem writers.
 * Callers persist intents for every erasure scope before I/O. Cleanup tombstones
 * and drains those scopes before deleting; keys must never be reused or adopted unfenced.
 * Failures retain partial files. They never imply permission to restart an operation.
 * The caller owns a supplied stream until the pipeline starts, including destroying
 * it if validation or exclusive creation fails. Pipeline failures destroy the input.
 */
declare class LocalStorageWriter {
    readonly identity: Readonly<LocalCleanupIdentity>;
    private constructor();
    static restore(identity: LocalCleanupIdentity): Promise<LocalStorageWriter>;
    private verifyRoot;
    private parentFor;
    writeImmutable(key: string, body: Uint8Array | Readable, signal?: AbortSignal): Promise<void>;
}

declare const cleanupTargetInput: z.ZodObject<{
    backendId: z.ZodString;
    binding: z.ZodString;
    key: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strict>;
declare const cleanupCollector: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        references: "references";
        inventory: "inventory";
    }>;
    backendIds: z.ZodArray<z.ZodString>;
    scope: z.ZodString;
    match: z.ZodDefault<z.ZodEnum<{
        prefix: "prefix";
        key: "key";
    }>>;
}, z.core.$strict>;
declare const cleanupCollectorRecord: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<{
        references: "references";
        inventory: "inventory";
    }>;
    backendIds: z.ZodArray<z.ZodString>;
    scope: z.ZodString;
    match: z.ZodDefault<z.ZodEnum<{
        prefix: "prefix";
        key: "key";
    }>>;
    namespace: z.ZodString;
    jobId: z.ZodUUID;
    verification: z.ZodNumber;
    cursor: z.ZodNullable<z.ZodString>;
    complete: z.ZodBoolean;
}, z.core.$strict>;
type StorageCleanupCollector = z.input<typeof cleanupCollector>;
type StorageCleanupCollectorRecord = z.infer<typeof cleanupCollectorRecord>;
declare const cleanupJob: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"storage_cleanup">;
    namespace: z.ZodString;
    subjectId: z.ZodString;
    generation: z.ZodNumber;
    id: z.ZodUUID;
    createdAt: z.ZodNumber;
    epoch: z.ZodNumber;
    phase: z.ZodEnum<{
        complete: "complete";
        preparing: "preparing";
        waiting: "waiting";
        collecting: "collecting";
        ready: "ready";
        deleting: "deleting";
        verifying: "verifying";
    }>;
    drainCursor: z.ZodNullable<z.ZodString>;
    pending: z.ZodNumber;
    deleted: z.ZodNumber;
    verification: z.ZodNumber;
    collectorCount: z.ZodNumber;
    inventoryCount: z.ZodNumber;
    remainingCollectors: z.ZodNumber;
    manifestCount: z.ZodDefault<z.ZodNumber>;
    unresolvedManifests: z.ZodDefault<z.ZodNumber>;
    retentionPolicy: z.ZodOptional<z.ZodLiteral<"job-id-snapshots-v1">>;
}, z.core.$strict>;
declare const cleanupTarget: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    namespace: z.ZodString;
    jobId: z.ZodUUID;
    id: z.ZodString;
    binding: z.ZodString;
    key: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    backendIds: z.ZodArray<z.ZodString>;
    status: z.ZodEnum<{
        pending: "pending";
        deleted: "deleted";
    }>;
}, z.core.$strict>;
type StorageCleanupJob = z.infer<typeof cleanupJob>;
type StorageCleanupTarget = z.infer<typeof cleanupTarget>;
type StorageCleanupTargetInput = z.infer<typeof cleanupTargetInput>;
interface StorageDeletionTicket {
    jobId: string;
    epoch: number;
    target: StorageCleanupTarget;
    revision: string;
}
/** Prepare once before retrying the caller's transaction. Scopes must remain immutable. */
declare function prepareStorageCleanup(input: {
    namespace: string;
    subjectId: string;
    generation: number;
    retentionPolicy?: 'job-id-snapshots-v1';
}): StorageCleanupJob;

declare const json: z.ZodJSONSchema;
type Json = z.infer<typeof json>;
declare const MANIFEST_LIMIT_ERROR: unique symbol;
declare class StorageManifestLimitError extends Error {
    readonly [MANIFEST_LIMIT_ERROR] = true;
    constructor();
}
declare function isStorageManifestLimitError(error: unknown): error is StorageManifestLimitError;
declare const manifestResolution: z.ZodObject<{
    resolver: z.ZodString;
    entries: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        index: z.ZodNumber;
        kind: z.ZodLiteral<"storage">;
        targets: z.ZodArray<z.ZodObject<{
            backendId: z.ZodString;
            binding: z.ZodString;
            key: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
        }, z.core.$strict>>;
        collectorIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strict>, z.ZodObject<{
        index: z.ZodNumber;
        kind: z.ZodLiteral<"non_storage">;
        reason: z.ZodString;
    }, z.core.$strict>], "kind">>;
}, z.core.$strict>;
type StorageManifestResolution = z.infer<typeof manifestResolution>;
declare const manifestInput: z.ZodObject<{
    id: z.ZodString;
    entries: z.ZodArray<z.ZodJSONSchema>;
}, z.core.$strict>;
type StorageManifestInput = z.infer<typeof manifestInput>;
/** Consume in the caller's snapshot transaction. A later oversized entry must roll back all pages. */
declare function prepareStorageManifestPages(groupId: string, input: Iterable<Json>): Generator<StorageManifestInput>;

/**
 * Every call belongs to a caller-owned Serializable transaction. This journal never runs I/O.
 * Workers must serialize discovery/deletion on a pinned, dedicated backend lock connection.
 * Lock loss stops new I/O. Immutable, never-reused keys and excluded writers make an older
 * outstanding delete safe. Reference creation must share this exclusion protocol.
 */
declare class StorageCleanupJournal {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly namespaceHash;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private jobId;
    private targetPrefix;
    private targetId;
    private backend;
    private readOptional;
    private read;
    private save;
    private collectors;
    private manifests;
    private registry;
    private writes;
    private validateBackend;
    private validateTarget;
    get(id: string): Promise<StorageCleanupJob>;
    /** Missing is distinct from malformed state or a failed database read. */
    find(id: string): Promise<StorageCleanupJob | null>;
    /** A single bounded page. Public cursors contain only the last validated job UUID. */
    listJobs(after?: string | null): Promise<{
        jobs: {
            schemaVersion: 1;
            kind: "storage_cleanup";
            namespace: string;
            subjectId: string;
            generation: number;
            id: string;
            createdAt: number;
            epoch: number;
            phase: "complete" | "preparing" | "waiting" | "collecting" | "ready" | "deleting" | "verifying";
            drainCursor: string | null;
            pending: number;
            deleted: number;
            verification: number;
            collectorCount: number;
            inventoryCount: number;
            remainingCollectors: number;
            manifestCount: number;
            unresolvedManifests: number;
            retentionPolicy?: "job-id-snapshots-v1" | undefined;
        }[];
        cursor: string | null;
    }>;
    manifestStatus(id: string, pageId: string): Promise<{
        resolved: boolean;
    } | null>;
    /** Commit with authority removal and reference collection, before application cascades erase references. */
    createJob(prepared: StorageCleanupJob): Promise<void>;
    /** Register bounded pages before freezing the scope set. No fixed limit on a job's scopes. */
    registerCollectors(id: string, epoch: number, collectors: StorageCleanupCollector[]): Promise<StorageCleanupJob>;
    listCollectors(id: string, after?: string | null): Promise<{
        collectors: {
            id: string;
            kind: "references" | "inventory";
            backendIds: string[];
            scope: string;
            match: "prefix" | "key";
            namespace: string;
            jobId: string;
            verification: number;
            cursor: string | null;
            complete: boolean;
        }[];
        cursor: string | null;
    }>;
    /** Persist raw pre-cascade references. Unknown attribution remains unresolved and prevents cleanup. */
    recordManifestPage(id: string, epoch: number, input: StorageManifestInput): Promise<StorageCleanupJob>;
    listManifests(id: string, after?: string | null): Promise<{
        pages: {
            id: string;
            entries: z.core.util.JSONType[];
            schemaVersion: 1;
            kind: "storage_cleanup_manifest";
            namespace: string;
            jobId: string;
            digest: string;
            resolution: {
                resolver: string;
                entries: ({
                    index: number;
                    kind: "storage";
                    targets: {
                        backendId: string;
                        binding: string;
                        key: string;
                    }[];
                    collectorIds?: string[] | undefined;
                } | {
                    index: number;
                    kind: "non_storage";
                    reason: string;
                })[];
            } | null;
        }[];
        cursor: string | null;
    }>;
    /**
     * The app proves ownership and classifies every raw entry. This transaction persists exact
     * targets under registered verification inventories together with immutable resolution provenance.
     * A non-storage classification must carry an explicit reason; unknown attribution is not one.
     */
    resolveManifest(id: string, epoch: number, pageId: string, input: StorageManifestResolution): Promise<StorageCleanupJob>;
    /** Stop the previous iterator and all page processing first. A new iterator restarts from the beginning. */
    restartCollector(id: string, epoch: number, collectorId: string): Promise<void>;
    private addTarget;
    /** No elapsed-time shortcut: active and uncertain writes keep the job waiting. */
    recordDrainedIntents(id: string, epoch: number, after: string | null): Promise<StorageCleanupJob>;
    /** Inventory starts after drain. Reference snapshots may be saved with the initial deletion transaction. */
    recordCollectorPage(input: {
        jobId: string;
        epoch: number;
        collectorId: string;
        after: string | null;
        next: string | null;
        targets: StorageCleanupTargetInput[];
    }): Promise<StorageCleanupJob>;
    /** Each phase change invalidates deletion tickets from previous passes. */
    transition(id: string, epoch: number): Promise<StorageCleanupJob>;
    beginVerification(id: string, epoch: number): Promise<StorageCleanupJob>;
    /** Cursor advances across all rows, including acknowledged targets, to bound each database read. */
    pendingTargets(id: string, epoch: number, after?: string | null): Promise<{
        tickets: StorageDeletionTicket[];
        cursor: string | null;
    }>;
    /** Call only after observed successful deletion, while retaining backend ownership. */
    acknowledgeTarget(ticket: StorageDeletionTicket): Promise<void>;
}

/** Read-only classification of persisted cleanup evidence. Does not authorize external deletion. */
declare class StorageCleanupAttribution {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    inspectPage(input: {
        jobId: string;
        epoch: number;
        subjectId: string;
        generation: number;
        pageId: string;
    }): Promise<{
        pageId: string;
        entries: ({
            index: number;
            status: "unresolved";
            reason: "missing_attribution";
            target?: undefined;
            backend?: undefined;
        } | {
            index: number;
            status: "unresolved";
            reason: "unsupported_entry";
            target?: undefined;
            backend?: undefined;
        } | {
            index: number;
            status: "unresolved";
            reason: "live_consumers";
            target?: undefined;
            backend?: undefined;
        } | {
            index: number;
            status: "attributed";
            target: {
                backendId: string;
                binding: string;
                key: string;
            };
            backend: {
                schemaVersion: 1;
                kind: "storage_backend";
                namespace: string;
                id: string;
                binding: string;
                descriptor: {
                    kind: "local";
                    identity: {
                        root: string;
                        device: string;
                        inode: string;
                        binding: string;
                    };
                    referenceRoot: string;
                } | {
                    kind: "object";
                    location: {
                        kind: "object";
                        endpoint: string;
                        bucket: string;
                    };
                    binding: string;
                    access: {
                        provider: string;
                        credentialRevision: string;
                        signingRegion: string;
                    } | null;
                    publicUrl: string | null;
                    referenceEncoding: "raw" | "percent";
                };
            };
            reason?: undefined;
        })[];
    }>;
}

interface DedicatedBackendConnection extends SqlExecutor {
    /** Report errors and unexpected closure, including an already-failed session immediately. */
    onLoss(listener: (error: Error) => void): () => void;
    /** Confirm session termination. Bound failure explicitly; never return this session to a pool. */
    close(): Promise<void>;
}
interface BackendLock {
    readonly signal: AbortSignal;
    assertHeld(): void;
    /** Release only after dispatched I/O settles or durable uncertainty blocks its successor. */
    release(): Promise<void>;
}
/**
 * Acquire a PostgreSQL session lock on a newly owned dedicated connection.
 * This lock does not replace the cleanup execution journal or remote settlement evidence.
 * The acquisition signal stops admission only. Cleanup owns an independent lifetime.
 * The adapter must bound opening, queries and closure, retaining an error listener until closed.
 */
declare function acquirePostgresBackendLock(options: {
    namespace: string;
    binding: string;
    signal?: AbortSignal;
    openConnection(): Promise<DedicatedBackendConnection>;
}): Promise<BackendLock>;

interface PostgresClientPort extends SqlExecutor {
    connect(): Promise<void>;
    end(): Promise<void>;
    onError(listener: (error: Error) => void): () => void;
    onEnd(listener: () => void): () => void;
}
declare class PostgresConnectionCleanupError extends Error {
    constructor(options?: ErrorOptions);
}
/** Own an unused dedicated client. Never retry queries or return this client to a pool. */
declare function openPostgresDedicatedConnection(client: PostgresClientPort, timeouts: {
    connectMs: number;
    queryMs: number;
    closeMs: number;
}): Promise<DedicatedBackendConnection>;

declare const bindingSchema: z.ZodObject<{
    executionId: z.ZodUUID;
    executorId: z.ZodUUID;
    jobId: z.ZodUUID;
    backendBinding: z.ZodString;
}, z.core.$strict>;
declare const evidenceSchema$1: z.ZodObject<{
    id: z.ZodUUID;
    kind: z.ZodEnum<{
        "remote-operations-settled": "remote-operations-settled";
        "stopped-before-dispatch": "stopped-before-dispatch";
    }>;
}, z.core.$strict>;
declare const recordSchema: z.ZodObject<{
    executionId: z.ZodUUID;
    executorId: z.ZodUUID;
    jobId: z.ZodUUID;
    backendBinding: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        settled: "settled";
        unconfirmed: "unconfirmed";
    }>;
    resolution: z.ZodOptional<z.ZodObject<{
        id: z.ZodUUID;
        kind: z.ZodEnum<{
            "remote-operations-settled": "remote-operations-settled";
            "stopped-before-dispatch": "stopped-before-dispatch";
        }>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type CleanupExecutionBinding = z.infer<typeof bindingSchema>;
type CleanupExecutionRecord = z.infer<typeof recordSchema>;
type CleanupExecutionEvidence = z.infer<typeof evidenceSchema$1>;
/**
 * Compose with a dedicated backend lock and caller-owned Serializable transactions.
 * Neither lock loss nor elapsed time clears a gate. Retain all execution allocations.
 */
declare class CleanupExecutionJournal {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private execution;
    private gate;
    read(input: CleanupExecutionBinding): Promise<CleanupExecutionRecord | null>;
    assertOwned(input: CleanupExecutionBinding): Promise<void>;
    /** Read the execution holding a physical backend gate, including unresolved recovery state. */
    current(backendBinding: string): Promise<CleanupExecutionRecord | null>;
    /** Check ownership and persist observed deletion in this same Serializable transaction. */
    acknowledgeTarget(input: CleanupExecutionBinding, ticket: StorageDeletionTicket): Promise<void>;
    /** All registered backend destinations must have active ownership before a phase can advance. */
    transition(jobId: string, epoch: number, inputs: readonly CleanupExecutionBinding[]): Promise<{
        schemaVersion: 1;
        kind: "storage_cleanup";
        namespace: string;
        subjectId: string;
        generation: number;
        id: string;
        createdAt: number;
        epoch: number;
        phase: "complete" | "preparing" | "waiting" | "collecting" | "ready" | "deleting" | "verifying";
        drainCursor: string | null;
        pending: number;
        deleted: number;
        verification: number;
        collectorCount: number;
        inventoryCount: number;
        remainingCollectors: number;
        manifestCount: number;
        unresolvedManifests: number;
        retentionPolicy?: "job-id-snapshots-v1" | undefined;
    }>;
    /** Repeated admission recovers ownership only. It never authorizes repeating external I/O. */
    begin(input: CleanupExecutionBinding): Promise<CleanupExecutionRecord>;
    private update;
    markUnconfirmed(binding: CleanupExecutionBinding): Promise<void>;
    /** Original executor observed every dispatched operation settle, including after uncertainty. */
    settle(binding: CleanupExecutionBinding): Promise<void>;
    /** Caller authorizes and persists exact remote-operation evidence. Process death alone is insufficient. */
    resolveUnconfirmed(binding: CleanupExecutionBinding, evidence: CleanupExecutionEvidence): Promise<void>;
}

interface ProbeCleanupOptions<Transaction> {
    namespace: string;
    dialect: 'postgres' | 'sqlite';
    jobId: string;
    subjectId: string;
    target: StorageCleanupTargetInput;
    execution: CleanupExecutionBinding;
    transaction<Result>(run: (tx: Transaction) => Promise<Result>): Promise<Result>;
    executor(tx: Transaction): SqlExecutor;
    /**
     * Ports retain exclusive ownership of the captured destination throughout this call.
     * They must bound their I/O lifecycle and surface uncertain cleanup on expiry.
     */
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
}
/**
 * Resume one admitted probe's cleanup. Caller cancellation never interrupts cleanup.
 * Active or uncertain uploads remain blocked by the journal's drain proof.
 * A failed transaction or external operation leaves the durable job available for recovery.
 * An existing completed receipt is recovery evidence, not a fresh readiness measurement.
 */
declare function cleanupStorageProbe<Transaction>(input: ProbeCleanupOptions<Transaction>): Promise<void>;

interface StorageCleanupCollectionPage {
    targets: StorageCleanupTargetInput[];
    next: string | null;
}
interface StorageCleanupBackendPort {
    backendId: string;
    binding: string;
    collect(collector: StorageCleanupCollectorRecord, signal: AbortSignal): Promise<StorageCleanupCollectionPage>;
    delete(key: string, signal: AbortSignal): Promise<void>;
}
interface StorageCleanupRunnerOptions<Transaction> {
    namespace: string;
    dialect: 'postgres' | 'sqlite';
    jobId: string;
    executorId?: string;
    signal?: AbortSignal;
    transaction<Result>(run: (transaction: Transaction) => Promise<Result>): Promise<Result>;
    executor(transaction: Transaction): SqlExecutor;
    ports: readonly StorageCleanupBackendPort[];
}
/**
 * Resume one fully admitted cleanup while the caller retains exclusive locks for every binding.
 * Any failed external operation leaves its execution unresolved, so a successor cannot guess
 * whether a delete reached the backend.
 */
declare function runStorageCleanup<Transaction>(input: StorageCleanupRunnerOptions<Transaction>): Promise<void>;

interface StorageProbePort extends ReferenceSetWriter {
    /** Exact captured destination. Cleanup operations must bound their own I/O lifecycle. */
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
}
interface StorageProbeOptions<Transaction, Snapshot> {
    namespace: string;
    dialect: 'postgres' | 'sqlite';
    signal: AbortSignal;
    executorId: string;
    transaction<Result>(run: (tx: Transaction) => Promise<Result>): Promise<Result>;
    executor(tx: Transaction): SqlExecutor;
    captureAdmission(tx: Transaction): Promise<ReferenceSetAdmission<Snapshot>>;
    validateAdmission(tx: Transaction, admission: ReferenceSetAdmission<Snapshot>): Promise<void>;
    /** Retain exclusive ownership of this unique probe destination until this operation ends. */
    capturePort(): Promise<StorageProbePort>;
}
/** Journal admission before upload. No failed or ambiguous upload is silently retried. */
declare function runStorageProbe<Transaction, Snapshot>(input: StorageProbeOptions<Transaction, Snapshot>): Promise<{
    cleanupJobId: string;
}>;

/** Probe ownership remains unresolved even when the original transport error looks ordinary. */
declare class StorageProbeCleanupError extends AggregateError {
    readonly cleanupJobId: string;
    constructor(cleanupJobId: string, errors: readonly unknown[], message: string);
}

type StorageBackendLocation = {
    kind: 'local';
    root: string;
} | {
    kind: 'object';
    endpoint: string;
    bucket: string;
};
interface StorageReferenceOptions {
    localRoutePrefix?: string;
    publicUrl?: string;
    /** Select the encoding used by the application when it creates public object URLs. */
    publicUrlEncoding?: 'raw' | 'percent';
}
declare class StorageReferenceError extends Error {
    constructor();
}
/** Validate an exact raw key without interpreting it as a URL or decoding percent signs. */
declare function validateStorageKey(value: string): string;
/** Physical location only. Public URL aliases and credentials never enter this binding. */
declare function storageBackendBinding(backend: StorageBackendLocation): string;
/**
 * Convert an attributed reference to an exact key. This is not ownership proof.
 * Local executors must additionally prevent symlink traversal and bind the real root.
 */
declare function normalizeStorageReference(backend: StorageBackendLocation, reference: string, options?: StorageReferenceOptions): string;

interface MultipartCleanupPage {
    entries: ReadonlyArray<{
        key: string | undefined;
        uploadId: string | undefined;
    }>;
    isTruncated: boolean;
    nextKey?: string;
    nextUploadId?: string;
}
interface MultipartCleanupPort {
    listMultipart(prefix: string, keyMarker: string | undefined, uploadIdMarker: string | undefined, limit: number, signal?: AbortSignal): Promise<MultipartCleanupPage>;
    /** Already absent is success. Every other service failure must propagate. */
    abortMultipart(key: string, uploadId: string, signal?: AbortSignal): Promise<void>;
}

interface ObjectCleanupPage {
    entries: ReadonlyArray<{
        key: string | undefined;
    }>;
    isTruncated: boolean;
    nextToken?: string;
}
interface ObjectVersionCleanupPage {
    /** Includes deletion markers. Entries use the service's lexicographic prefix ordering. */
    entries: ReadonlyArray<{
        key: string | undefined;
        versionId: string | undefined;
    }>;
    isTruncated: boolean;
    nextKey?: string;
    nextVersion?: string;
}
type ObjectCleanupPort = {
    kind: 'unversioned';
    listObjects(prefix: string, token: string | undefined, limit: number, signal?: AbortSignal): Promise<ObjectCleanupPage>;
    deleteObject(key: string, signal?: AbortSignal): Promise<void>;
} | {
    kind: 'versioned';
    listVersions(prefix: string, keyMarker: string | undefined, versionMarker: string | undefined, limit: number, signal?: AbortSignal): Promise<ObjectVersionCleanupPage>;
    deleteVersion(key: string, versionId: string, signal?: AbortSignal): Promise<void>;
};
/** The injected port must already address the captured location. Core never selects credentials or endpoints. */
declare class ObjectStorageCleanup {
    readonly location: Readonly<Extract<StorageBackendLocation, {
        kind: 'object';
    }>>;
    readonly binding: string;
    readonly publicUrl: string | null;
    readonly publicUrlEncoding: 'raw' | 'percent';
    private readonly port;
    private readonly maxDeletePages;
    private readonly multipart;
    private activeListings;
    private activeDeletions;
    constructor(options: {
        location: Extract<StorageBackendLocation, {
            kind: 'object';
        }>;
        publicUrl?: string | null;
        publicUrlEncoding?: 'raw' | 'percent';
        port: ObjectCleanupPort;
        multipart: MultipartCleanupPort;
        maxDeletePages?: number;
    });
    normalize(reference: string): string;
    /** Finish and persist discovery before deleting. Separate instances require caller coordination. */
    list(prefix: string, signal?: AbortSignal): AsyncGenerator<string>;
    /** Exact-key verification includes retained versions and deletion markers, even without a live object. */
    has(key: string, signal?: AbortSignal): Promise<boolean>;
    private scan;
    private listedKey;
    private listVersions;
    /** Caller establishes ownership and drains writers before invoking deletion. */
    delete(key: string, signal?: AbortSignal): Promise<void>;
    private deleteExact;
}

declare const evidenceSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        observed_io_completion: "observed_io_completion";
        stopped_writer: "stopped_writer";
    }>;
    id: z.ZodString;
}, z.core.$strict>;
declare const intentSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"write">;
    namespace: z.ZodString;
    subjectId: z.ZodString;
    generation: z.ZodNumber;
    operationId: z.ZodUUID;
    createdAt: z.ZodNumber;
    target: z.ZodObject<{
        backendId: z.ZodString;
        binding: z.ZodString;
        key: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    }, z.core.$strict>;
    status: z.ZodEnum<{
        active: "active";
        settled: "settled";
        uncertain: "uncertain";
    }>;
    outcome: z.ZodOptional<z.ZodEnum<{
        uncertain: "uncertain";
        referenced: "referenced";
        unreferenced: "unreferenced";
    }>>;
    resolution: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<{
            observed_io_completion: "observed_io_completion";
            stopped_writer: "stopped_writer";
        }>;
        id: z.ZodString;
    }, z.core.$strict>>;
}, z.core.$strict>;
declare const tombstoneSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    kind: z.ZodLiteral<"tombstone">;
    namespace: z.ZodString;
    subjectId: z.ZodString;
    generation: z.ZodNumber;
    jobId: z.ZodUUID;
    createdAt: z.ZodNumber;
}, z.core.$strict>;
type StorageWriteIntent = z.infer<typeof intentSchema>;
type StorageSubjectTombstone = z.infer<typeof tombstoneSchema>;
/** Prepare once before a retryable transaction. The binding must reference a persisted backend descriptor. */
declare function prepareStorageWrite(input: {
    namespace: string;
    subjectId: string;
    generation: number;
    target: {
        backendId: string;
        binding: string;
        key: string;
    };
}): StorageWriteIntent;
/** Subject IDs are never reused after erasure, including at a later generation. */
declare function prepareStorageTombstone(input: {
    namespace: string;
    subjectId: string;
    generation: number;
    jobId: string;
}): StorageSubjectTombstone;
/**
 * Every method runs in the caller's Serializable transaction. The caller must validate
 * live subject authority/generation in that same transaction. No storage I/O belongs here.
 * PostgreSQL installations need the documented pattern index for bounded prefix scans.
 */
declare class StorageWriteJournal {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly namespaceHash;
    private readonly backendBindings;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string);
    private parameter;
    private tombstoneId;
    private writePrefix;
    private writeId;
    private receiptId;
    private readReceipt;
    /** Read in the caller's transaction when reconciling an unknown reference commit. */
    completion(prepared: StorageWriteIntent): Promise<'referenced' | 'not_created' | null>;
    private backend;
    private validateIntent;
    private validateTarget;
    tombstone(subjectId: string): Promise<StorageSubjectTombstone | null>;
    forbidWrites(prepared: StorageSubjectTombstone): Promise<void>;
    /**
     * Check each scope before committing references in the same Serializable transaction.
     * This read-only check does not authorize I/O or replace begin's replay protection.
     * Callers still validate parent existence and ownership in that transaction.
     */
    assertWritable(prepared: StorageWriteIntent, currentGeneration: number): Promise<void>;
    begin(prepared: StorageWriteIntent, currentGeneration: number): Promise<'created' | 'already_started' | 'already_completed'>;
    /**
     * Only an observed I/O outcome may settle a write, never a heartbeat timeout.
     * not_created requires proof the original admitted operation never created its
     * destination. A failed retry or an ambiguous remote response is insufficient.
     */
    finish(prepared: StorageWriteIntent, outcome: {
        kind: 'referenced';
        currentGeneration: number;
    } | {
        kind: 'unreferenced' | 'uncertain' | 'not_created';
    }): Promise<'removed' | 'retained'>;
    /** Caller must authorize and persist evidence of observed completion or a stopped writer. Never infer it from time. */
    resolveUncertain(prepared: StorageWriteIntent, evidence: z.infer<typeof evidenceSchema>): Promise<void>;
    list(subjectId: string, options?: {
        after?: string;
        limit?: number;
    }): Promise<{
        intents: StorageWriteIntent[];
        cursor: string | null;
    }>;
}

interface FileLockOptions {
    mode?: 'shared' | 'exclusive';
    timeoutMs?: number;
    signal?: AbortSignal;
}
declare class FileLockBusyError extends Error {
    readonly code = "lock_busy";
    constructor();
}
/** Short synchronous commits only. Never wait on a lock while blocking the event loop. */
declare function withSharedFileLockSync<Result>(path: string, operation: () => Result & (Result extends PromiseLike<unknown> ? never : unknown)): Result;
/** Acquire immediately or fail with retryable contention. Always release in finally. */
declare function acquireFileLockSync(path: string, mode?: 'shared' | 'exclusive'): () => void;
/** The anchor must remain at a stable path outside any directory protected from deletion. */
declare function acquireFileLock(path: string, options?: FileLockOptions): Promise<() => Promise<void>>;
declare function withFileLock<Result>(path: string, operation: () => Result | Promise<Result>, options?: FileLockOptions): Promise<Result>;

/** Flush directory-entry changes before declaring a rename or deletion durable. */
declare function syncDirectory(path: string): void;

/** Transactions serialize reads and writes; callbacks must be synchronous and side-effect free. */
interface StateStore<State> {
    read(): Promise<State>;
    transact<Result>(operation: (state: State) => Result): Promise<Result>;
}
interface FileStoreOptions<State> {
    path: string;
    initial: () => State;
    parse: (value: unknown) => State;
}
/** Files are authoritative. Invalid existing data always fails closed. */
declare class FileStateStore<State> implements StateStore<State> {
    private readonly options;
    private readonly path;
    constructor(options: FileStoreOptions<State>);
    read(): Promise<State>;
    transact<Result>(operation: (state: State) => Result): Promise<Result>;
    private persist;
}

export { type StorageCleanupCollector as $, type AtomicStateBackend as A, type BackendLock as B, type CleanupExecutionBinding as C, type DedicatedBackendConnection as D, type ExecutionWorkspacePlan as E, FileLockBusyError as F, type ObjectVersionCleanupPage as G, type OwnedByteReader as H, PostgresConnectionCleanupError as I, type PreparedStorageBackend as J, type PreparedStorageReference as K, type LocalCleanupIdentity as L, type MultipartCleanupPage as M, type ProbeCleanupOptions as N, type OptimisticOptions as O, type PostgresClientPort as P, type ReferenceSetArtifact as Q, type ReferenceSetAdmission as R, type StateStore as S, ReferenceSetError as T, type ReferenceSetOptions as U, type ReferenceSetWriter as V, type StorageBackendLocation as W, StorageBackendRegistry as X, StorageCleanupAttribution as Y, type StorageCleanupBackendPort as Z, type StorageCleanupCollectionPage as _, type SqlExecutor as a, type StorageCleanupCollectorRecord as a0, type StorageCleanupDescriptor as a1, type StorageCleanupJob as a2, StorageCleanupJournal as a3, type StorageCleanupRunnerOptions as a4, type StorageCleanupTarget as a5, type StorageCleanupTargetInput as a6, type StorageCopyContent as a7, type StorageDeletionTicket as a8, type StorageManifestInput as a9, openExecutionLocation as aA, openPostgresDedicatedConnection as aB, planExecutionWorkspace as aC, prepareStorageBackend as aD, prepareStorageCleanup as aE, prepareStorageManifestPages as aF, prepareStorageReference as aG, prepareStorageReferenceClaims as aH, prepareStorageTombstone as aI, prepareStorageWrite as aJ, recoverExecutionWorkspace as aK, removeExecutionWorkspace as aL, runStorageCleanup as aM, runStorageProbe as aN, storageBackendBinding as aO, storageCleanupDescriptorSchema as aP, syncDirectory as aQ, validateStorageKey as aR, withFileLock as aS, withOwnedReadables as aT, withSharedFileLockSync as aU, writeReferenceSet as aV, StorageManifestLimitError as aa, type StorageManifestResolution as ab, StorageProbeCleanupError as ac, type StorageProbeOptions as ad, type StorageProbePort as ae, StorageReadCleanupError as af, StorageReferenceConsumerMismatchError as ag, StorageReferenceError as ah, type StorageReferenceOptions as ai, StorageReferenceRegistry as aj, type StorageRelocationInput as ak, StorageRelocationRegistry as al, type StorageSubjectTombstone as am, type StorageWriteIntent as an, StorageWriteJournal as ao, acquireFileLock as ap, acquireFileLockSync as aq, acquirePostgresBackendLock as ar, cleanupStorageProbe as as, copyOwnedBytesToFile as at, copyOwnedReadableToFile as au, createExecutionWorkspace as av, isReferenceSetError as aw, isStorageManifestLimitError as ax, localEncryptionKey as ay, normalizeStorageReference as az, type ExecutionWorkspace as b, OptimisticStateStore as c, type StateSnapshot as d, sqlStateRows as e, StorageInstanceControl as f, type StorageInstanceScope as g, type CleanupExecutionEvidence as h, isSerializationConflict as i, CleanupExecutionJournal as j, type CleanupExecutionRecord as k, type ExecutionLocation as l, type FileLockOptions as m, FileStateStore as n, optionalSqlWrite as o, type FileStoreOptions as p, LocalStorageCleanup as q, retrySerializableTransaction as r, sqlStateBackend as s, LocalStorageReader as t, LocalStorageWriteError as u, LocalStorageWriter as v, type MultipartCleanupPort as w, type ObjectCleanupPage as x, type ObjectCleanupPort as y, ObjectStorageCleanup as z };
