type Capability = 'text' | 'vision' | 'structured' | 'tools' | 'web' | 'speech' | 'transcription';
type ReadinessCode = 'ready' | 'not_configured' | 'missing_credentials' | 'not_installed' | 'not_authenticated' | 'unreachable' | 'missing_model' | 'unsupported';
interface ProviderReadiness {
    code: ReadinessCode;
    checkedAt: number;
    /** A documented authenticated endpoint returned its required proof schema. Connectivity alone is insufficient. */
    authentication?: 'verified';
    action?: 'configure' | 'install' | 'login' | 'select_model' | 'retry';
}
/** Valid means the configured authenticated probe succeeded, not that every model is accessible.
 * Only rejected credentials justify disabling a stored credential; missing configuration does not.
 */
interface CredentialValidation {
    status: 'valid' | 'rejected' | 'missing' | 'inconclusive';
    readiness: ProviderReadiness;
}
interface CredentialField {
    id: string;
    label: string;
    secret: boolean;
    required: boolean;
    kind: 'string' | 'number' | 'boolean';
    helpUrl?: string;
    placeholder?: string;
}
interface ModelDescriptor {
    id: string;
    label: string;
    capabilities: readonly Capability[];
    efforts?: readonly string[];
    contextTokens?: number;
    maxOutputTokens?: number;
}
interface ProviderDescriptor {
    id: string;
    label: string;
    transport: 'api' | 'local' | 'cli' | 'ssh';
    fields: readonly CredentialField[];
    capabilities: readonly Capability[];
    models: readonly ModelDescriptor[];
}
declare function compatibleProviders(providers: readonly ProviderDescriptor[], required: readonly Capability[]): ProviderDescriptor[];

export { type Capability, type CredentialField, type CredentialValidation, type ModelDescriptor, type ProviderDescriptor, type ProviderReadiness, type ReadinessCode, compatibleProviders };
