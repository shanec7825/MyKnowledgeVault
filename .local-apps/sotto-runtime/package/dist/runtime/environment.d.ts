declare function agentEnvironment(source: Readonly<Record<string, string | undefined>>, credentialKeys?: readonly string[]): Record<string, string>;
interface SshConnection {
    host: string;
    identityFile?: string;
    knownHostsFile?: string;
    /** Ephemeral verification material owned by withPinnedSshConnection. */
    pinnedIdentity?: {
        user: string;
        alias: string;
        knownHostsFile: string;
        algorithms: string;
    };
}
declare function shellQuote(value: string): string;
declare function agentInvocation(command: string, args: readonly string[], connection?: SshConnection): {
    command: string;
    args: string[];
};

export { type SshConnection, agentEnvironment, agentInvocation, shellQuote };
