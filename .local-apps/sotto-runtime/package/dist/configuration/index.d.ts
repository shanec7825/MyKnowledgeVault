import { z } from 'zod';
import { ProviderDescriptor } from '../ai/browser.js';
import { C as CredentialValues, d as CredentialStore } from '../index-THd9yLQB.js';
import { S as StateStore } from '../index-8r2v4WCa.js';
import 'node:stream';

declare const quarantineSchema: z.ZodObject<{
    sourceFormat: z.ZodString;
    sourceVersion: z.ZodNumber;
    payload: z.ZodString;
    failure: z.ZodEnum<{
        invalid_format: "invalid_format";
        decryption_failed: "decryption_failed";
    }>;
}, z.core.$strict>;
type CredentialQuarantine = z.infer<typeof quarantineSchema>;
declare const credentialStateSchema: z.ZodObject<{
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
type CredentialState = z.infer<typeof credentialStateSchema>;
declare const initialCredentialState: () => CredentialState;
interface CredentialCodecOptions {
    encryptionKey?: Uint8Array | (() => Uint8Array);
    namespace: string;
    descriptors: () => readonly ProviderDescriptor[];
}
interface VaultOptions extends CredentialCodecOptions {
    store: StateStore<CredentialState>;
}
declare class CredentialDecryptionError extends Error {
    readonly provider: string;
    constructor(provider: string);
}
declare class CredentialValidationError extends Error {
    readonly code = "invalid_credentials";
}
declare class CredentialRepairRequiredError extends CredentialDecryptionError {
    readonly code = "credential_repair_required";
}
/** App authorization occurs before mutation. Runtime resolution never returns a different provider. */
declare class CredentialCodec {
    private readonly options;
    constructor(options: CredentialCodecOptions);
    private key;
    private descriptor;
    private storedValues;
    private encrypt;
    private decrypt;
    resolveState(state: CredentialState, provider: string): CredentialValues;
    /** Operator import only. Preserve unreadable input without making it executable. */
    quarantineState(state: CredentialState, provider: string, input: CredentialQuarantine): void;
    /** Operator repair only. The caller must authorize access to the retained secret payload. */
    readQuarantineState(state: CredentialState, provider: string): CredentialQuarantine | null;
    /** Explicit repair. The caller must authorize and fence its revision in the same transaction. */
    replaceState(state: CredentialState, provider: string, values: CredentialValues): void;
    /** Apply within the same transaction as the caller's selection and authorization changes. */
    configureState(state: CredentialState, provider: string, patch: Record<string, string | number | boolean | null>): void;
    /** Explicit authorized removal also works when the old encryption key is unavailable. */
    removeState(state: CredentialState, provider: string): void;
    describeState(state: CredentialState, provider: string): {
        fields: {
            value?: string | number | boolean | undefined;
            configured: boolean;
            source: "stored" | "unset";
            error?: "endpoint_binding_mismatch" | undefined;
            id: string;
        }[];
        error?: "credential_repair_required" | undefined;
        provider: string;
    };
}
/** Store-backed vault for applications that keep credential state in its own store. */
declare class CredentialVault extends CredentialCodec implements CredentialStore {
    private readonly store;
    constructor(options: VaultOptions);
    resolve(provider: string): Promise<CredentialValues>;
    configure(provider: string, patch: Record<string, string | number | boolean | null>): Promise<void>;
    remove(provider: string): Promise<void>;
    describe(provider: string): Promise<{
        fields: {
            value?: string | number | boolean | undefined;
            configured: boolean;
            source: "stored" | "unset";
            error?: "endpoint_binding_mismatch" | undefined;
            id: string;
        }[];
        error?: "credential_repair_required" | undefined;
        provider: string;
    }>;
}

export { CredentialCodec, type CredentialCodecOptions, CredentialDecryptionError, type CredentialQuarantine, CredentialRepairRequiredError, type CredentialState, CredentialValidationError, CredentialVault, type VaultOptions, credentialStateSchema, initialCredentialState };
