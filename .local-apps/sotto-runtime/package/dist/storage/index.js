import { StorageInstanceControl } from '../chunk-N26BSZWZ.js';
export { StorageInstanceControl } from '../chunk-N26BSZWZ.js';
import { syncDirectory, LocalStorageCleanup, cleanupRows, StorageReadCleanupError, copyOwnedBytesToFile, StorageCleanupJournal, CleanupManifests, prepareStorageManifestPages, cleanupHash, prepareStorageCleanup, StorageProbeCleanupError } from '../chunk-BDFGCGEZ.js';
export { LocalStorageCleanup, StorageCleanupJournal, StorageManifestLimitError, StorageProbeCleanupError, StorageReadCleanupError, copyOwnedBytesToFile, createExecutionWorkspace, isStorageManifestLimitError, planExecutionWorkspace, prepareStorageCleanup, prepareStorageManifestPages, recoverExecutionWorkspace, removeExecutionWorkspace, syncDirectory } from '../chunk-BDFGCGEZ.js';
import { validateStorageKey, normalizeStorageReference, StorageBackendRegistry, StorageWriteJournal, prepareStorageBackend, prepareStorageWrite, storageBackendBinding } from '../chunk-VAAUIWAQ.js';
export { StorageBackendRegistry, StorageReferenceError, StorageWriteJournal, normalizeStorageReference, prepareStorageBackend, prepareStorageTombstone, prepareStorageWrite, storageBackendBinding, storageCleanupDescriptorSchema, validateStorageKey } from '../chunk-VAAUIWAQ.js';
import '../chunk-6AI6LCA2.js';
import '../chunk-PUSQYKAU.js';
import '../chunk-3VXHRNSB.js';
import '../chunk-CLWMTL22.js';
import '../chunk-HDHO73O7.js';
import '../chunk-IXFOKQWY.js';
import '../chunk-GDO34PSX.js';
import { sqlStateBackend } from '../chunk-2VO27ZQG.js';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { mkdir, open, lstat, realpath, readFile, rename, unlink } from 'fs/promises';
import { mkdirSync, openSync, closeSync, statSync, constants, writeFileSync, fstatSync, fsyncSync, readSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { createRequire } from 'module';
import { setTimeout as setTimeout$1 } from 'timers/promises';
import { Readable } from 'stream';
import { z } from 'zod';
import { pipeline } from 'stream/promises';
import { isDeepStrictEqual } from 'util';

var requireNative = createRequire(import.meta.url);
var binding;
function lockFile(descriptor, shared) {
  try {
    binding ??= requireNative("thesidedoor-flock");
  } catch (cause) {
    throw new Error(
      "Native file locking is unavailable. Install thesidedoor-flock with a working C++ compiler and node-gyp toolchain.",
      { cause }
    );
  }
  const { LOCK_SH, LOCK_EX, LOCK_NB } = binding.constants;
  binding.flock(descriptor, (shared ? LOCK_SH : LOCK_EX) | LOCK_NB);
}
var FileLockBusyError = class extends Error {
  code = "lock_busy";
  constructor() {
    super("The protected files are busy. Retry the operation.");
  }
};
function withSharedFileLockSync(path, operation) {
  const release = acquireFileLockSync(path, "shared");
  try {
    const result = operation();
    if (result instanceof Promise)
      throw new Error("Synchronous file lock callbacks must not return a promise");
    return result;
  } finally {
    release();
  }
}
function acquireFileLockSync(path, mode = "exclusive") {
  const anchor = resolve(path);
  mkdirSync(dirname(anchor), { recursive: true, mode: 448 });
  const descriptor = openSync(anchor, "a", 384);
  try {
    try {
      lockFile(descriptor, mode === "shared");
    } catch (error) {
      if (error instanceof Error && "code" in error && ["EAGAIN", "EWOULDBLOCK"].includes(String(error.code)))
        throw new FileLockBusyError();
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      closeSync(descriptor);
    };
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}
async function acquireFileLock(path, options = {}) {
  const timeout = options.timeoutMs ?? 1e4;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("Invalid file lock timeout");
  options.signal?.throwIfAborted();
  const anchor = resolve(path);
  await mkdir(dirname(anchor), { recursive: true, mode: 448 });
  const handle = await open(anchor, "a", 384);
  try {
    const deadline = Date.now() + timeout;
    while (true) {
      options.signal?.throwIfAborted();
      try {
        lockFile(handle.fd, options.mode === "shared");
        return () => handle.close();
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || !["EAGAIN", "EWOULDBLOCK"].includes(String(error.code)))
          throw error;
        if (Date.now() >= deadline) throw new FileLockBusyError();
        await setTimeout$1(10, void 0, { signal: options.signal });
      }
    }
  } catch (error) {
    await handle.close();
    throw error;
  }
}
async function withFileLock(path, operation, options = {}) {
  const release = await acquireFileLock(path, options);
  try {
    return await operation();
  } finally {
    await release();
  }
}

// src/storage/registry/key.ts
function localEncryptionKey(path, options) {
  if (!statSync(dirname(path)).isDirectory()) throw new Error("Encryption key parent is not a directory");
  const release = acquireFileLockSync(`${path}.guard`, options.create ? "exclusive" : "shared");
  let descriptor;
  try {
    try {
      descriptor = openSync(
        path,
        (options.create ? constants.O_RDWR : constants.O_RDONLY) | constants.O_NOFOLLOW | constants.O_NONBLOCK
      );
    } catch (error) {
      if (!options.create || !(error instanceof Error) || !("code" in error) || error.code !== "ENOENT")
        throw error;
      descriptor = openSync(
        path,
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        384
      );
      writeFileSync(descriptor, randomBytes(32));
    }
    const file = fstatSync(descriptor);
    if (!file.isFile() || file.size !== 32 || (file.mode & 4095) !== 384)
      throw new Error("Encryption key must be a regular 32-byte file with mode 0600");
    if (options.create) {
      fsyncSync(descriptor);
      syncDirectory(dirname(path));
    }
    const key = Buffer.alloc(32);
    let offset = 0;
    while (offset < key.length) {
      const bytes = readSync(descriptor, key, offset, key.length - offset, offset);
      if (!bytes) throw new Error("Encryption key changed while reading");
      offset += bytes;
    }
    return key;
  } finally {
    try {
      if (descriptor !== void 0) closeSync(descriptor);
    } finally {
      release();
    }
  }
}
var LocalStorageWriteError = class extends Error {
  constructor(created, cause) {
    super(
      created ? "Storage write failed after file creation" : "Storage write failed before file creation",
      {
        cause
      }
    );
    this.created = created;
    this.name = "LocalStorageWriteError";
  }
  created;
};
var LocalStorageWriter = class _LocalStorageWriter {
  constructor(identity4) {
    this.identity = identity4;
  }
  identity;
  static async restore(identity4) {
    return new _LocalStorageWriter((await LocalStorageCleanup.restore(identity4)).identity);
  }
  async verifyRoot() {
    await LocalStorageCleanup.restore(this.identity);
  }
  async parentFor(key) {
    if (normalizeStorageReference({ kind: "local", root: this.identity.root }, key) !== key)
      throw new Error("Writing requires an exact storage key");
    await this.verifyRoot();
    let parent = this.identity.root;
    for (const part of key.split("/").slice(0, -1)) {
      const directory = join(parent, part);
      try {
        await mkdir(directory, { mode: 448 });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      }
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
        throw new Error("Storage key parent is not a regular directory");
      syncDirectory(parent);
      parent = directory;
    }
    await this.verifyRoot();
    return parent;
  }
  async writeImmutable(key, body, signal) {
    let created = false;
    try {
      signal?.throwIfAborted();
      const parent = await this.parentFor(key);
      signal?.throwIfAborted();
      const target = join(this.identity.root, key);
      if (dirname(target) !== parent) throw new Error("Storage key parent changed");
      const file = await open(target, "wx", 384);
      created = true;
      try {
        if (body instanceof Readable) {
          await pipeline(
            body,
            async (source) => {
              for await (const chunk of source) await file.writeFile(chunk, { signal });
            },
            { signal }
          );
        } else {
          await file.writeFile(body, { signal });
        }
        await file.sync();
        syncDirectory(parent);
        await this.verifyRoot();
      } finally {
        await file.close();
      }
    } catch (cause) {
      throw new LocalStorageWriteError(created, cause);
    }
  }
};
var identity = z.string().min(1).max(200);
var digest = z.string().regex(/^[a-f0-9]{64}$/);
var claimsSchema = z.array(z.object({ consumer: identity, previousReference: z.string().min(1).nullable() }).strict()).min(1).max(100);
var allocationSchema = z.object({
  kind: z.literal("storage_reference_allocation"),
  namespace: identity,
  operationId: z.uuid(),
  assetId: digest,
  claims: claimsSchema
}).strict();
var referenceSchema = z.object({
  namespace: identity,
  operationId: z.uuid(),
  reference: z.string().min(1),
  localRoutePrefix: z.string().min(1).optional(),
  target: z.object({ backendId: digest, binding: digest, key: z.string().transform(validateStorageKey) }).strict(),
  scopes: z.array(z.object({ subjectId: identity, generation: z.number().int().nonnegative() }).strict()).min(1)
}).strict();
var StorageReferenceConsumerMismatchError = class extends Error {
  constructor() {
    super("Storage reference does not belong to this consumer");
    this.name = "StorageReferenceConsumerMismatchError";
  }
};
var assetSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("storage_asset"),
  id: digest,
  prepared: referenceSchema,
  consumers: z.array(identity)
}).strict();
var aliasSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("storage_reference_alias"),
  namespace: identity,
  reference: z.string().min(1),
  assetId: digest
}).strict();
var retirementSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("storage_reference_retirement"),
  namespace: identity,
  operationId: z.uuid(),
  consumer: identity,
  previousReference: z.string().min(1),
  replacementAssetId: digest.nullable(),
  attribution: z.object({ assetId: digest, prepared: referenceSchema }).strict().nullable(),
  status: z.enum(["pending", "unresolved"])
}).strict();
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function assetId(prepared) {
  return hash(JSON.stringify([prepared.target.binding, prepared.target.key]));
}
function storageSnapshotAttribution(input, namespace) {
  const kind = z.object({ kind: z.string() }).passthrough().parse(input).kind;
  if (kind === "storage_asset") {
    const asset = assetSchema.parse(input);
    return { assetId: asset.id, prepared: asset.prepared };
  }
  if (kind === "storage_reference_retirement") {
    const retirement = retirementSchema.parse(input);
    if (retirement.namespace !== namespace) throw new Error("Storage retirement namespace mismatch");
    return retirement.attribution;
  }
  throw new Error("Unsupported storage reference snapshot");
}
function prepareStorageReference(input) {
  return referenceSchema.parse(input);
}
function prepareStorageReferenceClaims(input) {
  const claims = claimsSchema.parse(input).sort((left, right) => left.consumer < right.consumer ? -1 : left.consumer > right.consumer ? 1 : 0);
  if (new Set(claims.map((value) => value.consumer)).size !== claims.length)
    throw new Error("Storage consumers must be distinct");
  return claims;
}
var StorageReferenceRegistry = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    identity.parse(namespace);
    this.prefix = hash(namespace);
  }
  database;
  dialect;
  namespace;
  prefix;
  backend(kind, id) {
    return sqlStateBackend(this.database, this.dialect, `sd-${kind}:1:${this.prefix}:${id}`);
  }
  validate(input) {
    const prepared = referenceSchema.parse(input);
    if (prepared.namespace !== this.namespace) throw new Error("Storage reference namespace mismatch");
    return prepared;
  }
  /** Validate captured cleanup attribution even after its asset row was erased. No access grant. */
  async validateRetainedAttribution(input) {
    const id = digest.parse(input.assetId);
    const prepared = this.validate(input.prepared);
    if (assetId(prepared) !== id) throw new Error("Storage retained attribution identity mismatch");
    const backend = await this.validateBackend(prepared);
    return structuredClone({ assetId: id, prepared, backend });
  }
  /** Retained attribution remains readable after the last application consumer retires. */
  async readAsset(id) {
    digest.parse(id);
    const row = await this.backend("asset", id).read();
    if (!row) return null;
    const asset = assetSchema.parse(row.state);
    this.validate(asset.prepared);
    if (asset.id !== id || assetId(asset.prepared) !== id) throw new Error("Storage asset identity mismatch");
    const backend = await this.validateBackend(asset.prepared);
    return structuredClone({ asset, backend });
  }
  /** Historical lookup does not grant current consumer ownership or application access. */
  async readReference(reference) {
    z.string().min(1).parse(reference);
    const attributed = await this.attributed(reference);
    if (!attributed) return null;
    const backend = await this.validateBackend(attributed.asset.prepared);
    return structuredClone({ asset: attributed.asset, backend });
  }
  /** Immutable claims captured by the original replacement transaction. */
  async readAllocation(id) {
    digest.parse(id);
    const row = await this.backend("allocation", id).read();
    if (!row) return null;
    const allocation = allocationSchema.parse(row.state);
    if (allocation.namespace !== this.namespace || allocation.assetId !== id)
      throw new Error("Storage allocation identity mismatch");
    prepareStorageReferenceClaims(allocation.claims);
    return structuredClone(allocation);
  }
  /** Exact replacement evidence. Unknown historical ownership stays explicitly unresolved. */
  async readRetirement(operationId, consumer) {
    z.uuid().parse(operationId);
    identity.parse(consumer);
    const row = await this.backend("retired", hash(JSON.stringify([operationId, consumer]))).read();
    if (!row) return null;
    const retirement = retirementSchema.parse(row.state);
    if (retirement.namespace !== this.namespace || retirement.operationId !== operationId || retirement.consumer !== consumer)
      throw new Error("Storage retirement identity mismatch");
    if (retirement.attribution) {
      this.validate(retirement.attribution.prepared);
      if (assetId(retirement.attribution.prepared) !== retirement.attribution.assetId)
        throw new Error("Storage retirement attribution mismatch");
    }
    return structuredClone(retirement);
  }
  /**
   * Scan every page in the caller's Serializable snapshot before removing application rows.
   * Empty consumer lists remain discoverable: retirement does not erase asset ownership scopes.
   * The application determines which scopes belong to its deletion operation.
   */
  async listAssets(after = null) {
    const prefix = `sd-asset:1:${this.prefix}:`;
    const rows = await cleanupRows(this.database, this.dialect, prefix, after);
    const assets = rows.map((row) => {
      const asset = assetSchema.parse(this.decode(row.state));
      this.validate(asset.prepared);
      if (asset.id !== assetId(asset.prepared) || row.id !== `${prefix}${asset.id}`)
        throw new Error("Storage asset identity mismatch");
      return asset;
    });
    return { assets, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  /** Includes unresolved references with no asset row. Consumer ownership is application-defined. */
  async listRetirements(after = null) {
    const prefix = `sd-retired:1:${this.prefix}:`;
    const rows = await cleanupRows(this.database, this.dialect, prefix, after);
    const retirements = rows.map((row) => {
      const retirement = retirementSchema.parse(this.decode(row.state));
      const id = hash(JSON.stringify([retirement.operationId, retirement.consumer]));
      if (retirement.namespace !== this.namespace || row.id !== `${prefix}${id}`)
        throw new Error("Storage retirement identity mismatch");
      if (retirement.attribution) {
        this.validate(retirement.attribution.prepared);
        if (retirement.attribution.assetId !== assetId(retirement.attribution.prepared))
          throw new Error("Storage retirement attribution mismatch");
      }
      return retirement;
    });
    return { retirements, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  decode(state) {
    return this.dialect === "sqlite" && typeof state === "string" ? JSON.parse(state) : state;
  }
  async attributed(reference) {
    const alias = await this.backend("alias", hash(reference)).read();
    if (!alias) return null;
    const value = aliasSchema.parse(alias.state);
    if (value.namespace !== this.namespace || value.reference !== reference)
      throw new Error("Storage reference alias mismatch");
    const record = await this.backend("asset", value.assetId).read();
    if (!record) throw new Error("Storage reference attribution is missing");
    const asset = assetSchema.parse(record.state);
    this.validate(asset.prepared);
    if (asset.id !== value.assetId || assetId(asset.prepared) !== asset.id)
      throw new Error("Storage asset identity mismatch");
    return { record, asset };
  }
  async replace(input) {
    return this.replaceMany({
      consumers: [{ consumer: input.consumer, previousReference: input.previousReference }],
      next: input.next
    });
  }
  /** Resolve current consumer attribution in the caller's Serializable snapshot.
   * Unknown references require explicit adoption. This never grants application access.
   */
  async resolve(input) {
    const consumer = identity.parse(input.consumer);
    const reference = z.string().min(1).parse(input.reference);
    const attributed = await this.attributed(reference);
    if (!attributed) return null;
    const { asset } = attributed;
    const backend = await this.validateBackend(asset.prepared);
    if (!asset.consumers.includes(consumer)) throw new StorageReferenceConsumerMismatchError();
    return structuredClone({ assetId: asset.id, prepared: asset.prepared, backend });
  }
  async validateBackend(next) {
    const registered = await new StorageBackendRegistry(this.database, this.dialect, this.namespace).get(
      next.target.backendId
    );
    if (!registered || registered.binding !== next.target.binding)
      throw new Error("Storage reference backend is missing");
    const descriptor = registered.descriptor;
    const key = descriptor.kind === "local" ? normalizeStorageReference({ kind: "local", root: descriptor.referenceRoot }, next.reference, {
      localRoutePrefix: next.localRoutePrefix
    }) : normalizeStorageReference(descriptor.location, next.reference, {
      ...descriptor.publicUrl ? { publicUrl: descriptor.publicUrl } : {},
      publicUrlEncoding: descriptor.referenceEncoding
    });
    if (key !== next.target.key) throw new Error("Storage reference does not address its attributed key");
    return registered;
  }
  /** Allocate one immutable asset for all of its application references in the caller's transaction. */
  async replaceMany(input) {
    const replacements = prepareStorageReferenceClaims(input.consumers);
    const consumers = replacements.map((value) => value.consumer).sort();
    const next = this.validate(input.next);
    await this.validateBackend(next);
    const id = assetId(next);
    const assetBackend = this.backend("asset", id);
    const previousAsset = await assetBackend.read();
    const allocationBackend = this.backend("allocation", id);
    const allocation = allocationSchema.parse({
      kind: "storage_reference_allocation",
      namespace: this.namespace,
      operationId: next.operationId,
      assetId: id,
      claims: replacements
    });
    const priorAllocation = await allocationBackend.read();
    if (priorAllocation) {
      if (!isDeepStrictEqual(allocationSchema.parse(priorAllocation.state), allocation))
        throw new Error("Storage allocation replacement claims changed");
    } else {
      if (previousAsset) throw new Error("Storage allocation replacement claims are missing");
      if (!await allocationBackend.compareAndSwap(null, { revision: randomUUID(), state: allocation }))
        throw new Error("Storage allocation claims changed concurrently");
    }
    if (previousAsset) {
      const existing = assetSchema.parse(previousAsset.state);
      if (!isDeepStrictEqual(existing.prepared, next) || !isDeepStrictEqual([...existing.consumers].sort(), consumers))
        throw new Error("Storage asset allocation is already in use");
    } else if (!await assetBackend.compareAndSwap(null, {
      revision: randomUUID(),
      state: assetSchema.parse({
        schemaVersion: 1,
        kind: "storage_asset",
        id,
        prepared: next,
        consumers
      })
    }))
      throw new Error("Storage asset allocation changed concurrently");
    const aliasBackend = this.backend("alias", hash(next.reference));
    const previousAlias = await aliasBackend.read();
    const alias = aliasSchema.parse({
      schemaVersion: 1,
      kind: "storage_reference_alias",
      namespace: this.namespace,
      reference: next.reference,
      assetId: id
    });
    if (previousAlias) {
      if (JSON.stringify(aliasSchema.parse(previousAlias.state)) !== JSON.stringify(alias))
        throw new Error("Storage reference alias is already in use");
    } else if (!await aliasBackend.compareAndSwap(null, { revision: randomUUID(), state: alias }))
      throw new Error("Storage reference alias changed concurrently");
    for (const replacement of replacements) {
      if (replacement.previousReference === null || replacement.previousReference === next.reference)
        continue;
      await this.retireReference({
        operationId: next.operationId,
        consumer: replacement.consumer,
        previousReference: replacement.previousReference,
        replacementAssetId: id
      });
    }
  }
  /** Commit with removal of the application's reference, including selection of a bundled asset. */
  async retire(input) {
    await this.retireReference({
      operationId: z.uuid().parse(input.operationId),
      consumer: identity.parse(input.consumer),
      previousReference: z.string().min(1).parse(input.previousReference),
      replacementAssetId: null
    });
  }
  async retireReference(input) {
    const { consumer } = input;
    const prior = await this.attributed(input.previousReference);
    const owned = prior?.asset.consumers.includes(consumer) ? prior : null;
    const retirement = retirementSchema.parse({
      schemaVersion: 1,
      kind: "storage_reference_retirement",
      namespace: this.namespace,
      operationId: input.operationId,
      consumer,
      previousReference: input.previousReference,
      replacementAssetId: input.replacementAssetId,
      attribution: owned ? { assetId: owned.asset.id, prepared: owned.asset.prepared } : null,
      status: owned ? "pending" : "unresolved"
    });
    const retirementBackend = this.backend("retired", hash(JSON.stringify([input.operationId, consumer])));
    const existingRetirement = await retirementBackend.read();
    if (existingRetirement) {
      const existing = retirementSchema.parse(existingRetirement.state);
      if (existing.namespace !== this.namespace || existing.operationId !== input.operationId || existing.consumer !== consumer || existing.previousReference !== input.previousReference || existing.replacementAssetId !== input.replacementAssetId)
        throw new Error("Storage retirement identity mismatch");
      return;
    }
    if (owned) {
      const updated = {
        ...owned.asset,
        consumers: owned.asset.consumers.filter((value) => value !== consumer)
      };
      if (!await this.backend("asset", owned.asset.id).compareAndSwap(owned.record.revision, {
        revision: randomUUID(),
        state: updated
      }))
        throw new Error("Storage reference ownership changed concurrently");
    }
    if (!await retirementBackend.compareAndSwap(null, { revision: randomUUID(), state: retirement }))
      throw new Error("Storage retirement changed concurrently");
  }
};
function ownReadable(stream) {
  const failures = stream.errored ? [stream.errored] : [];
  let failureCount = failures.length;
  const onError = (error) => {
    if (failures.includes(error)) return;
    failureCount = Math.min(Number.MAX_SAFE_INTEGER, failureCount + 1);
    if (failures.length < 8) failures.push(error);
  };
  stream.on("error", onError);
  const closed = stream.closed ? Promise.resolve() : new Promise((resolve4) => stream.once("close", resolve4));
  let iterator;
  let closing;
  return {
    read: async () => {
      iterator ??= stream.iterator({ destroyOnReturn: false });
      const next = await iterator.next();
      if (next.done) return null;
      if (!(next.value instanceof Uint8Array)) throw new Error("Storage stream returned non-binary data");
      return next.value;
    },
    close: () => {
      closing ??= (async () => {
        try {
          stream.destroy();
        } catch (error) {
          onError(error);
        }
        await closed;
        await new Promise((resolve4) => process.nextTick(resolve4));
        stream.off("error", onError);
        if (failureCount)
          throw new AggregateError(
            failures,
            `Storage stream closure includes ${failureCount} unresolved errors`
          );
      })();
      return closing;
    }
  };
}
async function withOwnedReadables(streams, run) {
  const sources = [...new Set(streams)].map(ownReadable);
  let result;
  let primary;
  try {
    result = await run();
  } catch (error) {
    primary = { error };
  }
  const failures = [];
  const closing = Promise.all(
    sources.map(async (source) => {
      try {
        await source.close();
      } catch (error) {
        failures.push(error);
      }
    })
  );
  let timer;
  let cleanup;
  try {
    await Promise.race([
      closing,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Storage stream cleanup timed out")), 1e3);
      })
    ]);
    if (failures.length) cleanup = { error: new AggregateError(failures, "Storage source closure failed") };
  } catch (error) {
    cleanup = { error: new AggregateError([...failures, error], "Storage source closure is unconfirmed") };
  } finally {
    clearTimeout(timer);
  }
  if (cleanup) {
    const error = new StorageReadCleanupError({ cause: cleanup.error });
    if (primary)
      throw new AggregateError([primary.error, error], "Storage operation and source cleanup failed", {
        cause: error
      });
    throw error;
  }
  if (primary) throw primary.error;
  return result;
}
async function copyOwnedReadableToFile(options) {
  const { openSource, destination, signal } = options;
  return copyOwnedBytesToFile({
    destination,
    signal,
    openSource: async () => ownReadable(await openSource())
  });
}

// src/storage/execution/write-set.ts
var errorBrand = /* @__PURE__ */ Symbol.for("thesidedoor.storage.reference-set.error");
var ReferenceSetError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
  [errorBrand] = true;
};
function isReferenceSetError(error) {
  return error instanceof Error && error[errorBrand] === true;
}
var name = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
var scope = z.object({
  subjectId: z.string().min(1).max(200),
  generation: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();
async function writeReferenceSet(options) {
  const streams = options.artifacts.map((artifact) => artifact.body).filter((body) => body instanceof Readable);
  return withOwnedReadables(streams, () => writeOwnedReferenceSet(options));
}
async function writeOwnedReferenceSet(options) {
  const verifyArtifact = options.verifyArtifact;
  try {
    z.string().min(1).max(200).parse(options.namespace);
    if (options.artifacts.length < 1 || options.artifacts.length > 10)
      throw new ReferenceSetError("invalid", "A storage reference set requires between 1 and 10 artifacts");
    const artifacts = options.artifacts.map((artifact) => {
      name.parse(artifact.name);
      validateStorageKey(artifact.prefix);
      if (!/^[a-z0-9]{1,12}$/.test(artifact.extension) || !artifact.contentType.trim() || artifact.contentType.length > 200)
        throw new ReferenceSetError("invalid", "Invalid storage artifact metadata");
      return { ...artifact, operationId: randomUUID() };
    });
    if (new Set(artifacts.map((artifact) => artifact.name)).size !== artifacts.length)
      throw new ReferenceSetError("invalid", "Storage artifact names must be distinct");
    const streams = artifacts.map((artifact) => artifact.body).filter((body) => body instanceof Readable);
    if (new Set(streams).size !== streams.length)
      throw new ReferenceSetError("invalid", "Each storage artifact must own a distinct stream");
    options.signal.throwIfAborted();
    const instance = (tx) => new StorageInstanceControl(options.executor(tx), options.dialect, options.namespace);
    const writes = (tx) => new StorageWriteJournal(options.executor(tx), options.dialect, options.namespace);
    const captured = await options.transaction(async (tx) => {
      const admission = structuredClone(await options.captureAdmission(tx));
      const current = await instance(tx).read();
      const scopes = z.array(scope).min(2).max(1e3).parse(admission.scopes);
      if (admission.instanceId !== current.instanceId || new Set(scopes.map((item) => item.subjectId)).size !== scopes.length || !scopes.some((item) => item.subjectId === current.subjectId && item.generation === current.generation))
        throw new ReferenceSetError("conflict", "Storage admission does not match the current instance");
      return admission;
    });
    const claims = artifacts.map(
      (artifact) => prepareStorageReferenceClaims(artifact.consumers(structuredClone(captured.snapshot)))
    );
    const retirements = z.array(
      z.object({ consumer: z.string().min(1).max(200), previousReference: z.string().min(1).max(8192) }).strict()
    ).max(100).parse(options.retirements?.(structuredClone(captured.snapshot)) ?? []).map((entry) => ({ ...entry, operationId: randomUUID() }));
    const consumers = [
      ...claims.flatMap((group) => group.map((entry) => entry.consumer)),
      ...retirements.map((entry) => entry.consumer)
    ];
    if (new Set(consumers).size !== consumers.length)
      throw new ReferenceSetError(
        "invalid",
        "Storage consumers must be distinct across replacements and retirements"
      );
    if (consumers.some((consumer) => !consumer.trim()))
      throw new ReferenceSetError("conflict", "Storage consumers cannot be blank");
    const prepared = [];
    for (const [index, artifact] of artifacts.entries()) {
      options.signal.throwIfAborted();
      const writer = await artifact.captureWriter();
      const backend = prepareStorageBackend(options.namespace, writer.descriptor);
      const key = `${artifact.prefix}/${captured.instanceId}/${artifact.operationId}.${artifact.extension}`;
      const intents = captured.scopes.map(
        (item) => prepareStorageWrite({
          namespace: options.namespace,
          ...item,
          target: { backendId: backend.id, binding: backend.binding, key }
        })
      );
      prepared.push({ artifact, writer, backend, key, intents, consumers: claims[index] });
    }
    async function validate(tx, published2) {
      if (!published2) options.signal.throwIfAborted();
      await options.validateAdmission(
        tx,
        structuredClone(captured),
        published2 && Object.freeze({ ...published2 })
      );
      if (!published2) options.signal.throwIfAborted();
      if ((await instance(tx).read()).instanceId !== captured.instanceId)
        throw new ReferenceSetError("conflict", "Storage instance changed during upload");
      for (const item of prepared)
        for (const intent of item.intents) await writes(tx).assertWritable(intent, intent.generation);
      if (!published2) options.signal.throwIfAborted();
    }
    await options.transaction(async (tx) => {
      const registry = new StorageBackendRegistry(options.executor(tx), options.dialect, options.namespace);
      for (const item of prepared) await registry.register(item.backend);
      await validate(tx);
      for (const item of prepared)
        for (const intent of item.intents)
          if (await writes(tx).begin(intent, intent.generation) !== "created")
            throw new ReferenceSetError("conflict", "Storage artifact operation has already started");
    });
    const urls = {};
    for (const [index, item] of prepared.entries()) {
      try {
        options.signal.throwIfAborted();
      } catch (error) {
        await settle(index, "not_created", error);
        throw error;
      }
      try {
        urls[item.artifact.name] = await item.writer.write(
          item.key,
          item.artifact.body,
          item.artifact.contentType,
          options.signal
        );
      } catch (error) {
        const outcome = item.backend.descriptor.kind === "local" && error instanceof LocalStorageWriteError ? error.created ? "unreferenced" : "not_created" : "uncertain";
        await settle(index, outcome, error);
        throw error;
      }
      if (verifyArtifact) {
        try {
          options.signal.throwIfAborted();
          await verifyArtifact(
            structuredClone({
              name: item.artifact.name,
              operationId: item.artifact.operationId,
              reference: urls[item.artifact.name],
              target: { backendId: item.backend.id, binding: item.backend.binding, key: item.key },
              descriptor: item.backend.descriptor
            }),
            options.signal
          );
          options.signal.throwIfAborted();
        } catch (error) {
          await settle(index, "unreferenced", error);
          throw error;
        }
      }
    }
    async function settle(failedIndex, failedOutcome, originalError) {
      await options.transaction(async (tx) => {
        for (const [index, item] of prepared.entries()) {
          const kind = index < failedIndex ? "unreferenced" : index === failedIndex ? failedOutcome : "not_created";
          for (const intent of item.intents) await writes(tx).finish(intent, { kind });
        }
      }).catch((settlementError) => {
        throw new AggregateError(
          [originalError, settlementError],
          "Storage failure settlement could not commit",
          { cause: originalError }
        );
      });
    }
    const published = Object.freeze({ ...urls });
    try {
      await options.transaction(async (tx) => {
        await validate(tx);
        const registry = new StorageReferenceRegistry(
          options.executor(tx),
          options.dialect,
          options.namespace
        );
        for (const item of prepared) {
          const reference = prepareStorageReference({
            namespace: options.namespace,
            operationId: item.artifact.operationId,
            reference: published[item.artifact.name],
            ...item.writer.localRoutePrefix ? { localRoutePrefix: item.writer.localRoutePrefix } : {},
            target: { backendId: item.backend.id, binding: item.backend.binding, key: item.key },
            scopes: [...captured.scopes]
          });
          await registry.replaceMany({ consumers: item.consumers, next: reference });
        }
        for (const retirement of retirements) await registry.retire(retirement);
        options.signal.throwIfAborted();
        await options.commit(tx, published, structuredClone(captured.snapshot));
        options.signal.throwIfAborted();
        for (const item of prepared)
          for (const intent of item.intents)
            if (await writes(tx).finish(intent, {
              kind: "referenced",
              currentGeneration: intent.generation
            }) !== "removed")
              throw new ReferenceSetError("conflict", "Storage ownership changed during publication");
        options.signal.throwIfAborted();
      });
    } catch (error) {
      const committed = await options.transaction(async (tx) => {
        const receipts = [];
        for (const item of prepared)
          for (const intent of item.intents) receipts.push(await writes(tx).completion(intent));
        if (receipts.every((receipt) => receipt === "referenced")) {
          await validate(tx, published);
          return true;
        }
        if (receipts.some((receipt) => receipt !== null))
          throw new Error("Storage set commit outcome is inconsistent");
        for (const item of prepared)
          for (const intent of item.intents) await writes(tx).finish(intent, { kind: "unreferenced" });
        return false;
      }).catch((recoveryError) => {
        throw new AggregateError(
          [error, recoveryError],
          "Storage publication outcome could not be reconciled",
          { cause: error }
        );
      });
      if (!committed) throw error;
    }
    return published;
  } finally {
    for (const artifact of options.artifacts) if (artifact.body instanceof Readable) artifact.body.destroy();
  }
}
var digest2 = z.string().regex(/^[a-f0-9]{64}$/);
var identity2 = z.string().min(1).max(200);
var contentSchema = z.object({ sha256: digest2, bytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
var proofSchema = contentSchema.extend({ assetId: digest2 }).strict();
var scopeSchema = z.object({ subjectId: identity2, generation: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }).strict();
var inputSchema = z.object({
  operationId: z.uuid(),
  sourceAssetId: digest2,
  destinationAssetId: digest2,
  consumers: z.array(identity2).min(1).max(100),
  sourceRead: proofSchema,
  destinationRead: proofSchema
}).strict();
var receiptSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("storage_relocation"),
  namespace: identity2,
  operationId: z.uuid(),
  sourceAssetId: digest2,
  destinationAssetId: digest2,
  consumers: z.array(identity2).min(1).max(100),
  content: contentSchema,
  scopes: z.array(scopeSchema).min(1).max(2e3)
}).strict();
var successorSchema = z.object({ operationId: z.uuid() }).strict();
var allocationSchema2 = z.object({ schemaVersion: z.literal(1), kind: z.literal("storage_relocation_allocation") }).strict();
var scopeIndexSchema = scopeSchema.extend({ namespace: identity2, operationId: z.uuid() }).strict();
function hash2(value) {
  return createHash("sha256").update(value).digest("hex");
}
function combinedScopes(scopes) {
  const values = /* @__PURE__ */ new Map();
  for (const scope3 of scopes) {
    if (values.has(scope3.subjectId) && values.get(scope3.subjectId) !== scope3.generation)
      throw new Error("Storage relocation ownership generations conflict");
    values.set(scope3.subjectId, scope3.generation);
  }
  return [...values].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([subjectId, generation2]) => ({ subjectId, generation: generation2 }));
}
var StorageRelocationRegistry = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.prefix = hash2(identity2.parse(namespace));
    this.references = new StorageReferenceRegistry(database, dialect, namespace);
    this.writes = new StorageWriteJournal(database, dialect, namespace);
  }
  database;
  dialect;
  namespace;
  prefix;
  references;
  writes;
  receipt(operationId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-rel:1:${this.prefix}:${z.uuid().parse(operationId)}`
    );
  }
  allocation(operationId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-rel-allocation:1:${this.prefix}:${z.uuid().parse(operationId)}`
    );
  }
  successor(assetId2, consumer) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-rels:1:${this.prefix}:${hash2(JSON.stringify([assetId2, consumer]))}`
    );
  }
  scopePrefix(subjectId) {
    return `sd-rel-scope:1:${this.prefix}:${hash2(identity2.parse(subjectId))}:`;
  }
  async remove(id, revision) {
    const parameter = (position) => this.dialect === "postgres" ? `$${position}` : "?";
    const rows = await this.database.query(
      `DELETE FROM "SidedoorState" WHERE "id" = ${parameter(1)} AND "revision" = ${parameter(2)} RETURNING "id"`,
      [id, revision]
    );
    if (rows.length !== 1) throw new Error("Storage relocation changed during erasure");
  }
  /** Retain cleanup dependencies and erase one bounded page in the caller's Serializable transaction. */
  async eraseForSubject(input) {
    const value = z.object({
      subjectId: identity2,
      generation: scopeSchema.shape.generation,
      jobId: z.uuid(),
      epoch: scopeSchema.shape.generation,
      after: z.string().nullable().optional()
    }).strict().parse(input);
    const journal = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const job = await journal.get(value.jobId);
    const tombstone = await this.writes.tombstone(value.subjectId);
    if (job.subjectId !== value.subjectId || job.generation !== value.generation || job.epoch !== value.epoch || job.phase !== "preparing" || job.retentionPolicy !== "job-id-snapshots-v1" || tombstone?.jobId !== job.id || tombstone.generation !== value.generation)
      throw new Error("Storage relocation erasure does not match the cleanup authority");
    const page = await this.listForSubject(value.subjectId, value.after ?? null);
    const manifests = new CleanupManifests(this.database, this.dialect, this.namespace);
    let erased = 0;
    for (const receipt of page.receipts) {
      if (!receipt.scopes.some(
        (scope3) => scope3.subjectId === value.subjectId && scope3.generation === value.generation
      ))
        continue;
      const allocation = await this.allocation(receipt.operationId).read();
      if (!allocation) throw new Error("Storage relocation allocation evidence is missing");
      allocationSchema2.parse(allocation.state);
      const entries = [];
      for (const [role, assetId2] of [
        ["source", receipt.sourceAssetId],
        ["destination", receipt.destinationAssetId]
      ]) {
        const asset = await this.references.readAsset(assetId2);
        entries.push(
          z.json().parse({
            kind: "storage_relocation_dependency",
            operationId: receipt.operationId,
            role,
            assetId: assetId2,
            scopes: receipt.scopes,
            prepared: asset?.asset.prepared ?? null
          })
        );
      }
      for (const manifest of prepareStorageManifestPages(`relocation:${receipt.operationId}`, entries)) {
        await journal.recordManifestPage(job.id, job.epoch, manifest);
        const saved2 = await manifests.get(job, manifest.id);
        if (!isDeepStrictEqual(saved2.page.entries, manifest.entries))
          throw new Error("Storage relocation cleanup dependencies do not match");
      }
      for (const scope3 of receipt.scopes) {
        const id = `${this.scopePrefix(scope3.subjectId)}${receipt.operationId}`;
        const row = await sqlStateBackend(this.database, this.dialect, id).read();
        if (!row || !isDeepStrictEqual(scopeIndexSchema.parse(row.state), {
          namespace: this.namespace,
          operationId: receipt.operationId,
          ...scope3
        }))
          throw new Error("Storage relocation scope index does not match during erasure");
        await this.remove(id, row.revision);
      }
      for (const consumer of receipt.consumers) {
        const row = await this.successor(receipt.sourceAssetId, consumer).read();
        if (row && successorSchema.parse(row.state).operationId === receipt.operationId)
          await this.remove(
            `sd-rels:1:${this.prefix}:${hash2(JSON.stringify([receipt.sourceAssetId, consumer]))}`,
            row.revision
          );
      }
      const saved = await this.receipt(receipt.operationId).read();
      if (!saved || !isDeepStrictEqual(receiptSchema.parse(saved.state), receipt))
        throw new Error("Storage relocation receipt changed during erasure");
      await this.remove(`sd-rel:1:${this.prefix}:${receipt.operationId}`, saved.revision);
      erased++;
    }
    return { erased, cursor: page.cursor };
  }
  /** Bounded discovery remains available after tombstoning for the owning erasure workflow. */
  async listForSubject(subjectId, after = null) {
    const prefix = this.scopePrefix(subjectId);
    const rows = await cleanupRows(this.database, this.dialect, prefix, after, 100, "uuid");
    const receipts = [];
    for (const row of rows) {
      const index = scopeIndexSchema.parse(
        this.dialect === "sqlite" && typeof row.state === "string" ? JSON.parse(row.state) : row.state
      );
      if (index.namespace !== this.namespace || index.subjectId !== subjectId || row.id !== `${prefix}${index.operationId}`)
        throw new Error("Storage relocation scope index does not match");
      const saved = await this.receipt(index.operationId).read();
      if (!saved) throw new Error("Storage relocation scope has no receipt");
      const receipt = receiptSchema.parse(saved.state);
      if (receipt.namespace !== this.namespace || receipt.operationId !== index.operationId || !receipt.scopes.some(
        (scope3) => scope3.subjectId === subjectId && scope3.generation === index.generation
      ))
        throw new Error("Storage relocation scope attribution does not match");
      receipts.push(receipt);
    }
    return { receipts, cursor: rows.length === 100 ? String(rows.at(-1).id) : null };
  }
  async validate(receipt) {
    if (receipt.namespace !== this.namespace || receipt.sourceAssetId === receipt.destinationAssetId || new Set(receipt.consumers).size !== receipt.consumers.length)
      throw new Error("Storage relocation identity is invalid");
    const source = await this.references.readAsset(receipt.sourceAssetId);
    const destination = await this.references.readAsset(receipt.destinationAssetId);
    if (!source || !destination || destination.asset.prepared.operationId !== receipt.operationId)
      throw new Error("Storage relocation assets do not match the operation");
    if (!isDeepStrictEqual(
      receipt.scopes,
      combinedScopes([...source.asset.prepared.scopes, ...destination.asset.prepared.scopes])
    ))
      throw new Error("Storage relocation scope evidence does not match its assets");
    const allocation = await this.references.readAllocation(receipt.destinationAssetId);
    const claims = receipt.consumers.map((consumer) => ({
      consumer,
      previousReference: source.asset.prepared.reference
    }));
    if (!allocation || allocation.operationId !== receipt.operationId || !isDeepStrictEqual(allocation.claims, claims))
      throw new Error("Storage relocation replacement claims do not match");
    for (const scope3 of source.asset.prepared.scopes)
      if (!destination.asset.prepared.scopes.some((value) => isDeepStrictEqual(value, scope3)))
        throw new Error("Storage relocation dropped an ownership scope");
    for (const scope3 of [...source.asset.prepared.scopes, ...destination.asset.prepared.scopes])
      if (await this.writes.tombstone(scope3.subjectId))
        throw new Error("Storage relocation ownership was erased");
    for (const consumer of receipt.consumers) {
      const retirement = await this.references.readRetirement(receipt.operationId, consumer);
      if (!retirement || retirement.status !== "pending" || retirement.replacementAssetId !== receipt.destinationAssetId || retirement.previousReference !== source.asset.prepared.reference || retirement.attribution?.assetId !== receipt.sourceAssetId || !isDeepStrictEqual(retirement.attribution.prepared, source.asset.prepared))
        throw new Error("Storage relocation has no exact source retirement");
    }
    return { source, destination };
  }
  async record(input) {
    const value = inputSchema.parse(input);
    value.consumers.sort();
    if (value.sourceRead.assetId !== value.sourceAssetId || value.destinationRead.assetId !== value.destinationAssetId || value.sourceRead.sha256 !== value.destinationRead.sha256 || value.sourceRead.bytes !== value.destinationRead.bytes)
      throw new Error("Storage relocation readback does not match the captured source");
    const original = await this.references.readAsset(value.sourceAssetId);
    const replacement = await this.references.readAsset(value.destinationAssetId);
    if (!original || !replacement) throw new Error("Storage relocation assets are missing");
    const receipt = receiptSchema.parse({
      schemaVersion: 1,
      kind: "storage_relocation",
      namespace: this.namespace,
      operationId: value.operationId,
      sourceAssetId: value.sourceAssetId,
      destinationAssetId: value.destinationAssetId,
      consumers: value.consumers,
      content: { sha256: value.sourceRead.sha256, bytes: value.sourceRead.bytes },
      scopes: combinedScopes([...original.asset.prepared.scopes, ...replacement.asset.prepared.scopes])
    });
    const backend = this.receipt(value.operationId);
    const existing = await backend.read();
    const allocation = this.allocation(value.operationId);
    const allocated = await allocation.read();
    if (allocated) allocationSchema2.parse(allocated.state);
    if (existing && !allocated) throw new Error("Storage relocation allocation evidence is missing");
    if (allocated && !existing) throw new Error("Storage relocation operation was already allocated");
    if (existing && !isDeepStrictEqual(receiptSchema.parse(existing.state), receipt))
      throw new Error("Storage relocation receipt already records different evidence");
    const { source, destination } = await this.validate(receipt);
    if (!existing && (source.asset.consumers.length !== 0 || !isDeepStrictEqual([...destination.asset.consumers].sort(), receipt.consumers)))
      throw new Error("Storage relocation must transfer the complete captured consumer set");
    for (const consumer of receipt.consumers) {
      const successor = this.successor(receipt.sourceAssetId, consumer);
      const row = await successor.read();
      if (row) {
        if (successorSchema.parse(row.state).operationId !== receipt.operationId)
          throw new Error("Storage relocation has a conflicting successor");
      } else if (existing) throw new Error("Storage relocation successor evidence is missing");
      else if (!await successor.compareAndSwap(null, {
        revision: randomUUID(),
        state: { operationId: receipt.operationId }
      }))
        throw new Error("Storage relocation successor changed concurrently");
    }
    for (const scope3 of receipt.scopes) {
      const indexBackend = sqlStateBackend(
        this.database,
        this.dialect,
        `${this.scopePrefix(scope3.subjectId)}${receipt.operationId}`
      );
      const index = { namespace: this.namespace, operationId: receipt.operationId, ...scope3 };
      const row = await indexBackend.read();
      if (row) {
        if (!isDeepStrictEqual(scopeIndexSchema.parse(row.state), index))
          throw new Error("Storage relocation scope index changed");
      } else if (existing) throw new Error("Storage relocation scope index is missing");
      else if (!await indexBackend.compareAndSwap(null, { revision: randomUUID(), state: index }))
        throw new Error("Storage relocation scope index changed concurrently");
    }
    if (!existing && !await backend.compareAndSwap(null, { revision: randomUUID(), state: receipt }))
      throw new Error("Storage relocation receipt changed concurrently");
    if (!allocated && !await allocation.compareAndSwap(null, {
      revision: randomUUID(),
      state: { schemaVersion: 1, kind: "storage_relocation_allocation" }
    }))
      throw new Error("Storage relocation allocation changed concurrently");
  }
  /** Ordinary replacements have no relocation edge and never prove equivalent content. */
  async resolve(input) {
    const maxHops = z.number().int().min(1).max(1e4).parse(input.maxHops);
    const requiredOperation = inputSchema.pick({ operationId: true, sourceAssetId: true, destinationAssetId: true }).optional().parse(input.requiredOperation);
    let matchedOperation = requiredOperation === void 0;
    const signal = input.signal;
    signal?.throwIfAborted();
    const consumer = identity2.parse(input.consumer);
    const originalReference = z.string().min(1).parse(input.originalReference);
    const currentReference = z.string().min(1).parse(input.currentReference);
    const current = await this.references.resolve({ consumer, reference: currentReference });
    signal?.throwIfAborted();
    if (!current) return null;
    const original = await this.references.readReference(originalReference);
    signal?.throwIfAborted();
    if (!original) return null;
    let assetId2 = original.asset.id;
    let content = null;
    const visited = /* @__PURE__ */ new Set();
    while (assetId2 !== current.assetId) {
      signal?.throwIfAborted();
      if (visited.has(assetId2)) throw new Error("Storage relocation chain contains a cycle");
      if (visited.size >= maxHops)
        throw new Error("Storage relocation chain exceeds the configured traversal limit");
      visited.add(assetId2);
      const successor = await this.successor(assetId2, consumer).read();
      signal?.throwIfAborted();
      if (!successor) return null;
      const edge = successorSchema.parse(successor.state);
      const row = await this.receipt(edge.operationId).read();
      if (!row) throw new Error("Storage relocation receipt is missing");
      const receipt = receiptSchema.parse(row.state);
      if (receipt.operationId !== edge.operationId || receipt.sourceAssetId !== assetId2 || !receipt.consumers.includes(consumer))
        throw new Error("Storage relocation chain identity does not match");
      await this.validate(receipt);
      if (requiredOperation && receipt.operationId === requiredOperation.operationId && receipt.sourceAssetId === requiredOperation.sourceAssetId && receipt.destinationAssetId === requiredOperation.destinationAssetId)
        matchedOperation = true;
      if (content && !isDeepStrictEqual(content, receipt.content))
        throw new Error("Storage relocation chain content changed");
      content = receipt.content;
      assetId2 = receipt.destinationAssetId;
    }
    for (const scope3 of current.prepared.scopes)
      if (await this.writes.tombstone(scope3.subjectId))
        throw new Error("Storage relocation ownership was erased");
    signal?.throwIfAborted();
    if (!matchedOperation) return null;
    return { originalAssetId: original.asset.id, current, content };
  }
};
var locationSchema = z.object({
  version: z.literal(1),
  locationId: z.uuid(),
  root: z.object({ root: z.string(), device: z.string(), inode: z.string(), binding: z.string() }).strict()
}).strict();
async function openExecutionLocation(input, options = {}) {
  const requested = resolve(input);
  const { create = false, signal } = options;
  signal?.throwIfAborted();
  const parent = await LocalStorageCleanup.capture(dirname(requested));
  const path = join(parent.identity.root, basename(requested));
  return withFileLock(
    `${path}.guard`,
    async () => {
      await LocalStorageCleanup.restore(parent.identity);
      signal?.throwIfAborted();
      let created = false;
      if (create) {
        try {
          await mkdir(path, { mode: 448 });
          created = true;
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
        }
      }
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 4095) !== 448)
        throw new Error("Execution location must be a private regular directory");
      const root = (await LocalStorageCleanup.capture(path)).identity;
      const marker = join(path, "location.json");
      const file = await open(
        marker,
        (created ? constants.O_RDWR | constants.O_CREAT | constants.O_EXCL : constants.O_RDONLY) | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        384
      );
      let result;
      let failure;
      try {
        if (created) {
          await file.writeFile(JSON.stringify({ version: 1, locationId: randomUUID(), root }));
          await file.sync();
          syncDirectory(path);
          syncDirectory(parent.identity.root);
        }
        const stat = await file.stat();
        if (!stat.isFile() || (stat.mode & 4095) !== 384 || stat.size < 1 || stat.size > 4096)
          throw new Error("Execution location marker must be a private bounded regular file");
        const bytes = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < bytes.length) {
          const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
          if (!bytesRead) throw new Error("Execution location marker changed while reading");
          offset += bytesRead;
        }
        const location = locationSchema.parse(JSON.parse(bytes.toString("utf8")));
        await LocalStorageCleanup.restore(location.root);
        if (location.root.root !== root.root || location.root.device !== root.device || location.root.inode !== root.inode || location.root.binding !== root.binding)
          throw new Error("Execution location marker belongs to another root");
        await LocalStorageCleanup.restore(parent.identity);
        signal?.throwIfAborted();
        result = { locationId: location.locationId, root };
      } catch (error) {
        failure = { error };
      }
      try {
        await file.close();
      } catch (error) {
        const cleanup = new StorageReadCleanupError({ cause: error });
        if (failure)
          throw new AggregateError([failure.error, cleanup], "Execution location read and cleanup failed", {
            cause: error
          });
        throw cleanup;
      }
      if (failure) throw failure.error;
      return result;
    },
    { signal }
  );
}
var LocalStorageReader = class _LocalStorageReader {
  constructor(identity4) {
    this.identity = identity4;
  }
  identity;
  static async restore(identity4) {
    return new _LocalStorageReader((await LocalStorageCleanup.restore(identity4)).identity);
  }
  async copyToFile(key, destination, signal) {
    signal?.throwIfAborted();
    validateStorageKey(key);
    const root = await LocalStorageCleanup.restore(this.identity);
    if (!await root.has(key)) throw new Error("Storage source does not exist");
    const source = join(this.identity.root, key);
    return copyOwnedBytesToFile({
      destination,
      signal,
      openSource: async () => {
        const buffer = Buffer.allocUnsafe(65536);
        const file = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
        let validated = false;
        return {
          close: () => file.close(),
          read: async () => {
            if (!validated) {
              const opened = await file.stat({ bigint: true });
              const current = await lstat(source, { bigint: true });
              if (!opened.isFile() || current.isSymbolicLink() || opened.dev !== current.dev || opened.ino !== current.ino)
                throw new Error("Storage source changed while opening");
              if (!await root.has(key)) throw new Error("Storage source disappeared while opening");
              await LocalStorageCleanup.restore(this.identity);
              signal?.throwIfAborted();
              validated = true;
            }
            const { bytesRead } = await file.read(buffer, 0, buffer.length, null);
            if (bytesRead) return buffer.subarray(0, bytesRead);
            await LocalStorageCleanup.restore(this.identity);
            return null;
          }
        };
      }
    });
  }
};
var identity3 = z.string().min(1).max(200);
var generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var scope2 = z.object({ subjectId: identity3, generation }).strict();
var dependency = z.object({
  kind: z.literal("storage_relocation_dependency"),
  operationId: z.uuid(),
  role: z.enum(["source", "destination"]),
  assetId: z.string().regex(/^[a-f0-9]{64}$/),
  scopes: z.array(scope2).min(1).max(2e3),
  prepared: z.unknown()
}).strict();
var StorageCleanupAttribution = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
  }
  database;
  dialect;
  namespace;
  async inspectPage(input) {
    const value = z.object({ jobId: z.uuid(), epoch: generation, subjectId: identity3, generation, pageId: identity3 }).strict().parse(input);
    const journal = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const job = await journal.get(value.jobId);
    const tombstone = await new StorageWriteJournal(this.database, this.dialect, this.namespace).tombstone(
      value.subjectId
    );
    if (job.epoch !== value.epoch || job.subjectId !== value.subjectId || job.generation !== value.generation || job.phase !== "preparing" || job.retentionPolicy !== "job-id-snapshots-v1" || tombstone?.jobId !== job.id || tombstone.generation !== value.generation)
      throw new Error("Storage attribution does not match cleanup authority");
    const { page } = await new CleanupManifests(this.database, this.dialect, this.namespace).get(
      job,
      value.pageId
    );
    const references = new StorageReferenceRegistry(this.database, this.dialect, this.namespace);
    const entries = [];
    for (const [index, entry] of page.entries.entries()) {
      const kind = entry && typeof entry === "object" && !Array.isArray(entry) ? entry.kind : void 0;
      let attribution;
      if (kind === "storage_asset" || kind === "storage_reference_retirement") {
        attribution = storageSnapshotAttribution(entry, this.namespace);
      } else if (kind === "storage_relocation_dependency") {
        const saved = dependency.parse(entry);
        if (!saved.scopes.some(
          (item) => item.subjectId === job.subjectId && item.generation === job.generation
        ) || new Set(saved.scopes.map((item) => item.subjectId)).size !== saved.scopes.length)
          throw new Error("Storage relocation dependency ownership mismatch");
        if (saved.prepared === null) {
          entries.push({ index, status: "unresolved", reason: "missing_attribution" });
          continue;
        }
        const prepared = prepareStorageReference(
          saved.prepared
        );
        if (saved.role === "destination" && prepared.operationId !== saved.operationId)
          throw new Error("Storage relocation destination operation mismatch");
        if (prepared.scopes.some(
          (item) => !saved.scopes.some(
            (other) => other.subjectId === item.subjectId && other.generation === item.generation
          )
        ))
          throw new Error("Storage relocation dependency scopes mismatch");
        attribution = { assetId: saved.assetId, prepared };
      } else {
        entries.push({ index, status: "unresolved", reason: "unsupported_entry" });
        continue;
      }
      if (!attribution) {
        entries.push({ index, status: "unresolved", reason: "missing_attribution" });
        continue;
      }
      const validated = await references.validateRetainedAttribution(attribution);
      if (!validated.prepared.scopes.some(
        (item) => item.subjectId === job.subjectId && item.generation === job.generation
      ))
        throw new Error("Storage attribution does not belong to the cleanup subject");
      const current = await references.readAsset(validated.assetId);
      if (current?.asset.consumers.length) {
        entries.push({ index, status: "unresolved", reason: "live_consumers" });
        continue;
      }
      entries.push({
        index,
        status: "attributed",
        target: validated.prepared.target,
        backend: validated.backend
      });
    }
    return { pageId: page.id, entries };
  }
};
var PostgresConnectionCleanupError = class extends Error {
  constructor(options) {
    super("PostgreSQL session closure is unconfirmed", options);
    this.name = "PostgresConnectionCleanupError";
  }
};
async function bounded(operation, ms, message) {
  let timer;
  try {
    return await new Promise((resolve4, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
      operation.then(resolve4, reject);
    });
  } finally {
    clearTimeout(timer);
  }
}
async function openPostgresDedicatedConnection(client, timeouts) {
  const limits = z.object({
    connectMs: z.number().int().min(1).max(6e4),
    queryMs: z.number().int().min(1).max(6e4),
    closeMs: z.number().int().min(1).max(6e4)
  }).strict().parse(timeouts);
  const connect = client.connect.bind(client);
  const query = client.query.bind(client);
  const end = client.end.bind(client);
  const listeners = /* @__PURE__ */ new Set();
  let failure;
  let closing;
  function lose(error) {
    if (failure) return;
    failure = error;
    for (const listener of listeners) listener(error);
  }
  const removeError = client.onError(lose);
  const removeEnd = client.onEnd(() => lose(new Error("PostgreSQL session ended")));
  const connecting = Promise.resolve().then(connect);
  async function close() {
    if (!closing) {
      lose(new Error("PostgreSQL session is closing"));
      closing = connecting.catch(() => void 0).then(end).then(() => {
        removeError();
        removeEnd();
      });
    }
    try {
      await bounded(closing, limits.closeMs, "PostgreSQL close deadline expired");
    } catch (error) {
      throw new PostgresConnectionCleanupError({ cause: error });
    }
  }
  async function fail(error) {
    lose(error instanceof Error ? error : new Error("PostgreSQL operation failed", { cause: error }));
    try {
      await close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "PostgreSQL operation and cleanup failed", {
        cause: closeError
      });
    }
    throw error;
  }
  try {
    await bounded(connecting, limits.connectMs, "PostgreSQL connect deadline expired");
    if (failure) throw failure;
  } catch (error) {
    return fail(error);
  }
  return {
    onLoss(listener) {
      listeners.add(listener);
      if (failure) listener(failure);
      return () => {
        listeners.delete(listener);
      };
    },
    async query(sql, values) {
      if (failure) throw failure;
      const parameters = [...values];
      try {
        const rows = await bounded(
          Promise.resolve().then(() => {
            if (failure) throw failure;
            return query(sql, parameters);
          }),
          limits.queryMs,
          "PostgreSQL query deadline expired"
        );
        if (failure) throw failure;
        return rows;
      } catch (error) {
        return fail(error);
      }
    },
    close
  };
}
async function acquirePostgresBackendLock(options) {
  const namespace = z.string().min(1).max(200).parse(options.namespace);
  const binding2 = z.string().regex(/^[a-f0-9]{64}$/).parse(options.binding);
  const acquisitionSignal = options.signal;
  const openConnection = options.openConnection;
  acquisitionSignal?.throwIfAborted();
  const key = createHash("sha256").update(JSON.stringify(["sidedoor-cleanup", namespace, binding2])).digest().readBigInt64BE().toString();
  const connection = await openConnection();
  const lifetime = new AbortController();
  let unsubscribe;
  let closing;
  function release() {
    if (closing) return closing;
    lifetime.abort(new Error("Backend lock was released"));
    closing = (async () => {
      await connection.close();
      unsubscribe?.();
    })();
    return closing;
  }
  try {
    unsubscribe = connection.onLoss((error) => lifetime.abort(error));
    acquisitionSignal?.throwIfAborted();
    lifetime.signal.throwIfAborted();
    const rows = await connection.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [key]);
    acquisitionSignal?.throwIfAborted();
    lifetime.signal.throwIfAborted();
    if (rows.length !== 1 || rows[0]?.acquired !== true)
      throw new Error("Storage backend is owned by another cleanup connection");
    return {
      signal: lifetime.signal,
      assertHeld: () => lifetime.signal.throwIfAborted(),
      release
    };
  } catch (error) {
    try {
      await release();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "Backend lock acquisition and closure failed", {
        cause: closeError
      });
    }
    throw error;
  }
}
var bindingSchema = z.object({
  executionId: z.uuid(),
  executorId: z.uuid(),
  jobId: z.uuid(),
  backendBinding: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
var evidenceSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["remote-operations-settled", "stopped-before-dispatch"])
}).strict();
var recordSchema = bindingSchema.extend({
  status: z.enum(["active", "unconfirmed", "settled"]),
  resolution: evidenceSchema.optional()
}).strict();
var gateSchema = z.object({ executionId: z.uuid(), settled: z.boolean() }).strict();
var backendBindingSchema = z.string().regex(/^[a-f0-9]{64}$/);
var CleanupExecutionJournal = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    this.prefix = cleanupHash(z.string().min(1).max(200).parse(namespace));
  }
  database;
  dialect;
  namespace;
  prefix;
  execution(id) {
    return sqlStateBackend(this.database, this.dialect, `sd-ce:1:${this.prefix}:${z.uuid().parse(id)}`);
  }
  gate(backendBinding) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-ceg:1:${this.prefix}:${backendBindingSchema.parse(backendBinding)}`
    );
  }
  async read(input) {
    const binding2 = bindingSchema.parse(input);
    const row = await this.execution(binding2.executionId).read();
    if (!row) return null;
    const record = recordSchema.parse(row.state);
    for (const field of Object.keys(binding2))
      if (record[field] !== binding2[field]) throw new Error("Cleanup execution identity does not match");
    return record;
  }
  async assertOwned(input) {
    const binding2 = bindingSchema.parse(input);
    const record = await this.read(binding2);
    const row = await this.gate(binding2.backendBinding).read();
    const gate = row ? gateSchema.parse(row.state) : null;
    if (!record || record.status !== "active" || !gate || gate.settled || gate.executionId !== binding2.executionId)
      throw new Error("Cleanup execution no longer owns this backend");
  }
  /** Read the execution holding a physical backend gate, including unresolved recovery state. */
  async current(backendBinding) {
    const binding2 = backendBindingSchema.parse(backendBinding);
    const row = await this.gate(binding2).read();
    if (!row) return null;
    const gate = gateSchema.parse(row.state);
    const execution = await this.execution(gate.executionId).read();
    if (!execution) throw new Error("Cleanup execution gate has no execution record");
    const record = recordSchema.parse(execution.state);
    if (record.backendBinding !== binding2) throw new Error("Cleanup execution gate identity does not match");
    if (gate.settled !== (record.status === "settled"))
      throw new Error("Cleanup execution gate state does not match");
    return record;
  }
  /** Check ownership and persist observed deletion in this same Serializable transaction. */
  async acknowledgeTarget(input, ticket) {
    const binding2 = bindingSchema.parse(input);
    if (binding2.jobId !== ticket.jobId || binding2.backendBinding !== ticket.target.binding)
      throw new Error("Cleanup execution does not own this deletion ticket");
    await this.assertOwned(binding2);
    await new StorageCleanupJournal(this.database, this.dialect, this.namespace).acknowledgeTarget(ticket);
  }
  /** All registered backend destinations must have active ownership before a phase can advance. */
  async transition(jobId, epoch, inputs) {
    const bindings = z.array(bindingSchema).min(1).max(1e3).parse(inputs);
    if (bindings.some((binding2) => binding2.jobId !== jobId) || new Set(bindings.map((binding2) => binding2.backendBinding)).size !== bindings.length)
      throw new Error("Cleanup phase ownership does not match the job");
    for (const binding2 of bindings) await this.assertOwned(binding2);
    const cleanup = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const registry = new StorageBackendRegistry(this.database, this.dialect, this.namespace);
    const covered = new Set(bindings.map((binding2) => binding2.backendBinding));
    let cursor = null;
    do {
      const page = await cleanup.listCollectors(jobId, cursor);
      for (const collector of page.collectors) {
        for (const id of collector.backendIds) {
          const backend = await registry.get(id);
          if (!backend || !covered.has(backend.binding))
            throw new Error("Cleanup phase requires ownership of every registered backend");
        }
      }
      cursor = page.cursor;
    } while (cursor !== null);
    return cleanup.transition(jobId, epoch);
  }
  /** Repeated admission recovers ownership only. It never authorizes repeating external I/O. */
  async begin(input) {
    const binding2 = bindingSchema.parse(input);
    const previous = await this.read(binding2);
    if (previous) {
      await this.assertOwned(binding2);
      return previous;
    }
    const cleanup = new StorageCleanupJournal(this.database, this.dialect, this.namespace);
    const job = await cleanup.get(binding2.jobId);
    if (job.phase === "complete") throw new Error("Completed cleanup cannot start an execution");
    const registry = new StorageBackendRegistry(this.database, this.dialect, this.namespace);
    let cursor = null;
    let covered = false;
    do {
      const page = await cleanup.listCollectors(job.id, cursor);
      for (const collector of page.collectors) {
        for (const id of collector.backendIds) {
          const backend = await registry.get(id);
          if (backend?.binding === binding2.backendBinding) covered = true;
        }
      }
      cursor = page.cursor;
    } while (!covered && cursor !== null);
    if (!covered) throw new Error("Cleanup execution backend has no registered collector");
    const gateBackend = this.gate(binding2.backendBinding);
    const gateRow = await gateBackend.read();
    if (gateRow && !gateSchema.parse(gateRow.state).settled)
      throw new Error("Backend has an unresolved cleanup execution");
    const record = { ...binding2, status: "active" };
    if (!await this.execution(binding2.executionId).compareAndSwap(null, {
      revision: randomUUID(),
      state: record
    }) || !await gateBackend.compareAndSwap(gateRow?.revision ?? null, {
      revision: randomUUID(),
      state: { executionId: binding2.executionId, settled: false }
    }))
      throw new Error("Cleanup execution admission changed concurrently");
    return record;
  }
  async update(input, status, evidence) {
    const binding2 = bindingSchema.parse(input);
    const record = await this.read(binding2);
    if (!record) throw new Error("Cleanup execution is missing");
    if (record.status === "settled") {
      if (status === "settled" && JSON.stringify(record.resolution) === JSON.stringify(evidence)) return;
      throw new Error("Cleanup execution is already settled");
    }
    const backend = this.execution(binding2.executionId);
    const row = await backend.read();
    const gateBackend = this.gate(binding2.backendBinding);
    const gateRow = await gateBackend.read();
    const gate = gateRow ? gateSchema.parse(gateRow.state) : null;
    if (!row || !gate || gate.settled || gate.executionId !== binding2.executionId)
      throw new Error("Cleanup execution no longer owns this backend");
    if (!await backend.compareAndSwap(row.revision, {
      revision: randomUUID(),
      state: { ...record, status, ...evidence ? { resolution: evidence } : {} }
    }))
      throw new Error("Cleanup execution changed concurrently");
    if (status === "settled" && !await gateBackend.compareAndSwap(gateRow.revision, {
      revision: randomUUID(),
      state: { executionId: binding2.executionId, settled: true }
    }))
      throw new Error("Cleanup execution gate changed concurrently");
  }
  async markUnconfirmed(binding2) {
    await this.update(binding2, "unconfirmed");
  }
  /** Original executor observed every dispatched operation settle, including after uncertainty. */
  async settle(binding2) {
    await this.update(binding2, "settled");
  }
  /** Caller authorizes and persists exact remote-operation evidence. Process death alone is insufficient. */
  async resolveUnconfirmed(binding2, evidence) {
    await this.update(binding2, "settled", evidenceSchema.parse(evidence));
  }
};

