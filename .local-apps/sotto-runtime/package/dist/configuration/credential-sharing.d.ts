import { z } from 'zod';
import { a as SqlExecutor } from '../index-8r2v4WCa.js';
import 'node:stream';

declare const owner: z.ZodObject<{
    subjectId: z.ZodString;
    generation: z.ZodNumber;
}, z.core.$strict>;
declare const slot: z.ZodObject<{
    modality: z.ZodString;
    provider: z.ZodString;
}, z.core.$strict>;
declare const policy: z.ZodObject<{
    owner: z.ZodObject<{
        subjectId: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
    audience: z.ZodLiteral<"household">;
    excludedRecipients: z.ZodArray<z.ZodObject<{
        subjectId: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>>;
    source: z.ZodEnum<{
        explicit: "explicit";
        imported: "imported";
    }>;
}, z.core.$strict>;
type CredentialSharingSlot = z.infer<typeof slot>;
type CredentialSharingPolicy = z.infer<typeof policy>;
declare class CredentialSharingConflictError extends Error {
    constructor();
}
/**
 * Instance-owned policy, independent of credential rotation and the key owner's role.
 * Callers authorize policy changes and validate owner generation, recipient admission
 * and erasure fences in the same Serializable transaction as credential selection.
 * Retained removed heads prevent delayed changes from resurrecting revoked sharing.
 */
declare class CredentialSharing {
    private readonly database;
    private readonly dialect;
    private readonly namespace;
    private readonly instanceId;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', namespace: string, instanceId: string);
    private id;
    private parse;
    private current;
    head(target: CredentialSharingSlot): Promise<{
        revision: number | null;
        policy: {
            owner: {
                subjectId: string;
                generation: number;
            };
            audience: "household";
            excludedRecipients: {
                subjectId: string;
                generation: number;
            }[];
            source: "explicit" | "imported";
        } | null;
    }>;
    set(target: CredentialSharingSlot, expectedRevision: number | null, value: CredentialSharingPolicy): Promise<number>;
    remove(target: CredentialSharingSlot, expectedRevision: number | null): Promise<number>;
    private write;
    list(after?: string | null, limit?: number): Promise<{
        items: {
            modality: string;
            provider: string;
            revision: number;
            policy: {
                owner: {
                    subjectId: string;
                    generation: number;
                };
                audience: "household";
                excludedRecipients: {
                    subjectId: string;
                    generation: number;
                }[];
                source: "explicit" | "imported";
            };
        }[];
        cursor: string | null;
    }>;
}
/** Requires a validated policy from head/list and canonical household admission. Does not authorize a request. */
declare function householdCredentialRecipient(policy: CredentialSharingPolicy, recipient: z.infer<typeof owner>): boolean;

export { CredentialSharing, CredentialSharingConflictError, type CredentialSharingPolicy, type CredentialSharingSlot, householdCredentialRecipient };
