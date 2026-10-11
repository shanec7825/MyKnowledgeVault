import { A as AccessService, D as DeviceService, a as AccessState, P as Principal } from '../devices-1kuthJEN.cjs';
export { b as AccessError, c as AccessOptions, d as AuthenticatedSession, C as Challenge, e as DeviceIdentity, f as DeviceOptions, H as HouseholdProfile, g as HouseholdProfileService, h as Passkey, S as Session, i as accessStateSchema, j as initialAccessState, k as isAccessError, n as newToken, t as tokenHash, l as transitionAccessMode } from '../devices-1kuthJEN.cjs';
import * as _simplewebauthn_server from '@simplewebauthn/server';
import { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { S as StateStore } from '../index-8r2v4WCa.cjs';
import 'zod';
import 'node:stream';

/** Credential management depends on authenticated identity, independently of WebAuthn origin support. */
declare class PasskeyManagement {
    protected readonly access: AccessService;
    constructor(access: AccessService);
    list(token: string): Promise<{
        id: string;
        name: string;
        createdAt: number;
        backedUp: boolean;
    }[]>;
    listHousehold(token: string): Promise<{
        id: string;
        name: string;
        createdAt: number;
        backedUp: boolean;
    }[]>;
    removeHousehold(token: string, id: string): Promise<void>;
    remove(token: string, id: string): Promise<void>;
}

interface PasskeyOptions {
    access: AccessService;
    origin: string;
    name: string;
}
/** One exact canonical origin. Parent-domain RP widening is deliberately not inferred. */
declare class PasskeyService extends PasskeyManagement {
    private readonly origin;
    private readonly rpId;
    private readonly name;
    constructor(options: PasskeyOptions);
    private checkOrigin;
    registrationOptions(token: string, origin: string): Promise<{
        ceremony: string;
        options: _simplewebauthn_server.PublicKeyCredentialCreationOptionsJSON;
    }>;
    householdRegistrationOptions(token: string, origin: string): Promise<{
        ceremony: string;
        options: _simplewebauthn_server.PublicKeyCredentialCreationOptionsJSON;
    }>;
    private registrationOptionsFor;
    private consume;
    register(token: string, ceremony: string, response: RegistrationResponseJSON, name: string, origin: string): Promise<void>;
    registerHousehold(token: string, ceremony: string, response: RegistrationResponseJSON, name: string, origin: string): Promise<void>;
    private registerFor;
    /** Binding is a fresh server-generated, HttpOnly ceremony cookie maintained by the HTTP adapter. */
    authenticationOptions(binding: string, origin: string): Promise<{
        ceremony: string;
        options: _simplewebauthn_server.PublicKeyCredentialRequestOptionsJSON;
    }>;
    householdAuthenticationOptions(binding: string, origin: string): Promise<{
        ceremony: string;
        options: _simplewebauthn_server.PublicKeyCredentialRequestOptionsJSON;
    }>;
    hasHouseholdPasskeys(): Promise<boolean>;
    reauthenticationOptions(token: string, binding: string, origin: string): Promise<{
        ceremony: string;
        options: _simplewebauthn_server.PublicKeyCredentialRequestOptionsJSON;
    }>;
    private authenticationOptionsFor;
    login(binding: string, ceremony: string, response: AuthenticationResponseJSON, origin: string, name?: string): Promise<string>;
    loginHousehold(binding: string, ceremony: string, response: AuthenticationResponseJSON, origin: string, name?: string): Promise<string>;
    reauthenticate(token: string, binding: string, ceremony: string, response: AuthenticationResponseJSON, origin: string): Promise<string>;
    private completeAuthentication;
}

type ProfileManagerCredential = {
    kind: 'session' | 'device';
    token: string;
};
interface ProfileManagementOptions {
    allowHouseholdManagement?: boolean;
    devices?: DeviceService;
    requiredDeviceScopes?: readonly string[];
    ownerDeviceScope?: string;
    minimumProfiles?: number;
}
interface PreparedProfileCreation {
    readonly id: string;
    readonly name: string;
    apply(state: AccessState, credential: ProfileManagerCredential): string;
}
interface PreparedProfileUpdate {
    readonly id: string;
    readonly name: string | undefined;
    apply(state: AccessState, credential: ProfileManagerCredential): void;
}
interface PreparedProfileRemoval {
    readonly id: string;
    apply(state: AccessState, credential: ProfileManagerCredential): void;
}
/** Explicit household labels and account login names have separate lifecycles. */
declare class HouseholdProfileManagement {
    private readonly access;
    private readonly options;
    constructor(access: AccessService, options?: ProfileManagementOptions);
    private authorize;
    prepareUpdate(id: string, displayName?: string): PreparedProfileUpdate;
    /** Application deletion must commit learner data and this mutation together. */
    prepareRemove(id: string, epoch: number, confirmed: boolean): PreparedProfileRemoval;
    /** Allocate once before application transaction retries; apply revalidates current authority. */
    prepareCreate(displayName: string): PreparedProfileCreation;
}

declare const PASSWORD_INPUT_MAX_BYTES = 8192;
declare function hashPassword(password: string): Promise<string>;
/** Hash a caller-validated local configuration value outside the HTTP password policy. */
declare function hashConfiguredPassword(password: string): Promise<string>;
/** Mark an unversioned scrypt record for bounded verification and immediate rewrite. */
declare function importPasswordHash(encoded: string): string;
declare function passwordHashNeedsUpgrade(encoded: string): boolean;
declare function verifyPassword(password: string, encoded: string): Promise<boolean>;

declare class InvitationService {
    private readonly access;
    constructor(access: AccessService);
    issue(ownerToken: string, options?: {
        ttlMs?: number;
        uses?: number | null;
    }): Promise<string>;
    issueDetailed(ownerToken: string, options?: {
        ttlMs?: number;
        uses?: number | null;
    }): Promise<{
        code: string;
        mode: AccessState['mode'];
    }>;
    private valid;
    redeem(code: string, enrollment?: {
        name: string;
        password: string;
    }): Promise<string>;
    revoke(ownerToken: string, id: string): Promise<void>;
    list(ownerToken: string): Promise<AccessState['invitations']>;
}

type PrincipalMutation = {
    kind: 'create';
    name: string;
    password?: string;
    role?: Principal['role'];
} | {
    kind: 'update';
    id: string;
    password?: string;
    role?: Principal['role'];
} | {
    kind: 'delete';
    id: string;
};
/** Prepared on the server, then applied inside the application's own transaction. */
interface PreparedPrincipalMutation {
    readonly id: string;
    readonly kind: PrincipalMutation['kind'];
    apply(state: AccessState, ownerToken: string): string;
}
/** The caller must authorize deletion inside this same state transaction. */
declare function removePrincipalFromState(state: AccessState, id: string): void;
declare class PrincipalManagement {
    private readonly access;
    constructor(access: AccessService);
    /** Local operator command only. Never expose this method through an HTTP action. */
    resetPasswordForOperator(id: string, password: string): Promise<Principal['role']>;
    prepare(mutation: PrincipalMutation): Promise<PreparedPrincipalMutation>;
    mutate(ownerToken: string, mutation: PrincipalMutation): Promise<string>;
}

interface InitialHouseholdDevice {
    hash: string;
    defaultProfileId: string;
    name: string;
    createdAt: number;
    expiresAt: number | null;
    scopes: readonly string[];
}
/** Initialize household-scoped device hashes without granting individual or owner authority. */
declare function initializeHouseholdDevices(state: AccessState, initialization: string, devices: readonly InitialHouseholdDevice[], allowedScopes: readonly string[]): boolean;
interface InitialAccess {
    principals: readonly Principal[];
    mode: AccessState['mode'];
    householdPasswordHash?: string | null;
}
/** Local canonical-state initializer. Never accept an initialization snapshot from an HTTP caller. */
declare function initializeAccess(store: StateStore<AccessState>, initialization: string, input: InitialAccess): Promise<boolean>;

/** Prompt locally without echoing or passing the shared password through process arguments. */
declare function readLocalSetupInput(): Promise<{
    name: string;
    password: string;
}>;
declare function readLocalResetInput(): Promise<string>;
interface AccessOperatorOptions {
    initialize?: () => Promise<{
        warnings?: readonly string[];
    }>;
    setupInput?: () => Promise<{
        name: string;
        password: string;
    }>;
    resetInput?: () => Promise<string>;
    devices?: {
        service: DeviceService;
        scopes: readonly string[];
    };
}
declare function parseAccessCommand(args: readonly string[]): {
    operation: string;
    principalId: string | undefined;
    deviceName: string | undefined;
};
/** Local commands only. Claim and recovery output contains a short-lived bearer credential. */
declare function executeAccessCommand(access: AccessService, args: readonly string[], options?: AccessOperatorOptions): Promise<string>;

export { type AccessOperatorOptions, AccessService, AccessState, DeviceService, HouseholdProfileManagement, type InitialAccess, type InitialHouseholdDevice, InvitationService, PASSWORD_INPUT_MAX_BYTES, PasskeyManagement, type PasskeyOptions, PasskeyService, type PreparedPrincipalMutation, type PreparedProfileCreation, type PreparedProfileRemoval, type PreparedProfileUpdate, Principal, PrincipalManagement, type PrincipalMutation, type ProfileManagementOptions, type ProfileManagerCredential, executeAccessCommand, hashConfiguredPassword, hashPassword, importPasswordHash, initializeAccess, initializeHouseholdDevices, parseAccessCommand, passwordHashNeedsUpgrade, readLocalResetInput, readLocalSetupInput, removePrincipalFromState, verifyPassword };
