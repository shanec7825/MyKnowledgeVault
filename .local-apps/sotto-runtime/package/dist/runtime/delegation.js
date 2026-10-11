import { canonicalJson } from '../chunk-PUSQYKAU.js';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';

var identifier = z.string().min(1).max(200).regex(/^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$/);
var integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
var digest = z.string().regex(/^[a-f0-9]{64}$/);
var scope = z.object({ id: identifier, generation: integer }).strict();
var delegationGrantSchema = z.object({
  id: z.uuid(),
  revision: z.uuid(),
  instanceId: z.uuid(),
  subject: scope,
  resource: scope,
  operationId: z.uuid(),
  action: identifier,
  expiresAt: integer,
  maxRequests: z.number().int().min(1).max(1e3)
}).strict();
var delegationBindingSchema = z.object({ id: z.uuid(), revision: z.uuid(), fingerprint: digest }).strict();
var delegationAttemptInputSchema = z.object({ id: z.uuid(), fingerprint: digest }).strict();
var delegationOutcomeSchema = z.enum(["succeeded", "failed", "unknown"]);
var delegationAttemptSchema = delegationAttemptInputSchema.extend({
  number: z.number().int().min(1).max(1e3),
  admittedAt: integer,
  outcome: z.enum(["admitted", "succeeded", "failed", "unknown"]),
  settledAt: integer.optional()
}).strict().refine((attempt) => attempt.outcome === "admitted" === (attempt.settledAt === void 0));
var delegationActivitySchema = z.object({
  sequence: integer.positive(),
  at: integer,
  type: z.enum(["created", "admitted", "succeeded", "failed", "unknown", "revoked", "completed"]),
  attemptId: z.uuid().optional()
}).strict().refine(
  (event) => ["created", "revoked", "completed"].includes(event.type) ? event.attemptId === void 0 : event.attemptId !== void 0
);
var delegationRecordSchema = z.object({
  version: z.literal(1),
  grant: delegationGrantSchema,
  binding: delegationBindingSchema,
  status: z.enum(["active", "revoked", "completed"]),
  attempts: z.array(delegationAttemptSchema).max(1e3),
  sequence: integer.positive(),
  activity: z.array(delegationActivitySchema).min(1).max(128)
}).strict();

