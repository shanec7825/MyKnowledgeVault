import { Capability, ProviderReadiness } from '../ai/browser.cjs';

interface SetupRequirement {
    id: string;
    label: string;
    required: boolean;
    dependsOn?: readonly string[];
    capabilities?: readonly Capability[];
    check(signal: AbortSignal): Promise<ProviderReadiness>;
}
interface SetupResult {
    id: string;
    label: string;
    required: boolean;
    status: ProviderReadiness | {
        code: 'blocked';
        checkedAt: number;
        blockedBy: string[];
    };
}
/** Apps supply their real dependency graph; there is no universal AI-ready shortcut. */
declare function checkSetup(requirements: readonly SetupRequirement[], signal?: AbortSignal): Promise<{
    ready: boolean;
    results: SetupResult[];
}>;

export { type SetupRequirement, type SetupResult, checkSetup };
