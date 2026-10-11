import { z } from 'zod';

declare const credentialEditContextSchema: z.ZodObject<{
    instanceId: z.ZodString;
    scope: z.ZodString;
    owner: z.ZodObject<{
        subjectId: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
}, z.core.$strict>;
declare const credentialSettingsKeySchema: z.ZodObject<{
    provider: z.ZodString;
    revision: z.ZodUUID;
    isValid: z.ZodBoolean;
    verification: z.ZodObject<{
        lastAttempt: z.ZodNullable<z.ZodObject<{
            status: z.ZodEnum<{
                verified: "verified";
                rejected: "rejected";
                inconclusive: "inconclusive";
            }>;
            checkedAt: z.ZodNumber;
        }, z.core.$strip>>;
        lastConfirmed: z.ZodNullable<z.ZodObject<{
            checkedAt: z.ZodNumber;
            status: z.ZodEnum<{
                verified: "verified";
                rejected: "rejected";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
declare const credentialSettingsSnapshotSchema: z.ZodObject<{
    context: z.ZodObject<{
        instanceId: z.ZodString;
        scope: z.ZodString;
        owner: z.ZodObject<{
            subjectId: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    heads: z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUUID>>;
    keys: z.ZodArray<z.ZodObject<{
        provider: z.ZodString;
        revision: z.ZodUUID;
        isValid: z.ZodBoolean;
        verification: z.ZodObject<{
            lastAttempt: z.ZodNullable<z.ZodObject<{
                status: z.ZodEnum<{
                    verified: "verified";
                    rejected: "rejected";
                    inconclusive: "inconclusive";
                }>;
                checkedAt: z.ZodNumber;
            }, z.core.$strip>>;
            lastConfirmed: z.ZodNullable<z.ZodObject<{
                checkedAt: z.ZodNumber;
                status: z.ZodEnum<{
                    verified: "verified";
                    rejected: "rejected";
                }>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
declare const credentialRemovalRequestSchema: z.ZodObject<{
    context: z.ZodObject<{
        instanceId: z.ZodString;
        scope: z.ZodString;
        owner: z.ZodObject<{
            subjectId: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    provider: z.ZodString;
    expectedRevision: z.ZodNullable<z.ZodUUID>;
    operationId: z.ZodUUID;
}, z.core.$strict>;
declare const credentialSaveRequestSchema: z.ZodUnion<readonly [z.ZodObject<{
    context: z.ZodObject<{
        instanceId: z.ZodString;
        scope: z.ZodString;
        owner: z.ZodObject<{
            subjectId: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    provider: z.ZodString;
    expectedRevision: z.ZodNullable<z.ZodUUID>;
    operationId: z.ZodUUID;
    values: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
    allowUnverified: z.ZodBoolean;
}, z.core.$strict>, z.ZodObject<{
    context: z.ZodObject<{
        instanceId: z.ZodString;
        scope: z.ZodString;
        owner: z.ZodObject<{
            subjectId: z.ZodString;
            generation: z.ZodNumber;
        }, z.core.$strict>;
    }, z.core.$strict>;
    provider: z.ZodString;
    expectedRevision: z.ZodNullable<z.ZodUUID>;
    operationId: z.ZodUUID;
    patch: z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
    allowUnverified: z.ZodBoolean;
}, z.core.$strict>]>;
type CredentialEditContext = z.infer<typeof credentialEditContextSchema>;
type CredentialSettingsSnapshot = z.infer<typeof credentialSettingsSnapshotSchema>;
type CredentialSettingsKey = z.infer<typeof credentialSettingsKeySchema>;
type CredentialSaveRequest = z.infer<typeof credentialSaveRequestSchema>;
type CredentialRemovalRequest = z.infer<typeof credentialRemovalRequestSchema>;
type CredentialEdit = {
    values: Record<string, string | number | boolean>;
    patch?: never;
} | {
    values?: never;
    patch: Record<string, string | number | boolean | null>;
};
type CredentialSaveDraft = Readonly<CredentialRemovalRequest & CredentialEdit>;
/** Prepare from displayed state. Changed content always gets a new operation identity. */
declare function prepareCredentialSave(snapshot: CredentialSettingsSnapshot, provider: string, edit: CredentialEdit): CredentialSaveDraft;
/** Confirmation changes only consent. The captured owner, revision and edited values stay fixed. */
declare function credentialSaveRequest(draft: CredentialSaveDraft, allowUnverified?: boolean): CredentialSaveRequest;
declare function prepareCredentialRemoval(snapshot: CredentialSettingsSnapshot, provider: string): Readonly<CredentialRemovalRequest>;
declare function sameCredentialEditContext(left: CredentialEditContext, right: CredentialEditContext): boolean;
/** Reconcile an uncertain response with a fresh authenticated, uncached snapshot. Never resubmits. */
declare function reconcileCredentialMutation(request: CredentialRemovalRequest, value: unknown, kind: 'save' | 'remove'): {
    status: 'confirmed';
    revision: string;
    key: CredentialSettingsKey | null;
} | {
    status: 'context_changed' | 'superseded' | 'unknown';
};

export { type CredentialEdit, type CredentialEditContext, type CredentialRemovalRequest, type CredentialSaveDraft, type CredentialSaveRequest, type CredentialSettingsKey, type CredentialSettingsSnapshot, credentialEditContextSchema, credentialRemovalRequestSchema, credentialSaveRequest, credentialSaveRequestSchema, credentialSettingsKeySchema, credentialSettingsSnapshotSchema, prepareCredentialRemoval, prepareCredentialSave, reconcileCredentialMutation, sameCredentialEditContext };
