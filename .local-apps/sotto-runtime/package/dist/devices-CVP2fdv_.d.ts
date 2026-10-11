import { S as StateStore } from './index-8r2v4WCa.js';
import { z } from 'zod';

declare const principalSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<{
        owner: "owner";
        member: "member";
    }>;
    passwordHash: z.ZodNullable<z.ZodString>;
    epoch: z.ZodNumber;
    sourceVersion: z.ZodOptional<z.ZodString>;
    pendingRole: z.ZodOptional<z.ZodLiteral<"owner">>;
    createdAt: z.ZodNumber;
}, z.core.$strip>;
declare const sessionSchema: z.ZodObject<{
    id: z.ZodString;
    selectedProfileId: z.ZodOptional<z.ZodString>;
    selectedProfileEpoch: z.ZodOptional<z.ZodNumber>;
    selectedProfileSource: z.ZodOptional<z.ZodLiteral<"explicit">>;
    principalId: z.ZodNullable<z.ZodString>;
    epoch: z.ZodNumber;
    name: z.ZodString;
    createdAt: z.ZodNumber;
    authenticatedAt: z.ZodNumber;
    expiresAt: z.ZodNumber;
    householdEnrollmentAvailable: z.ZodOptional<z.ZodBoolean>;
    admission: z.ZodOptional<z.ZodEnum<{
        password: "password";
        passkey: "passkey";
        invitation: "invitation";
        open: "open";
    }>>;
}, z.core.$strip>;
declare const passkeySchema: z.ZodUnion<readonly [z.ZodObject<{
    scope: z.ZodOptional<z.ZodLiteral<"principal">>;
    principalId: z.ZodString;
    id: z.ZodString;
    publicKey: z.ZodString;
    counter: z.ZodNumber;
    transports: z.ZodArray<z.ZodEnum<{
        usb: "usb";
        nfc: "nfc";
        ble: "ble";
        cable: "cable";
        internal: "internal";
        hybrid: "hybrid";
        "smart-card": "smart-card";
    }>>;
    name: z.ZodString;
    createdAt: z.ZodNumber;
    backedUp: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    scope: z.ZodLiteral<"household">;
    principalId: z.ZodNull;
    householdEpoch: z.ZodNumber;
    id: z.ZodString;
    publicKey: z.ZodString;
    counter: z.ZodNumber;
    transports: z.ZodArray<z.ZodEnum<{
        usb: "usb";
        nfc: "nfc";
        ble: "ble";
        cable: "cable";
        internal: "internal";
        hybrid: "hybrid";
        "smart-card": "smart-card";
    }>>;
    name: z.ZodString;
    createdAt: z.ZodNumber;
    backedUp: z.ZodBoolean;
}, z.core.$strip>]>;
declare const challengeSchema: z.ZodObject<{
    id: z.ZodString;
    challenge: z.ZodString;
    kind: z.ZodEnum<{
        register: "register";
        "register-household": "register-household";
        authenticate: "authenticate";
        "authenticate-household": "authenticate-household";
        reauthenticate: "reauthenticate";
    }>;
    principalId: z.ZodNullable<z.ZodString>;
    sessionId: z.ZodNullable<z.ZodString>;
    originalSessionId: z.ZodOptional<z.ZodString>;
    principalEpoch: z.ZodOptional<z.ZodNumber>;
    householdEpoch: z.ZodOptional<z.ZodNumber>;
    verificationAttempts: z.ZodOptional<z.ZodNumber>;
    rpId: z.ZodString;
    origin: z.ZodString;
    expiresAt: z.ZodNumber;
}, z.core.$strip>;
declare const accessStateSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    initializations: z.ZodDefault<z.ZodArray<z.ZodString>>;
    mode: z.ZodEnum<{
        household: "household";
        individual: "individual";
    }>;
    policyEpoch: z.ZodDefault<z.ZodNumber>;
    householdPasswordHash: z.ZodNullable<z.ZodString>;
    householdEpoch: z.ZodNumber;
    principals: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        role: z.ZodEnum<{
            owner: "owner";
            member: "member";
        }>;
        passwordHash: z.ZodNullable<z.ZodString>;
        epoch: z.ZodNumber;
        sourceVersion: z.ZodOptional<z.ZodString>;
        pendingRole: z.ZodOptional<z.ZodLiteral<"owner">>;
        createdAt: z.ZodNumber;
    }, z.core.$strip>>;
    householdProfiles: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        epoch: z.ZodNumber;
        ownerPrincipalId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        selectedProfileId: z.ZodOptional<z.ZodString>;
        selectedProfileEpoch: z.ZodOptional<z.ZodNumber>;
        selectedProfileSource: z.ZodOptional<z.ZodLiteral<"explicit">>;
        principalId: z.ZodNullable<z.ZodString>;
        epoch: z.ZodNumber;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        authenticatedAt: z.ZodNumber;
        expiresAt: z.ZodNumber;
        householdEnrollmentAvailable: z.ZodOptional<z.ZodBoolean>;
        admission: z.ZodOptional<z.ZodEnum<{
            password: "password";
            passkey: "passkey";
            invitation: "invitation";
            open: "open";
        }>>;
    }, z.core.$strip>>;
    passkeys: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        scope: z.ZodOptional<z.ZodLiteral<"principal">>;
        principalId: z.ZodString;
        id: z.ZodString;
        publicKey: z.ZodString;
        counter: z.ZodNumber;
        transports: z.ZodArray<z.ZodEnum<{
            usb: "usb";
            nfc: "nfc";
            ble: "ble";
            cable: "cable";
            internal: "internal";
            hybrid: "hybrid";
            "smart-card": "smart-card";
        }>>;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        backedUp: z.ZodBoolean;
    }, z.core.$strip>, z.ZodObject<{
        scope: z.ZodLiteral<"household">;
        principalId: z.ZodNull;
        householdEpoch: z.ZodNumber;
        id: z.ZodString;
        publicKey: z.ZodString;
        counter: z.ZodNumber;
        transports: z.ZodArray<z.ZodEnum<{
            usb: "usb";
            nfc: "nfc";
            ble: "ble";
            cable: "cable";
            internal: "internal";
            hybrid: "hybrid";
            "smart-card": "smart-card";
        }>>;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        backedUp: z.ZodBoolean;
    }, z.core.$strip>]>>;
    challenges: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        challenge: z.ZodString;
        kind: z.ZodEnum<{
            register: "register";
            "register-household": "register-household";
            authenticate: "authenticate";
            "authenticate-household": "authenticate-household";
            reauthenticate: "reauthenticate";
        }>;
        principalId: z.ZodNullable<z.ZodString>;
        sessionId: z.ZodNullable<z.ZodString>;
        originalSessionId: z.ZodOptional<z.ZodString>;
        principalEpoch: z.ZodOptional<z.ZodNumber>;
        householdEpoch: z.ZodOptional<z.ZodNumber>;
        verificationAttempts: z.ZodOptional<z.ZodNumber>;
        rpId: z.ZodString;
        origin: z.ZodString;
        expiresAt: z.ZodNumber;
    }, z.core.$strip>>;
    tokens: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            claim: "claim";
            recover: "recover";
            invite: "invite";
            pair: "pair";
        }>;
        principalId: z.ZodNullable<z.ZodString>;
        expiresAt: z.ZodNumber;
        issuerSessionId: z.ZodOptional<z.ZodString>;
        epoch: z.ZodOptional<z.ZodNumber>;
        activatePendingOwner: z.ZodOptional<z.ZodLiteral<true>>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        deviceName: z.ZodOptional<z.ZodString>;
        defaultProfileId: z.ZodOptional<z.ZodString>;
        defaultProfileEpoch: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    deviceTokens: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        principalId: z.ZodNullable<z.ZodString>;
        issuerSessionId: z.ZodNullable<z.ZodString>;
        defaultProfileId: z.ZodOptional<z.ZodString>;
        defaultProfileEpoch: z.ZodOptional<z.ZodNumber>;
        epoch: z.ZodNumber;
        scopes: z.ZodArray<z.ZodString>;
        name: z.ZodString;
        createdAt: z.ZodNumber;
        expiresAt: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>>>;
    invitations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        issuerPrincipalId: z.ZodString;
        issuerEpoch: z.ZodNumber;
        policyEpoch: z.ZodNumber;
        householdEpoch: z.ZodNumber;
        mode: z.ZodEnum<{
            household: "household";
            individual: "individual";
        }>;
        remaining: z.ZodNullable<z.ZodNumber>;
        expiresAt: z.ZodNumber;
    }, z.core.$strip>>>;
    recoveryCodes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        principalId: z.ZodString;
    }, z.core.$strip>>;
    failures: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        count: z.ZodNumber;
        expiresAt: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
