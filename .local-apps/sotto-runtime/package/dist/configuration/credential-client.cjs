'use strict';

var zod = require('zod');

// src/configuration/credential-client.ts
var revision = zod.z.uuid();
var fieldValue = zod.z.union([zod.z.string(), zod.z.number().finite(), zod.z.boolean()]);
var credentialEditContextSchema = zod.z.object({
  instanceId: zod.z.string().min(1),
  scope: zod.z.string().min(1),
  owner: zod.z.object({ subjectId: zod.z.string().min(1), generation: zod.z.number().int().nonnegative() }).strict()
}).strict();
var attempt = zod.z.object({
  status: zod.z.enum(["verified", "rejected", "inconclusive"]),
  checkedAt: zod.z.number().finite().nonnegative()
});
var credentialSettingsKeySchema = zod.z.object({
  provider: zod.z.string().min(1),
  revision,
  isValid: zod.z.boolean(),
  verification: zod.z.object({
    lastAttempt: attempt.nullable(),
    lastConfirmed: attempt.extend({ status: zod.z.enum(["verified", "rejected"]) }).nullable()
  })
});
var credentialSettingsSnapshotSchema = zod.z.object({
  context: credentialEditContextSchema,
  heads: zod.z.record(zod.z.string(), revision.nullable()),
  keys: zod.z.array(credentialSettingsKeySchema)
}).superRefine((snapshot, context) => {
  const seen = /* @__PURE__ */ new Set();
  for (const key of snapshot.keys) {
    if (seen.has(key.provider) || !Object.hasOwn(snapshot.heads, key.provider) || snapshot.heads[key.provider] !== key.revision)
      context.addIssue({ code: "custom", message: "Credential snapshot contains inconsistent revisions" });
    seen.add(key.provider);
  }
});
var mutation = zod.z.object({
  context: credentialEditContextSchema,
  provider: zod.z.string().min(1),
  expectedRevision: revision.nullable(),
  operationId: revision
});
var credentialRemovalRequestSchema = mutation.strict();
var completeEdit = mutation.extend({ values: zod.z.record(zod.z.string(), fieldValue) });
var patchEdit = mutation.extend({ patch: zod.z.record(zod.z.string(), fieldValue.nullable()) });
var draftSchema = zod.z.union([completeEdit.strict(), patchEdit.strict()]);
var credentialSaveRequestSchema = zod.z.union([
  completeEdit.extend({ allowUnverified: zod.z.boolean() }).strict(),
  patchEdit.extend({ allowUnverified: zod.z.boolean() }).strict()
]);
function capturedTarget(snapshot, provider) {
  const captured = credentialSettingsSnapshotSchema.parse(snapshot);
  if (!Object.hasOwn(captured.heads, provider))
    throw new Error("Provider was not present in the displayed settings");
  Object.freeze(captured.context.owner);
  Object.freeze(captured.context);
  return {
    context: captured.context,
    provider,
    expectedRevision: captured.heads[provider],
    operationId: globalThis.crypto.randomUUID()
  };
}
function prepareCredentialSave(snapshot, provider, edit) {
  const request = draftSchema.parse({
    ...capturedTarget(snapshot, provider),
    ...structuredClone(edit)
  });
  Object.freeze(request.context.owner);
  Object.freeze(request.context);
  if ("values" in request) Object.freeze(request.values);
  else Object.freeze(request.patch);
  return Object.freeze(request);
}
function credentialSaveRequest(draft, allowUnverified = false) {
  return credentialSaveRequestSchema.parse({ ...structuredClone(draft), allowUnverified });
}
function prepareCredentialRemoval(snapshot, provider) {
  return Object.freeze(capturedTarget(snapshot, provider));
}
function sameCredentialEditContext(left, right) {
  return left.instanceId === right.instanceId && left.scope === right.scope && left.owner.subjectId === right.owner.subjectId && left.owner.generation === right.owner.generation;
}
function reconcileCredentialMutation(request, value, kind) {
  const target = credentialRemovalRequestSchema.parse({
    context: request.context,
    provider: request.provider,
    expectedRevision: request.expectedRevision,
    operationId: request.operationId
  });
  const snapshot = credentialSettingsSnapshotSchema.parse(value);
  if (!sameCredentialEditContext(target.context, snapshot.context)) return { status: "context_changed" };
  if (!Object.hasOwn(snapshot.heads, target.provider)) return { status: "unknown" };
  const head = snapshot.heads[target.provider];
  if (head !== target.operationId)
    return { status: head === target.expectedRevision ? "unknown" : "superseded" };
  const key = snapshot.keys.find((item) => item.provider === target.provider) ?? null;
  if (kind === "save" !== (key !== null)) return { status: "unknown" };
  return { status: "confirmed", revision: target.operationId, key };
}

exports.credentialEditContextSchema = credentialEditContextSchema;
exports.credentialRemovalRequestSchema = credentialRemovalRequestSchema;
exports.credentialSaveRequest = credentialSaveRequest;
exports.credentialSaveRequestSchema = credentialSaveRequestSchema;
exports.credentialSettingsKeySchema = credentialSettingsKeySchema;
exports.credentialSettingsSnapshotSchema = credentialSettingsSnapshotSchema;
exports.prepareCredentialRemoval = prepareCredentialRemoval;
exports.prepareCredentialSave = prepareCredentialSave;
exports.reconcileCredentialMutation = reconcileCredentialMutation;
exports.sameCredentialEditContext = sameCredentialEditContext;