// src/storage/cleanup/backends/probe-cleanup.ts
async function cleanupStorageProbe(input) {
  const options = { ...input, target: { ...input.target }, execution: { ...input.execution } };
  const journal = (tx) => new StorageCleanupJournal(options.executor(tx), options.dialect, options.namespace);
  const executions = (tx) => new CleanupExecutionJournal(options.executor(tx), options.dialect, options.namespace);
  const inspect = () => options.transaction(async (tx) => {
    const store = journal(tx);
    const job = await store.get(options.jobId);
    if (options.execution.jobId !== job.id || options.execution.backendBinding !== options.target.binding)
      throw new Error("Storage probe execution does not match cleanup");
    if (job.phase !== "complete") await executions(tx).assertOwned(options.execution);
    else {
      const execution = await executions(tx).read(options.execution);
      if (!execution || execution.status === "unconfirmed")
        throw new Error("Completed probe requires its confirmed execution identity");
    }
    const backend = await new StorageBackendRegistry(
      options.executor(tx),
      options.dialect,
      options.namespace
    ).get(options.target.backendId);
    if (!backend || backend.binding !== options.target.binding)
      throw new Error("Storage probe backend binding does not match");
    if (job.subjectId !== options.subjectId || !/^storage-probe:[0-9a-f-]{36}$/.test(job.subjectId))
      throw new Error("Storage probe cleanup subject does not match");
    const page = await store.listCollectors(job.id);
    const collector = page.collectors[0];
    if (page.cursor !== null || page.collectors.length !== 1 || !collector || collector.kind !== "inventory" || collector.match !== "key" || collector.scope !== options.target.key || collector.backendIds.length !== 1 || collector.backendIds[0] !== options.target.backendId)
      throw new Error("Storage probe cleanup requires its exact captured target");
    return { job, collector };
  });
  let verificationPasses = 0;
  while (true) {
    const { job, collector } = await inspect();
    if (job.phase === "complete") return;
    if (job.phase === "preparing" || job.phase === "ready") {
      await options.transaction((tx) => executions(tx).transition(job.id, job.epoch, [options.execution]));
      continue;
    }
    if (job.phase === "waiting") {
      await options.transaction(async (tx) => {
        await executions(tx).assertOwned(options.execution);
        return journal(tx).recordDrainedIntents(job.id, job.epoch, job.drainCursor);
      });
      continue;
    }
    if (job.phase === "collecting" || job.phase === "verifying") {
      if (!collector.complete) {
        if (job.phase === "verifying" && ++verificationPasses > 2)
          throw new Error("Storage probe destination keeps reappearing during verification");
        const exists = await options.has(options.target.key);
        await options.transaction(async (tx) => {
          await executions(tx).assertOwned(options.execution);
          return journal(tx).recordCollectorPage({
            jobId: job.id,
            epoch: job.epoch,
            collectorId: collector.id,
            after: collector.cursor,
            next: null,
            targets: exists ? [options.target] : []
          });
        });
      } else {
        await options.transaction((tx) => executions(tx).transition(job.id, job.epoch, [options.execution]));
      }
      continue;
    }
    const page = await options.transaction((tx) => journal(tx).pendingTargets(job.id, job.epoch));
    if (page.cursor !== null || page.tickets.length > 1)
      throw new Error("Storage probe cleanup contains unexpected targets");
    for (const ticket of page.tickets) {
      if (ticket.target.key !== options.target.key || ticket.target.binding !== options.target.binding || ticket.target.backendIds.length !== 1 || ticket.target.backendIds[0] !== options.target.backendId)
        throw new Error("Storage probe deletion target does not match");
      await options.delete(ticket.target.key);
      await options.transaction((tx) => executions(tx).acknowledgeTarget(options.execution, ticket));
    }
    await options.transaction(async (tx) => {
      await executions(tx).assertOwned(options.execution);
      return journal(tx).beginVerification(job.id, job.epoch);
    });
  }
}
async function runStorageCleanup(input) {
  const namespace = z.string().min(1).max(200).parse(input.namespace);
  const jobId = z.uuid().parse(input.jobId);
  const executorId = z.uuid().parse(input.executorId ?? randomUUID());
  const ports = [...input.ports];
  if (!ports.length) throw new Error("Storage cleanup requires at least one backend port");
  const byBackend = new Map(ports.map((port) => [port.backendId, port]));
  const byBinding = new Map(ports.map((port) => [port.binding, port]));
  if (byBackend.size !== ports.length) throw new Error("Storage cleanup backend ports must be unique");
  const signal = input.signal ?? new AbortController().signal;
  const journal = (transaction) => new StorageCleanupJournal(input.executor(transaction), input.dialect, namespace);
  const executions = (transaction) => new CleanupExecutionJournal(input.executor(transaction), input.dialect, namespace);
  const bindings = [...byBinding].map(([backendBinding]) => ({
    executionId: randomUUID(),
    executorId,
    jobId,
    backendBinding
  }));
  await input.transaction(async (transaction) => {
    for (const binding2 of bindings) await executions(transaction).begin(binding2);
  });
  let externalStarted = false;
  try {
    while (true) {
      signal.throwIfAborted();
      const snapshot = await input.transaction(async (transaction) => {
        const store = journal(transaction);
        const job2 = await store.get(jobId);
        const collectors2 = [];
        let after2 = null;
        do {
          const page = await store.listCollectors(jobId, after2);
          collectors2.push(...page.collectors);
          after2 = page.cursor;
        } while (after2 !== null);
        return { job: job2, collectors: collectors2 };
      });
      const { job, collectors } = snapshot;
      if (job.phase === "complete") break;
      if (job.phase === "preparing" || job.phase === "ready") {
        await input.transaction(
          (transaction) => executions(transaction).transition(job.id, job.epoch, bindings)
        );
        continue;
      }
      if (job.phase === "waiting") {
        await input.transaction(
          (transaction) => journal(transaction).recordDrainedIntents(job.id, job.epoch, job.drainCursor)
        );
        continue;
      }
      if (job.phase === "collecting" || job.phase === "verifying") {
        const collector = collectors.find((candidate) => !candidate.complete);
        if (!collector) {
          await input.transaction(
            (transaction) => executions(transaction).transition(job.id, job.epoch, bindings)
          );
          continue;
        }
        const port = collector.backendIds.map((id) => byBackend.get(id)).find(Boolean);
        if (!port) throw new Error("Storage cleanup collector has no retained backend port");
        externalStarted = true;
        const page = await port.collect(collector, signal);
        if (page.targets.length > 1e3) throw new Error("Storage cleanup backend page exceeds its bound");
        await input.transaction(
          (transaction) => journal(transaction).recordCollectorPage({
            jobId: job.id,
            epoch: job.epoch,
            collectorId: collector.id,
            after: collector.cursor,
            next: page.next,
            targets: page.targets
          })
        );
        continue;
      }
      if (job.phase !== "deleting") throw new Error("Storage cleanup reached an unsupported phase");
      let after = null;
      do {
        const page = await input.transaction(
          (transaction) => journal(transaction).pendingTargets(job.id, job.epoch, after)
        );
        for (const ticket of page.tickets) {
          const port = byBinding.get(ticket.target.binding);
          if (!port) throw new Error("Storage cleanup target has no retained backend port");
          externalStarted = true;
          await port.delete(ticket.target.key, signal);
          await input.transaction(
            (transaction) => executions(transaction).acknowledgeTarget(
              bindings.find((binding2) => binding2.backendBinding === ticket.target.binding),
              ticket
            )
          );
        }
        after = page.cursor;
      } while (after !== null);
      await input.transaction((transaction) => journal(transaction).beginVerification(job.id, job.epoch));
    }
    await input.transaction(async (transaction) => {
      for (const binding2 of bindings) await executions(transaction).settle(binding2);
    });
  } catch (error) {
    await input.transaction(async (transaction) => {
      for (const binding2 of bindings) {
        if (externalStarted) await executions(transaction).markUnconfirmed(binding2);
        else await executions(transaction).settle(binding2);
      }
    }).catch((settlementError) => {
      throw new AggregateError(
        [error, settlementError],
        "Storage cleanup failed and execution settlement could not be recorded",
        { cause: settlementError }
      );
    });
    throw error;
  }
}
async function runStorageProbe(input) {
  const options = { ...input };
  options.signal.throwIfAborted();
  const writes = (tx) => new StorageWriteJournal(options.executor(tx), options.dialect, options.namespace);
  const cleanup = (tx) => new StorageCleanupJournal(options.executor(tx), options.dialect, options.namespace);
  const instance = (tx) => new StorageInstanceControl(options.executor(tx), options.dialect, options.namespace);
  const executions = (tx) => new CleanupExecutionJournal(options.executor(tx), options.dialect, options.namespace);
  const admission = await options.transaction(async (tx) => {
    const captured = structuredClone(await options.captureAdmission(tx));
    const current = await instance(tx).read();
    const scopes = z.array(
      z.object({
        subjectId: z.string().min(1).max(200),
        generation: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
      }).strict()
    ).min(2).max(1e3).parse(captured.scopes);
    if (captured.instanceId !== current.instanceId || new Set(scopes.map((scope3) => scope3.subjectId)).size !== scopes.length || !scopes.some(
      (scope3) => scope3.subjectId === current.subjectId && scope3.generation === current.generation
    ))
      throw new Error("Storage probe admission does not match the current instance");
    return captured;
  });
  options.signal.throwIfAborted();
  const capturedPort = await options.capturePort();
  const port = {
    descriptor: structuredClone(capturedPort.descriptor),
    write: capturedPort.write.bind(capturedPort),
    has: capturedPort.has.bind(capturedPort),
    delete: capturedPort.delete.bind(capturedPort)
  };
  const backend = prepareStorageBackend(options.namespace, port.descriptor);
  const subjectId = `storage-probe:${randomUUID()}`;
  const target = {
    backendId: backend.id,
    binding: backend.binding,
    key: `storage-probes/${admission.instanceId}/${randomUUID()}.txt`
  };
  const job = prepareStorageCleanup({ namespace: options.namespace, subjectId, generation: 0 });
  const execution = {
    executionId: randomUUID(),
    executorId: options.executorId,
    jobId: job.id,
    backendBinding: backend.binding
  };
  const intents = [...admission.scopes, { subjectId, generation: 0 }].map(
    (scope3) => prepareStorageWrite({ namespace: options.namespace, ...scope3, target })
  );
  async function validate(tx) {
    options.signal.throwIfAborted();
    await options.validateAdmission(tx, structuredClone(admission));
    if ((await instance(tx).read()).instanceId !== admission.instanceId)
      throw new Error("Storage instance changed during the probe");
    for (const intent of intents.slice(0, admission.scopes.length))
      await writes(tx).assertWritable(intent, intent.generation);
    options.signal.throwIfAborted();
  }
  async function finish(kind) {
    await options.transaction(async (tx) => {
      for (const intent of intents) await writes(tx).finish(intent, { kind });
    });
  }
  async function clean() {
    await cleanupStorageProbe({
      ...options,
      jobId: job.id,
      subjectId,
      target,
      execution,
      has: (key) => port.has(key),
      delete: (key) => port.delete(key)
    });
    try {
      await options.transaction((tx) => executions(tx).settle(execution));
    } catch (error) {
      try {
        const confirmed = await options.transaction(
          async (tx) => (await executions(tx).read(execution))?.status === "settled" && (await cleanup(tx).get(job.id)).phase === "complete"
        );
        if (confirmed) return;
      } catch (recoveryError) {
        throw new AggregateError([error, recoveryError], "Storage probe settlement could not be confirmed", {
          cause: recoveryError
        });
      }
      throw error;
    }
  }
  try {
    await options.transaction(async (tx) => {
      await new StorageBackendRegistry(options.executor(tx), options.dialect, options.namespace).register(
        backend
      );
      await validate(tx);
      for (const intent of intents) await writes(tx).begin(intent, intent.generation);
      await cleanup(tx).createJob(job);
      await cleanup(tx).registerCollectors(job.id, 0, [
        {
          id: "probe",
          kind: "inventory",
          backendIds: [backend.id],
          scope: target.key,
          match: "key"
        }
      ]);
      await executions(tx).begin(execution);
    });
  } catch (error) {
    try {
      const accepted = await options.transaction(async (tx) => {
        const stored = await cleanup(tx).find(job.id);
        if (stored && stored.subjectId !== subjectId)
          throw new Error("Storage probe admission identity does not match");
        return stored !== null;
      });
      if (accepted) {
        await finish("not_created");
        await clean();
      }
    } catch (recoveryError) {
      throw new StorageProbeCleanupError(
        job.id,
        [error, recoveryError],
        "Storage probe admission recovery failed"
      );
    }
    throw error;
  }
  let started = false;
  try {
    await options.transaction(async (tx) => {
      await validate(tx);
      await executions(tx).assertOwned(execution);
    });
    options.signal.throwIfAborted();
    started = true;
    await port.write(target.key, Buffer.from("ok"), "text/plain", options.signal);
  } catch (error) {
    try {
      await finish(started ? "uncertain" : "not_created");
      if (!started) await clean();
      else await options.transaction((tx) => executions(tx).markUnconfirmed(execution));
    } catch (recoveryError) {
      throw new StorageProbeCleanupError(
        job.id,
        [error, recoveryError],
        "Storage probe cleanup is unresolved"
      );
    }
    if (started)
      throw new StorageProbeCleanupError(job.id, [error], "Storage probe upload outcome is unresolved");
    throw error;
  }
  try {
    await finish("unreferenced");
    await clean();
  } catch (error) {
    throw new StorageProbeCleanupError(job.id, [error], "Storage probe cleanup is unresolved");
  }
  await options.transaction(validate);
  return { cleanupJobId: job.id };
}