type AccessState = z.infer<typeof accessStateSchema>;
type Principal = z.infer<typeof principalSchema>;
type Session = z.infer<typeof sessionSchema>;
type Passkey = z.infer<typeof passkeySchema>;
type Challenge = z.infer<typeof challengeSchema>;
declare function initialAccessState(): AccessState;

declare const ACCESS_ERROR_BRAND: unique symbol;

declare class AccessError extends Error {
    readonly code: 'unauthorized' | 'forbidden' | 'invalid' | 'rate_limited' | 'conflict';
    readonly [ACCESS_ERROR_BRAND] = "access";
    constructor(code: 'unauthorized' | 'forbidden' | 'invalid' | 'rate_limited' | 'conflict', message?: string);
}
declare function isAccessError(error: unknown): error is AccessError;
declare const tokenHash: (token: string) => string;
declare const newToken: () => string;
/** Apply a mode transition inside an already-authorized storage transaction. */
declare function transitionAccessMode(state: AccessState, mode: AccessState['mode']): void;
interface AccessOptions {
    store: StateStore<AccessState>;
    sessionTtlMs?: number;
    householdSessionTtlMs?: number;
    recentAuthMs?: number;
    allowOpenHousehold?: boolean;
    allowHouseholdInvitations?: boolean;
    allowPrincipalAccessInHousehold?: boolean;
    now?: () => number;
}
interface AuthenticatedSession {
    session: Session;
    principal: Omit<Principal, 'passwordHash'> | null;
}
declare class AccessService {
    readonly store: StateStore<AccessState>;
    readonly now: () => number;
    readonly recentAuthMs: number;
    private readonly ttl;
    private readonly householdTtl;
    private readonly allowOpenHousehold;
    readonly allowHouseholdInvitations: boolean;
    readonly allowPrincipalAccessInHousehold: boolean;
    constructor(options: AccessOptions);
    sessionFromState(state: AccessState, token: string, owner?: boolean, recent?: boolean): AuthenticatedSession;
    householdOwnerForSession(state: AccessState, session: Session): Principal | null;
    householdOwnerFromState(state: AccessState, token: string): boolean;
    authenticate(token: string, owner?: boolean, recent?: boolean): Promise<AuthenticatedSession>;
    issueSession(state: AccessState, principalId: string | null, name: string, householdEnrollmentAvailable?: boolean, admission?: Session['admission']): string;
    /** Operator-only primitive. Expose through a local command, never an unauthenticated HTTP route. */
    issueOperatorToken(principalId?: string): Promise<string>;
    claimOwner(token: string, name: string, password: string, mode: AccessState['mode']): Promise<string>;
    private validName;
    addMember(ownerToken: string, name: string, password: string): Promise<string>;
    /** Reserve an attempt before expensive verification, including concurrent requests. */
    reserveAttempt(scope: string): Promise<void>;
    login(name: string, password: string, deviceName?: string): Promise<string>;
    configureHousehold(ownerToken: string, password: string | null): Promise<void>;
    /** Local operator only. Replace the shared password when the server owner loses access. */
    resetHouseholdPasswordForOperator(password: string): Promise<void>;
    setRole(ownerToken: string, principalId: string, role: Principal['role']): Promise<void>;
    setMode(ownerToken: string, mode: AccessState['mode']): Promise<void>;
    private passwordProof;
    reauthenticate(token: string, password: string): Promise<string>;
    rotatePrincipalCredential(token: string, password: string, currentPassword?: string): Promise<string>;
    enterHousehold(password: string, deviceName?: string, policy?: {
        householdEpoch: number;
        policyEpoch: number;
    }): Promise<string>;
    /** Explicitly enabled household convenience. This grants no authenticated identity. */
    enterOpenHousehold(deviceName?: string, existingToken?: string): Promise<string>;
    /** Compose admission with other state mutations in the caller's transaction. */
    issueOpenHouseholdSession(state: AccessState, deviceName?: string, existingToken?: string): string;
    supportsOpenHousehold(): Promise<boolean>;
    sessions(token: string): Promise<Session[]>;
    revokeSession(token: string, id: string): Promise<void>;
    logout(token: string): Promise<void>;
    recoveryCodes(token: string): Promise<string[]>;
    recover(code: string, password: string): Promise<string>;
}

