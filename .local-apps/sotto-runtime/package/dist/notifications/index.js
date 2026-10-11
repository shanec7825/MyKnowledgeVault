import { abortable } from '../chunk-GDO34PSX.js';
import { randomUUID } from 'crypto';
import { z } from 'zod';

var messageSchema = z.object({
  title: z.string().max(300),
  body: z.string().max(2e4),
  url: z.string().max(2e3).optional()
});
var entrySchema = z.object({
  id: z.string(),
  recipientId: z.string(),
  topic: z.string(),
  message: messageSchema,
  createdAt: z.number(),
  readAt: z.number().nullable()
});
var deliverySchema = z.object({
  id: z.string(),
  notificationId: z.string(),
  channelId: z.string(),
  attempts: z.number().int(),
  status: z.enum(["pending", "delivered", "failed"]),
  nextAttemptAt: z.number(),
  lease: z.string().nullable(),
  leaseUntil: z.number(),
  errorCode: z.string().nullable()
});
var notificationStateSchema = z.object({
  version: z.literal(1),
  entries: z.array(entrySchema),
  deliveries: z.array(deliverySchema)
});
var initialNotificationState = () => ({
  version: 1,
  entries: [],
  deliveries: []
});
var NotificationCenter = class {
  constructor(options) {
    this.options = options;
    this.now = options.now ?? Date.now;
  }
  options;
  now;
  async create(recipientId, topic, message, channels = []) {
    if (!recipientId || !topic) throw new Error("Recipient and topic are required");
    const safe = messageSchema.parse(message);
    return this.options.store.transact((state) => {
      const id = randomUUID();
      state.entries.push({ id, recipientId, topic, message: safe, createdAt: this.now(), readAt: null });
      state.deliveries.push(
        ...[...new Set(channels)].map((channelId) => ({
          id: randomUUID(),
          notificationId: id,
          channelId,
          attempts: 0,
          status: "pending",
          nextAttemptAt: this.now(),
          lease: null,
          leaseUntil: 0,
          errorCode: null
        }))
      );
      return id;
    });
  }
  async list(recipientId, limit = 100) {
    return (await this.options.store.read()).entries.filter((entry) => entry.recipientId === recipientId).slice(-Math.min(1e3, Math.max(1, limit))).reverse();
  }
  async unreadCount(recipientId) {
    return (await this.options.store.read()).entries.filter(
      (entry) => entry.recipientId === recipientId && entry.readAt === null
    ).length;
  }
  async markRead(recipientId, id) {
    await this.options.store.transact((state) => {
      for (const entry of state.entries) {
        if (entry.recipientId === recipientId && (id === void 0 || entry.id === id) && entry.readAt === null)
          entry.readAt = this.now();
      }
    });
  }
  async eraseRecipient(recipientId) {
    await this.options.store.transact((state) => {
      const removed = new Set(
        state.entries.filter((entry) => entry.recipientId === recipientId).map((entry) => entry.id)
      );
      state.entries = state.entries.filter((entry) => !removed.has(entry.id));
      state.deliveries = state.deliveries.filter((delivery) => !removed.has(delivery.notificationId));
    });
  }
  /** Delivery is at least once; transports receive a stable idempotency key for deduplication. */
  async deliverNext(transport, parent) {
    parent?.throwIfAborted();
    const lease = randomUUID();
    const claimed = await this.options.store.transact((state) => {
      const delivery = state.deliveries.find(
        (item) => item.status === "pending" && item.nextAttemptAt <= this.now() && item.leaseUntil <= this.now()
      );
      if (!delivery) return null;
      const entry = state.entries.find((item) => item.id === delivery.notificationId);
      if (!entry) throw new Error("Notification delivery references missing content");
      delivery.lease = lease;
      delivery.leaseUntil = this.now() + 3e4;
      delivery.attempts++;
      return { delivery, entry };
    });
    if (!claimed) return false;
    const started = this.now();
    const signal = AbortSignal.any([AbortSignal.timeout(15e3), ...parent ? [parent] : []]);
    let result;
    try {
      result = await abortable(
        transport.send({
          channelId: claimed.delivery.channelId,
          message: claimed.entry.message,
          idempotencyKey: claimed.delivery.id,
          signal
        }),
        signal
      );
    } catch {
      result = { status: "retry", code: signal.aborted ? "cancelled" : "transport_error" };
    }
    await this.options.store.transact((state) => {
      const delivery = state.deliveries.find((item) => item.id === claimed.delivery.id);
      if (!delivery || delivery.lease !== lease) return;
      delivery.lease = null;
      delivery.leaseUntil = 0;
      if (result.status === "delivered") {
        delivery.status = "delivered";
        delivery.errorCode = null;
        return;
      }
      delivery.errorCode = /^[a-zA-Z0-9_.:-]{1,128}$/.test(result.code) ? result.code : "transport_error";
      delivery.status = result.status === "failed" || delivery.attempts >= 5 ? "failed" : "pending";
      const retryMs = result.status === "retry" && Number.isFinite(result.retryAfterMs) ? Math.max(1e3, Math.min(result.retryAfterMs, 24 * 60 * 60 * 1e3)) : Math.min(6e4 * 2 ** (delivery.attempts - 1), 60 * 60 * 1e3);
      delivery.nextAttemptAt = this.now() + retryMs;
    });
    this.options.metrics?.record({
      version: 1,
      id: randomUUID(),
      timestamp: this.now(),
      kind: "delivery",
      operation: "notification",
      consumerId: claimed.entry.recipientId,
      outcome: result.status === "delivered" ? "success" : signal.aborted ? "cancelled" : "error",
      durationMs: this.now() - started
    });
    return true;
  }
};

export { NotificationCenter, initialNotificationState, notificationStateSchema };
