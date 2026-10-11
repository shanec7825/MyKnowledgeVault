import { z } from 'zod';
import { CredentialCodecOptions } from './index.cjs';
import { CredentialValidation } from '../ai/browser.cjs';
import { C as CredentialValues } from '../index-BYxnMqfP.cjs';
import { a as SqlExecutor } from '../index-8r2v4WCa.cjs';
import 'node:stream';

declare const ownerSchema: z.ZodObject<{
    subjectId: z.ZodString;
    generation: z.ZodNumber;
}, z.core.$strict>;
declare const bindingSchema: z.ZodObject<{
    protocol: z.ZodString;
    endpoint: z.ZodURL;
}, z.core.$strict>;
declare const metadataSchema: z.ZodObject<{
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    lastUsedAt: z.ZodNullable<z.ZodNumber>;
}, z.core.$strict>;
declare const liveSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    namespace: z.ZodString;
    instanceId: z.ZodUUID;
    owner: z.ZodObject<{
        subjectId: z.ZodString;
        generation: z.ZodNumber;
    }, z.core.$strict>;
    modality: z.ZodString;
    provider: z.ZodString;
    credentialRevision: z.ZodUUID;
    kind: z.ZodLiteral<"owned_credential">;
    credentials: z.ZodObject<{
        version: z.ZodLiteral<2>;
        imports: z.ZodDefault<z.ZodArray<z.ZodString>>;
        providers: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            encrypted: z.ZodNullable<z.ZodString>;
            publicValues: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
            endpointBinding: z.ZodOptional<z.ZodString>;
            updatedAt: z.ZodNumber;
            quarantine: z.ZodOptional<z.ZodObject<{
                sourceFormat: z.ZodString;
                sourceVersion: z.ZodNumber;
                failure: z.ZodEnum<{
                    invalid_format: "invalid_format";
                    decryption_failed: "decryption_failed";
                }>;
                encryptedPayload: z.ZodString;
            }, z.core.$strict>>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
    availability: z.ZodEnum<{
        disabled: "disabled";
        enabled: "enabled";
    }>;
    binding: z.ZodObject<{
        protocol: z.ZodString;
        endpoint: z.ZodURL;
    }, z.core.$strict>;
    verification: z.ZodObject<{
        nextAttempt: z.ZodNumber;
        latestAppliedAttempt: z.ZodNumber;
        lastAttempt: z.ZodNullable<z.ZodObject<{
            attempt: z.ZodNumber;
            status: z.ZodEnum<{
                verified: "verified";
                rejected: "rejected";
                inconclusive: "inconclusive";
            }>;
            checkedAt: z.ZodNumber;
            reason: z.ZodEnum<{
                ready: "ready";
                not_configured: "not_configured";
                missing_credentials: "missing_credentials";
                not_installed: "not_installed";
                not_authenticated: "not_authenticated";
                unreachable: "unreachable";
                missing_model: "missing_model";
                unsupported: "unsupported";
            }>;
        }, z.core.$strict>>;
        lastConfirmed: z.ZodNullable<z.ZodObject<{
            attempt: z.ZodNumber;
            checkedAt: z.ZodNumber;
            reason: z.ZodEnum<{
                ready: "ready";
                not_configured: "not_configured";
                missing_credentials: "missing_credentials";
                not_installed: "not_installed";
                not_authenticated: "not_authenticated";
                unreachable: "unreachable";
                missing_model: "missing_model";
                unsupported: "unsupported";
            }>;
            status: z.ZodEnum<{
                verified: "verified";
                rejected: "rejected";
            }>;
            binding: z.ZodObject<{
                protocol: z.ZodString;
                endpoint: z.ZodURL;
            }, z.core.$strict>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    label: z.ZodNullable<z.ZodString>;
    metadata: z.ZodObject<{
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        lastUsedAt: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strict>;
    operationDigest: z.ZodString;
}, z.core.$strict>;
type LiveRow = z.infer<typeof liveSchema>;
interface OwnedCredentialIdentity {
    owner: z.infer<typeof ownerSchema>;
    modality: string;
    provider: string;
}
interface CredentialVerificationTicket extends OwnedCredentialIdentity {
    credentialRevision: string;
    attempt: number;
    binding: z.infer<typeof bindingSchema>;
}
interface PreparedOwnedCredential {
    expectedHeadRevision: string | null;
    record: LiveRow;
}
declare class OwnedCredentialConflictError extends Error {
    constructor();
}
/** Caller-owned Serializable transactions must include current owner authority and erasure checks. */
declare class OwnedCredentials {
    private readonly database;
    private readonly dialect;
    private readonly options;
    private readonly prefix;
    constructor(database: SqlExecutor, dialect: 'postgres' | 'sqlite', options: {
        namespace: string;
        instanceId: string;
        encryptionKey: CredentialCodecOptions['encryptionKey'];
        descriptors: CredentialCodecOptions['descriptors'];
    });
    private ownerPrefix;
    private id;
    private codec;
    private allocation;
    private allocationBackend;
    private verifyAllocation;
    private allocate;
    private parse;
    private current;
    head(target: OwnedCredentialIdentity): Promise<{
        revision: string | null;
        credential: {
            owner: {
                subjectId: string;
                generation: number;
            };
            modality: string;
            provider: string;
            credentialRevision: string;
            availability: "disabled" | "enabled";
            binding: {
                protocol: string;
                endpoint: string;
            };
            verification: {
                nextAttempt: number;
                latestAppliedAttempt: number;
                lastAttempt: {
                    attempt: number;
                    status: "verified" | "rejected" | "inconclusive";
                    checkedAt: number;
                    reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                } | null;
                lastConfirmed: {
                    attempt: number;
                    checkedAt: number;
                    reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                    status: "verified" | "rejected";
                    binding: {
                        protocol: string;
                        endpoint: string;
                    };
                } | null;
            };
            label: string | null;
            metadata: {
                createdAt: number;
                updatedAt: number;
                lastUsedAt: number | null;
            };
        } | null;
    }>;
    /** Prepare once before transaction retries. The receipt hashes ciphertext, never plaintext secrets. */
    prepareReplacement(target: OwnedCredentialIdentity, input: {
        expectedHeadRevision: string | null;
        credentialRevision: string;
        values: CredentialValues;
        binding: z.infer<typeof bindingSchema>;
        availability: LiveRow['availability'];
        label: string | null;
        metadata: z.infer<typeof metadataSchema>;
        validation?: CredentialValidation;
    }): PreparedOwnedCredential;
    /** Attach a captured probe outcome without encrypting again or changing the operation revision. */
    withValidation(prepared: PreparedOwnedCredential, validation: CredentialValidation): PreparedOwnedCredential;
    replace(prepared: PreparedOwnedCredential): Promise<'applied' | 'replayed'>;
    resolve(target: OwnedCredentialIdentity, expectedRevision?: string): Promise<{
        values: CredentialValues;
        owner: {
            subjectId: string;
            generation: number;
        };
        modality: string;
        provider: string;
        credentialRevision: string;
        availability: "disabled" | "enabled";
        binding: {
            protocol: string;
            endpoint: string;
        };
        verification: {
            nextAttempt: number;
            latestAppliedAttempt: number;
            lastAttempt: {
                attempt: number;
                status: "verified" | "rejected" | "inconclusive";
                checkedAt: number;
                reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
            } | null;
            lastConfirmed: {
                attempt: number;
                checkedAt: number;
                reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                status: "verified" | "rejected";
                binding: {
                    protocol: string;
                    endpoint: string;
                };
            } | null;
        };
        label: string | null;
        metadata: {
            createdAt: number;
            updatedAt: number;
            lastUsedAt: number | null;
        };
    } | null>;
    /** Caller must authorize editing this owner. Reading never enables a disabled credential. */
    readForEdit(target: OwnedCredentialIdentity, expectedRevision: string): Promise<{
        values: CredentialValues;
        owner: {
            subjectId: string;
            generation: number;
        };
        modality: string;
        provider: string;
        credentialRevision: string;
        availability: "disabled" | "enabled";
        binding: {
            protocol: string;
            endpoint: string;
        };
        verification: {
            nextAttempt: number;
            latestAppliedAttempt: number;
            lastAttempt: {
                attempt: number;
                status: "verified" | "rejected" | "inconclusive";
                checkedAt: number;
                reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
            } | null;
            lastConfirmed: {
                attempt: number;
                checkedAt: number;
                reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                status: "verified" | "rejected";
                binding: {
                    protocol: string;
                    endpoint: string;
                };
            } | null;
        };
        label: string | null;
        metadata: {
            createdAt: number;
            updatedAt: number;
            lastUsedAt: number | null;
        };
    }>;
    private decrypted;
    /** Record an initiated external request, even if this revision was subsequently disabled. */
    recordUse(target: OwnedCredentialIdentity, expectedRevision: string, usedAt: number): Promise<'applied' | 'superseded'>;
    beginVerification(target: OwnedCredentialIdentity, expectedRevision: string): Promise<CredentialVerificationTicket | null>;
    finishVerification(ticket: CredentialVerificationTicket, outcome: CredentialValidation): Promise<'applied' | 'superseded'>;
    remove(target: OwnedCredentialIdentity, expectedHeadRevision: string | null, removalRevision: string): Promise<'applied' | 'replayed'>;
    private scan;
    list(after?: string | null, limit?: number): Promise<{
        items: {
            owner: {
                subjectId: string;
                generation: number;
            };
            modality: string;
            provider: string;
            credentialRevision: string;
            availability: "disabled" | "enabled";
            binding: {
                protocol: string;
                endpoint: string;
            };
            verification: {
                nextAttempt: number;
                latestAppliedAttempt: number;
                lastAttempt: {
                    attempt: number;
                    status: "verified" | "rejected" | "inconclusive";
                    checkedAt: number;
                    reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                } | null;
                lastConfirmed: {
                    attempt: number;
                    checkedAt: number;
                    reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                    status: "verified" | "rejected";
                    binding: {
                        protocol: string;
                        endpoint: string;
                    };
                } | null;
            };
            label: string | null;
            metadata: {
                createdAt: number;
                updatedAt: number;
                lastUsedAt: number | null;
            };
        }[];
        cursor: string | null;
    }>;
    listOwner(owner: OwnedCredentialIdentity['owner'], after?: string | null, limit?: number): Promise<{
        items: {
            owner: {
                subjectId: string;
                generation: number;
            };
            modality: string;
            provider: string;
            credentialRevision: string;
            availability: "disabled" | "enabled";
            binding: {
                protocol: string;
                endpoint: string;
            };
            verification: {
                nextAttempt: number;
                latestAppliedAttempt: number;
                lastAttempt: {
                    attempt: number;
                    status: "verified" | "rejected" | "inconclusive";
                    checkedAt: number;
                    reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                } | null;
                lastConfirmed: {
                    attempt: number;
                    checkedAt: number;
                    reason: "ready" | "not_configured" | "missing_credentials" | "not_installed" | "not_authenticated" | "unreachable" | "missing_model" | "unsupported";
                    status: "verified" | "rejected";
                    binding: {
                        protocol: string;
                        endpoint: string;
                    };
                } | null;
            };
            label: string | null;
            metadata: {
                createdAt: number;
                updatedAt: number;
                lastUsedAt: number | null;
            };
        }[];
        cursor: string | null;
    }>;
}

export { type CredentialVerificationTicket, OwnedCredentialConflictError, type OwnedCredentialIdentity, OwnedCredentials, type PreparedOwnedCredential };