// src/storage/cleanup/backends/multipart-cleanup.ts
var MultipartStorageCleanup = class {
  constructor(port, maxDeletePages) {
    this.port = port;
    this.maxDeletePages = maxDeletePages;
  }
  port;
  maxDeletePages;
  async *list(prefix, signal) {
    let keyMarker;
    let uploadIdMarker;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      signal?.throwIfAborted();
      const page = await this.port.listMultipart(prefix, keyMarker, uploadIdMarker, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) {
        if (!entry.key || !entry.key.startsWith(prefix))
          throw new Error("Multipart listing returned a key outside the cleanup prefix");
        validateStorageKey(entry.key.endsWith("/") ? entry.key.slice(0, -1) : entry.key);
        if (!entry.uploadId || [...entry.uploadId].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        ))
          throw new Error("Multipart listing returned an invalid upload identity");
        yield { key: entry.key, uploadId: entry.uploadId };
      }
      if (!page.isTruncated) return;
      keyMarker = page.nextKey;
      uploadIdMarker = page.nextUploadId;
      const marker = JSON.stringify([keyMarker, uploadIdMarker]);
      if (!keyMarker || !uploadIdMarker || seen.has(marker))
        throw new Error("Multipart listing did not advance");
      seen.add(marker);
    }
  }
  async delete(key, signal) {
    let previous;
    for (let batch = 0; batch < this.maxDeletePages; batch++) {
      const uploads = [];
      for await (const entry of this.list(key, signal)) {
        if (entry.key !== key) continue;
        uploads.push(entry);
        if (uploads.length === 1e3) break;
      }
      if (!uploads.length) return;
      const signature = JSON.stringify(uploads.map((entry) => entry.uploadId).sort());
      if (signature === previous) throw new Error("Multipart deletion did not advance");
      previous = signature;
      for (const upload of uploads) {
        signal?.throwIfAborted();
        await this.port.abortMultipart(key, upload.uploadId, signal);
        signal?.throwIfAborted();
      }
    }
    throw new Error("Multipart cleanup reached its batch limit; retry to continue");
  }
};

