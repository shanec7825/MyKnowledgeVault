import { StorageWriteJournal } from './chunk-VAAUIWAQ.js';
import { sqlStateBackend } from './chunk-2VO27ZQG.js';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';

var identity = z.string().min(1).max(200);
var instance = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("storage_instance"),
  namespace: identity,
  instanceId: z.uuid()
}).strict();
var allocation = instance.extend({ kind: z.literal("storage_instance_allocation") });
function scope(instanceId) {
  return { instanceId, subjectId: `instance:${z.uuid().parse(instanceId)}`, generation: 0 };
}
var StorageInstanceControl = class {
  constructor(database, dialect, namespace) {
    this.database = database;
    this.dialect = dialect;
    this.namespace = namespace;
    identity.parse(namespace);
    this.prefix = createHash("sha256").update(namespace).digest("hex");
  }
  database;
  dialect;
  namespace;
  prefix;
  control() {
    return sqlStateBackend(this.database, this.dialect, `sd-i:1:${this.prefix}`);
  }
  allocated(instanceId) {
    return sqlStateBackend(
      this.database,
      this.dialect,
      `sd-ia:1:${this.prefix}:${z.uuid().parse(instanceId)}`
    );
  }
  writes() {
    return new StorageWriteJournal(this.database, this.dialect, this.namespace);
  }
  async current() {
    const record = await this.control().read();
    if (!record) throw new Error("Storage instance is not initialized");
    const state = instance.parse(record.state);
    if (state.namespace !== this.namespace) throw new Error("Storage instance namespace mismatch");
    const reserved = await this.allocated(state.instanceId).read();
    if (!reserved) throw new Error("Storage instance allocation is missing");
    const marker = allocation.parse(reserved.state);
    if (marker.namespace !== this.namespace || marker.instanceId !== state.instanceId)
      throw new Error("Storage instance allocation mismatch");
    return { state, revision: record.revision };
  }
  async reserve(instanceId) {
    const target = scope(instanceId);
    if (await this.writes().tombstone(target.subjectId))
      throw new Error("Storage instance was already erased");
    if (!await this.allocated(instanceId).compareAndSwap(null, {
      revision: randomUUID(),
      state: {
        schemaVersion: 1,
        kind: "storage_instance_allocation",
        namespace: this.namespace,
        instanceId
      }
    }))
      throw new Error("Storage instance identity was already allocated");
  }
  /** Prepare the UUID outside retries. Invoke only from explicit bootstrap or migration. */
  async initialize(preparedInstanceId) {
    z.uuid().parse(preparedInstanceId);
    if (await this.control().read()) return this.read();
    await this.reserve(preparedInstanceId);
    if (!await this.control().compareAndSwap(null, {
      revision: randomUUID(),
      state: {
        schemaVersion: 1,
        kind: "storage_instance",
        namespace: this.namespace,
        instanceId: preparedInstanceId
      }
    }))
      throw new Error("Storage instance initialization changed concurrently");
    return scope(preparedInstanceId);
  }
  /** Final reference transactions must compare this ID with the operation's captured ID. */
  async read() {
    return scope((await this.current()).state.instanceId);
  }
  /** Compose with old-instance cleanup registration and tombstoning in the reset transaction. */
  async rotate(expectedInstanceId, preparedInstanceId) {
    z.uuid().parse(expectedInstanceId);
    z.uuid().parse(preparedInstanceId);
    const current = await this.current();
    if (current.state.instanceId !== expectedInstanceId || preparedInstanceId === expectedInstanceId)
      throw new Error("Storage instance changed or replacement identity is not new");
    const previous = scope(expectedInstanceId);
    const tombstone = await this.writes().tombstone(previous.subjectId);
    if (!tombstone || tombstone.generation !== previous.generation)
      throw new Error("Previous storage instance must be tombstoned before rotation");
    await this.reserve(preparedInstanceId);
    if (!await this.control().compareAndSwap(current.revision, {
      revision: randomUUID(),
      state: { ...current.state, instanceId: preparedInstanceId }
    }))
      throw new Error("Storage instance changed concurrently");
    return scope(preparedInstanceId);
  }
};

export { StorageInstanceControl };
