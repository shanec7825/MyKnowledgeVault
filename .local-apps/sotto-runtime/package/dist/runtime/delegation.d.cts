import { A as AtomicStateBackend } from '../index-8r2v4WCa.cjs';
import { z } from 'zod';
import 'node:stream';

/** Opaque identities only. Applications own current generation and action authorization. */
declare const delegationGrantSchema: z.ZodObject<{
    id: z.ZodUUID;
    revision: z.ZodUUID;
    instanceId: z.ZodUUID;
    subject: z.ZodObject<{
        id: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
    resource: z.ZodObject<{
        id: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
    operationId: z.ZodUUID;
    action: z.ZodString;
    expiresAt: z.ZodNumber;
    maxRequests: z.ZodNumber;
}, z.core.$strict>;
declare const delegationBindingSchema: z.ZodObject<{
    id: z.ZodUUID;
    revision: z.ZodUUID;
    fingerprint: z.ZodString;
}, z.core.$strict>;
declare const delegationAttemptInputSchema: z.ZodObject<{
    id: z.ZodUUID;
    fingerprint: z.ZodString;
}, z.core.$strict>;
declare const delegationOutcomeSchema: z.ZodEnum<{
    succeeded: "succeeded";
    failed: "failed";
    unknown: "unknown";
}>;
declare const delegationAttemptSchema: z.ZodObject<{
    id: z.ZodUUID;
    fingerprint: z.ZodString;
    number: z.ZodNumber;
    admittedAt: z.ZodNumber;
    outcome: z.ZodEnum<{
        admitted: "admitted";
        succeeded: "succeeded";
        failed: "failed";
        unknown: "unknown";
    }>;
    settledAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
declare const delegationActivitySchema: z.ZodObject<{
    sequence: z.ZodNumber;
    at: z.ZodNumber;
    type: z.ZodEnum<{
        revoked: "revoked";
        completed: "completed";
        admitted: "admitted";
        succeeded: "succeeded";
        failed: "failed";
        unknown: "unknown";
        created: "created";
    }>;
    attemptId: z.ZodOptional<z.ZodUUID>;
}, z.core.$strict>;
declare const delegationRecordSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    grant: z.ZodObject<{
        id: z.ZodUUID;
        revision: z.ZodUUID;
        instanceId: z.ZodUUID;
        subject: z.ZodObject<{
            id: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
        resource: z.ZodObject<{
            id: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
        operationId: z.ZodUUID;
        action: z.ZodString;
        expiresAt: z.ZodNumber;
        maxRequests: z.ZodNumber;
    }, z.core.$strict>;
    binding: z.ZodObject<{
        id: z.ZodUUID;
        revision: z.ZodUUID;
        fingerprint: z.ZodString;
    }, z.core.$strict>;
    status: z.ZodEnum<{
        active: "active";
        revoked: "revoked";
        completed: "completed";
    }>;
    attempts: z.ZodArray<z.ZodObject<{
        id: z.ZodUUID;
        fingerprint: z.ZodString;
        number: z.ZodNumber;
        admittedAt: z.ZodNumber;
        outcome: z.ZodEnum<{
            admitted: "admitted";
            succeeded: "succeeded";
            failed: "failed";
            unknown: "unknown";
        }>;
        settledAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    sequence: z.ZodNumber;
    activity: z.ZodArray<z.ZodObject<{
        sequence: z.ZodNumber;
        at: z.ZodNumber;
        type: z.ZodEnum<{
            revoked: "revoked";
            completed: "completed";
            admitted: "admitted";
            succeeded: "succeeded";
            failed: "failed";
            unknown: "unknown";
            created: "created";
        }>;
        attemptId: z.ZodOptional<z.ZodUUID>;
    }, z.core.$strict>>;
}, z.core.$strict>;
type DelegationGrant = z.infer<typeof delegationGrantSchema>;
type DelegationBinding = z.infer<typeof delegationBindingSchema>;
type DelegationAttemptInput = z.infer<typeof delegationAttemptInputSchema>;
type DelegationAttempt = z.infer<typeof delegationAttemptSchema>;
type DelegationOutcome = z.infer<typeof delegationOutcomeSchema>;
type DelegationActivity = z.infer<typeof delegationActivitySchema>;
type DelegationRecord = z.infer<typeof delegationRecordSchema>;

declare class DelegationConflictError extends Error {
    constructor();
}
declare class DelegationDeniedError extends Error {
    readonly code: 'missing' | 'binding' | 'closed' | 'expired' | 'budget' | 'attempt' | 'unsettled';
    constructor(code: 'missing' | 'binding' | 'closed' | 'expired' | 'budget' | 'attempt' | 'unsettled');
}
interface DelegationStoreOptions {
    /** One durable row per grant, bound to the application's existing transaction. */
    backend: AtomicStateBackend;
    /** Revalidate the actor, instance, subject/resource generations and action in that transaction. */
    authorize: (context: {
        operation: 'create' | 'read' | 'validate' | 'admit' | 'settle' | 'revoke' | 'complete';
        grant: DelegationGrant;
    }) => Promise<void>;
    now?: () => number;
}
declare function delegationGrantBinding(input: DelegationGrant): DelegationBinding;
/**
 * This store performs no external effects and never retries transactions internally.
 * Commit admission before dispatch. Replayed admissions never authorize another dispatch.
 * Retain records through the application's replay horizon; deletion permits identity reuse.
 */
declare class DelegationStore {
    private readonly backend;
    private readonly authorize;
    private readonly now;
    constructor(options: DelegationStoreOptions);
    private time;
    private event;
    private parse;
    private owned;
    private active;
    private save;
    create(input: DelegationGrant): Promise<DelegationRecord>;
    read(input: DelegationBinding): Promise<DelegationRecord>;
    /** Check current authority without consuming budget. This alone never admits a dispatch. */
    validate(input: DelegationBinding): Promise<void>;
    /** Each actual HTTP attempt requires a fresh ID and consumes a slot, including retries. */
    admit(input: DelegationBinding, request: DelegationAttemptInput): Promise<{
        dispatch: false;
        attempt: {
            id: string;
            fingerprint: string;
            number: number;
            admittedAt: number;
            outcome: "admitted" | "succeeded" | "failed" | "unknown";
            settledAt?: number | undefined;
        };
    } | {
        dispatch: true;
        attempt: {
            number: number;
            admittedAt: number;
            outcome: "admitted";
            id: string;
            fingerprint: string;
        };
    }>;
    /** Settlement records observations only. It does not refund budget or prove remote exactly-once effects. */
    settle(input: DelegationBinding, request: DelegationAttemptInput, outcomeInput: DelegationOutcome): Promise<{
        id: string;
        fingerprint: string;
        number: number;
        admittedAt: number;
        outcome: "admitted" | "succeeded" | "failed" | "unknown";
        settledAt?: number | undefined;
    }>;
    revoke(input: DelegationBinding): Promise<DelegationRecord>;
    complete(input: DelegationBinding): Promise<DelegationRecord>;
    /** A gap is explicit when retention has removed events after the supplied cursor. */
    activity(input: DelegationBinding, options?: {
        after?: number;
        limit?: number;
    }): Promise<{
        events: {
            sequence: number;
            at: number;
            type: "revoked" | "completed" | "admitted" | "succeeded" | "failed" | "unknown" | "created";
            attemptId?: string | undefined;
        }[];
        truncated: boolean;
        next: number;
        latest: number;
    }>;
}

export { type DelegationActivity, type DelegationAttempt, type DelegationAttemptInput, type DelegationBinding, DelegationConflictError, DelegationDeniedError, type DelegationGrant, type DelegationOutcome, type DelegationRecord, DelegationStore, type DelegationStoreOptions, delegationActivitySchema, delegationAttemptInputSchema, delegationAttemptSchema, delegationBindingSchema, delegationGrantBinding, delegationGrantSchema, delegationOutcomeSchema, delegationRecordSchema };