// src/storage/cleanup/backends/object-cleanup.ts
function objectKey(value) {
  validateStorageKey(value.endsWith("/") ? value.slice(0, -1) : value);
  return value;
}
var ObjectStorageCleanup = class {
  location;
  binding;
  publicUrl;
  publicUrlEncoding;
  port;
  maxDeletePages;
  multipart;
  activeListings = 0;
  activeDeletions = 0;
  constructor(options) {
    this.location = Object.freeze({ ...options.location });
    this.binding = storageBackendBinding(this.location);
    this.publicUrl = options.publicUrl ?? null;
    this.publicUrlEncoding = options.publicUrlEncoding ?? "raw";
    this.port = options.port;
    this.maxDeletePages = options.maxDeletePages ?? 100;
    if (!Number.isSafeInteger(this.maxDeletePages) || this.maxDeletePages < 1 || this.maxDeletePages > 1e3)
      throw new Error("Cleanup batch limit must be between 1 and 1000");
    if (!options.multipart || typeof options.multipart.listMultipart !== "function" || typeof options.multipart.abortMultipart !== "function")
      throw new Error("Object cleanup requires multipart inventory and abort support");
    this.multipart = new MultipartStorageCleanup(options.multipart, this.maxDeletePages);
    if (this.publicUrl) this.normalize(`${this.publicUrl.replace(/\/$/, "")}/__reference_validation__`);
  }
  normalize(reference) {
    return normalizeStorageReference(this.location, reference, {
      ...this.publicUrl ? { publicUrl: this.publicUrl } : {},
      publicUrlEncoding: this.publicUrlEncoding
    });
  }
  /** Finish and persist discovery before deleting. Separate instances require caller coordination. */
  async *list(prefix, signal) {
    if (this.activeDeletions) throw new Error("Finish deleting before collecting another cleanup manifest");
    this.activeListings++;
    try {
      if (!prefix.endsWith("/")) throw new Error("Cleanup requires an exact directory prefix");
      validateStorageKey(prefix.slice(0, -1));
      yield* this.scan(prefix, signal);
      for await (const upload of this.multipart.list(prefix, signal)) yield upload.key;
    } finally {
      this.activeListings--;
    }
  }
  /** Exact-key verification includes retained versions and deletion markers, even without a live object. */
  async has(key, signal) {
    objectKey(key);
    if (this.activeDeletions) throw new Error("Finish deleting before collecting another cleanup manifest");
    this.activeListings++;
    try {
      for await (const candidate of this.scan(key, signal)) if (candidate === key) return true;
      for await (const upload of this.multipart.list(key, signal)) if (upload.key === key) return true;
      return false;
    } finally {
      this.activeListings--;
    }
  }
  async *scan(prefix, signal) {
    if (this.port.kind === "versioned") {
      yield* this.listVersions(this.port, prefix, signal);
      return;
    }
    let token;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      signal?.throwIfAborted();
      const page = await this.port.listObjects(prefix, token, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) yield this.listedKey(entry.key, prefix);
      if (!page.isTruncated) return;
      token = page.nextToken;
      if (!token || seen.has(token)) throw new Error("Storage listing did not advance");
      seen.add(token);
    }
  }
  listedKey(key, prefix) {
    if (!key || !key.startsWith(prefix))
      throw new Error("Storage listing returned an object outside the cleanup prefix");
    return objectKey(key);
  }
  async *listVersions(port, prefix, signal) {
    let keyMarker;
    let versionMarker;
    const seen = /* @__PURE__ */ new Set();
    while (true) {
      signal?.throwIfAborted();
      const page = await port.listVersions(prefix, keyMarker, versionMarker, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) {
        if (!entry.versionId) throw new Error("Storage version listing is incomplete");
        yield this.listedKey(entry.key, prefix);
      }
      if (!page.isTruncated) return;
      keyMarker = page.nextKey;
      versionMarker = page.nextVersion;
      const marker = JSON.stringify([keyMarker, versionMarker]);
      if (!keyMarker || seen.has(marker)) throw new Error("Storage version listing did not advance");
      seen.add(marker);
    }
  }
  /** Caller establishes ownership and drains writers before invoking deletion. */
  async delete(key, signal) {
    if (this.activeListings) throw new Error("Finish collecting the cleanup manifest before deleting");
    this.activeDeletions++;
    try {
      await this.deleteExact(key, signal);
    } finally {
      this.activeDeletions--;
    }
  }
  async deleteExact(key, signal) {
    objectKey(key);
    await this.multipart.delete(key, signal);
    signal?.throwIfAborted();
    if (this.port.kind === "unversioned") {
      await this.port.deleteObject(key, signal);
      signal?.throwIfAborted();
      return;
    }
    let previous;
    for (let pageNumber = 0; pageNumber < this.maxDeletePages; pageNumber++) {
      signal?.throwIfAborted();
      const page = await this.port.listVersions(key, void 0, void 0, 1e3, signal);
      signal?.throwIfAborted();
      for (const entry of page.entries) {
        this.listedKey(entry.key, key);
        if (!entry.versionId) throw new Error("Storage version listing is incomplete");
      }
      if (!page.entries.length && page.isTruncated)
        throw new Error("Storage version listing did not advance");
      const versions = page.entries.filter((entry) => entry.key === key);
      if (!versions.length) return;
      const signature = JSON.stringify(versions.map((entry) => entry.versionId).sort());
      if (signature === previous) throw new Error("Storage version deletion did not advance");
      previous = signature;
      for (const version of versions) {
        signal?.throwIfAborted();
        await this.port.deleteVersion(key, version.versionId, signal);
        signal?.throwIfAborted();
      }
    }
    throw new Error("Storage version cleanup reached its batch limit; retry to continue");
  }
};
function isMissing(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
var FileStateStore = class {
  constructor(options) {
    this.options = options;
    this.path = resolve(options.path);
  }
  options;
  path;
  async read() {
    try {
      return this.options.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch (error) {
      if (isMissing(error)) return this.options.parse(this.options.initial());
      throw error;
    }
  }
  async transact(operation) {
    return withFileLock(`${this.path}.guard`, async () => {
      const state = await this.read();
      const result = operation(state);
      if (result instanceof Promise) throw new Error("State transaction callbacks must be synchronous");
      const detachedResult = structuredClone(result);
      const encoded = JSON.stringify(this.options.parse(state));
      await this.persist(encoded);
      return detachedResult;
    });
  }
  async persist(encoded) {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, "wx", 384);
      try {
        await file.writeFile(encoded);
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.path);
      const directory = await open(dirname(this.path), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await unlink(temporary).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }
  }
};

export { CleanupExecutionJournal, FileLockBusyError, FileStateStore, LocalStorageReader, LocalStorageWriteError, LocalStorageWriter, ObjectStorageCleanup, PostgresConnectionCleanupError, ReferenceSetError, StorageCleanupAttribution, StorageReferenceConsumerMismatchError, StorageReferenceRegistry, StorageRelocationRegistry, acquireFileLock, acquireFileLockSync, acquirePostgresBackendLock, cleanupStorageProbe, copyOwnedReadableToFile, isReferenceSetError, localEncryptionKey, openExecutionLocation, openPostgresDedicatedConnection, prepareStorageReference, prepareStorageReferenceClaims, runStorageCleanup, runStorageProbe, withFileLock, withOwnedReadables, withSharedFileLockSync, writeReferenceSet };