interface HouseholdProfile {
    id: string;
    name: string;
}
/** A household profile selects content and can grant Admin authority after household admission. */
declare class HouseholdProfileService {
    private readonly access;
    constructor(access: AccessService);
    enterOpen(profileId: string, existingToken?: string): Promise<string>;
    list(token: string): Promise<HouseholdProfile[]>;
    select(token: string, profileId: string | null): Promise<void>;
    selected(token: string): Promise<HouseholdProfile | null>;
    selectedFromState(state: AccessState, token: string): HouseholdProfile | null;
    private household;
}

interface DeviceOptions {
    access: AccessService;
    /** Current permissions the principal may delegate. Household admission must have its own limited set. */
    scopesFor(principal: AuthenticatedSession['principal']): readonly string[];
    deviceTtlMs?: number;
    maxDevicesPerProfile?: number;
    /** Formatting for newly issued device credentials. Never used as authentication evidence. */
    tokenPrefix?: string;
    /** Owners must explicitly delegate this scope before a device may manage other devices. */
    managementScope?: string;
}
interface DeviceIdentity {
    id: string;
    principal: AuthenticatedSession['principal'];
    scopes: string[];
    name: string;
    expiresAt: number | null;
    defaultProfileId?: string;
}
declare class DeviceService {
    private readonly options;
    private readonly ttl;
    private readonly prefix;
    private readonly limit;
    constructor(options: DeviceOptions);
    private principal;
    private scopedPrincipal;
    issuePairing(sessionToken: string, scopes: readonly string[], name: string, options?: {
        defaultProfileId?: string;
    }): Promise<string>;
    redeemPairing(code: string): Promise<string>;
    authenticate(token: string, required: readonly string[]): Promise<DeviceIdentity>;
    /** Local operator primitive. Applications must never expose this method through an unauthenticated route. */
    issueForOperator(principalId: string, scopes: readonly string[], name: string): Promise<string>;
    authenticateFromState(state: AccessState, token: string, required: readonly string[]): DeviceIdentity;
    /** Display status only. A record ID is never a credential or authorization proof. */
    statusFromState(state: AccessState, id: string, required?: readonly string[]): 'active' | 'expired' | 'unavailable';
    private identityFromRecord;
    list(sessionToken: string): Promise<AccessState['deviceTokens']>;
    revoke(sessionToken: string, id: string): Promise<void>;
    private canManageDevices;
    listForDevice(token: string): Promise<Array<Pick<AccessState['deviceTokens'][number], 'id' | 'name' | 'scopes' | 'createdAt' | 'expiresAt'>>>;
    revokeForDevice(token: string, id: string): Promise<void>;
}

export { AccessService as A, type Challenge as C, DeviceService as D, type HouseholdProfile as H, type Principal as P, type Session as S, type AccessState as a, AccessError as b, type AccessOptions as c, type AuthenticatedSession as d, type DeviceIdentity as e, type DeviceOptions as f, HouseholdProfileService as g, type Passkey as h, accessStateSchema as i, initialAccessState as j, isAccessError as k, transitionAccessMode as l, newToken as n, tokenHash as t };