// src/runtime/delegation/index.ts
var DelegationConflictError = class extends Error {
  constructor() {
    super("Delegation changed concurrently; retry the complete application transaction");
    this.name = "DelegationConflictError";
  }
};
var DelegationDeniedError = class extends Error {
  constructor(code) {
    super(`Delegation rejected: ${code}`);
    this.code = code;
    this.name = "DelegationDeniedError";
  }
  code;
};
function delegationGrantBinding(input) {
  const grant = delegationGrantSchema.parse(input);
  return {
    id: grant.id,
    revision: grant.revision,
    fingerprint: createHash("sha256").update(canonicalJson(grant)).digest("hex")
  };
}
var DelegationStore = class {
  backend;
  authorize;
  now;
  constructor(options) {
    this.backend = options.backend;
    this.authorize = options.authorize;
    this.now = options.now ?? Date.now;
  }
  time() {
    return z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(this.now());
  }
  event(record, type, attemptId) {
    record.sequence += 1;
    record.activity.push({
      sequence: record.sequence,
      at: this.time(),
      type,
      ...attemptId ? { attemptId } : {}
    });
    record.activity = record.activity.slice(-128);
  }
  parse(snapshot) {
    const record = delegationRecordSchema.parse(snapshot.state);
    if (canonicalJson(delegationGrantBinding(record.grant)) !== canonicalJson(record.binding) || record.attempts.length > record.grant.maxRequests || new Set(record.attempts.map((attempt) => attempt.id)).size !== record.attempts.length || record.attempts.some((attempt, index) => attempt.number !== index + 1) || record.activity.some(
      (event, index) => event.sequence !== record.sequence - record.activity.length + index + 1
    ))
      throw new DelegationDeniedError("binding");
    return record;
  }
  async owned(input, operation) {
    const expected = delegationBindingSchema.parse(input);
    const row = await this.backend.read();
    if (!row) throw new DelegationDeniedError("missing");
    const record = this.parse(row);
    if (canonicalJson(expected) !== canonicalJson(record.binding)) throw new DelegationDeniedError("binding");
    await this.authorize({ operation, grant: structuredClone(record.grant) });
    return { row, record };
  }
  active(record) {
    if (record.status !== "active") throw new DelegationDeniedError("closed");
    if (this.time() >= record.grant.expiresAt) throw new DelegationDeniedError("expired");
  }
  async save(previous, record) {
    const state = delegationRecordSchema.parse(record);
    if (!await this.backend.compareAndSwap(previous, { revision: randomUUID(), state }))
      throw new DelegationConflictError();
  }
  async create(input) {
    const grant = delegationGrantSchema.parse(input);
    await this.authorize({ operation: "create", grant: structuredClone(grant) });
    const row = await this.backend.read();
    if (row) {
      const record2 = this.parse(row);
      if (canonicalJson(record2.grant) !== canonicalJson(grant)) throw new DelegationDeniedError("binding");
      return structuredClone(record2);
    }
    const record = {
      version: 1,
      grant,
      binding: delegationGrantBinding(grant),
      status: "active",
      attempts: [],
      sequence: 1,
      activity: [{ sequence: 1, at: this.time(), type: "created" }]
    };
    this.active(record);
    await this.save(null, record);
    return structuredClone(record);
  }
  async read(input) {
    return structuredClone((await this.owned(input, "read")).record);
  }
  /** Check current authority without consuming budget. This alone never admits a dispatch. */
  async validate(input) {
    this.active((await this.owned(input, "validate")).record);
  }
  /** Each actual HTTP attempt requires a fresh ID and consumes a slot, including retries. */
  async admit(input, request) {
    const captured = delegationAttemptInputSchema.parse(request);
    const { row, record } = await this.owned(input, "admit");
    const previous = record.attempts.find((attempt2) => attempt2.id === captured.id);
    if (previous) {
      if (previous.fingerprint !== captured.fingerprint) throw new DelegationDeniedError("attempt");
      return { dispatch: false, attempt: structuredClone(previous) };
    }
    this.active(record);
    if (record.attempts.length >= record.grant.maxRequests) throw new DelegationDeniedError("budget");
    const attempt = {
      ...captured,
      number: record.attempts.length + 1,
      admittedAt: this.time(),
      outcome: "admitted"
    };
    record.attempts.push(attempt);
    this.event(record, "admitted", attempt.id);
    await this.save(row.revision, record);
    return { dispatch: true, attempt: structuredClone(attempt) };
  }
  /** Settlement records observations only. It does not refund budget or prove remote exactly-once effects. */
  async settle(input, request, outcomeInput) {
    const captured = delegationAttemptInputSchema.parse(request);
    const outcome = delegationOutcomeSchema.parse(outcomeInput);
    const { row, record } = await this.owned(input, "settle");
    const attempt = record.attempts.find((candidate) => candidate.id === captured.id);
    if (!attempt || attempt.fingerprint !== captured.fingerprint) throw new DelegationDeniedError("attempt");
    if (attempt.outcome !== "admitted") {
      if (attempt.outcome !== outcome) throw new DelegationDeniedError("attempt");
      return structuredClone(attempt);
    }
    attempt.outcome = outcome;
    attempt.settledAt = this.time();
    this.event(record, outcome, attempt.id);
    await this.save(row.revision, record);
    return structuredClone(attempt);
  }
  async revoke(input) {
    const { row, record } = await this.owned(input, "revoke");
    if (record.status === "revoked") return structuredClone(record);
    record.status = "revoked";
    this.event(record, "revoked");
    await this.save(row.revision, record);
    return structuredClone(record);
  }
  async complete(input) {
    const { row, record } = await this.owned(input, "complete");
    if (record.status === "completed") return structuredClone(record);
    if (record.status !== "active") throw new DelegationDeniedError("closed");
    if (record.attempts.some((attempt) => attempt.outcome === "admitted" || attempt.outcome === "unknown"))
      throw new DelegationDeniedError("unsettled");
    record.status = "completed";
    this.event(record, "completed");
    await this.save(row.revision, record);
    return structuredClone(record);
  }
  /** A gap is explicit when retention has removed events after the supplied cursor. */
  async activity(input, options = {}) {
    const after = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).parse(options.after ?? 0);
    const limit = z.number().int().min(1).max(100).parse(options.limit ?? 100);
    const { record } = await this.owned(input, "read");
    if (after > record.sequence) throw new DelegationDeniedError("binding");
    const events = record.activity.filter((event) => event.sequence > after).slice(0, limit);
    return {
      events: structuredClone(events),
      truncated: after < record.activity[0].sequence - 1,
      next: events.at(-1)?.sequence ?? after,
      latest: record.sequence
    };
  }
};

export { DelegationConflictError, DelegationDeniedError, DelegationStore, delegationActivitySchema, delegationAttemptInputSchema, delegationAttemptSchema, delegationBindingSchema, delegationGrantBinding, delegationGrantSchema, delegationOutcomeSchema, delegationRecordSchema };
