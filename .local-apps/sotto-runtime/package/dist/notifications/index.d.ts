import { z } from 'zod';
import { S as StateStore } from '../index-8r2v4WCa.js';
import { M as MetricCollector } from '../index-THd9yLQB.js';
import 'node:stream';
import '../ai/browser.js';

declare const messageSchema: z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type NotificationMessage = z.infer<typeof messageSchema>;
declare const entrySchema: z.ZodObject<{
    id: z.ZodString;
    recipientId: z.ZodString;
    topic: z.ZodString;
    message: z.ZodObject<{
        title: z.ZodString;
        body: z.ZodString;
        url: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    createdAt: z.ZodNumber;
    readAt: z.ZodNullable<z.ZodNumber>;
}, z.core.$strip>;
declare const notificationStateSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    entries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        recipientId: z.ZodString;
        topic: z.ZodString;
        message: z.ZodObject<{
            title: z.ZodString;
            body: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        createdAt: z.ZodNumber;
        readAt: z.ZodNullable<z.ZodNumber>;
    }, z.core.$strip>>;
    deliveries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        notificationId: z.ZodString;
        channelId: z.ZodString;
        attempts: z.ZodNumber;
        status: z.ZodEnum<{
            pending: "pending";
            delivered: "delivered";
            failed: "failed";
        }>;
        nextAttemptAt: z.ZodNumber;
        lease: z.ZodNullable<z.ZodString>;
        leaseUntil: z.ZodNumber;
        errorCode: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type NotificationState = z.infer<typeof notificationStateSchema>;
declare const initialNotificationState: () => NotificationState;
type NotificationEntry = z.infer<typeof entrySchema>;
type DeliveryResult = {
    status: 'delivered';
} | {
    status: 'retry';
    code: string;
    retryAfterMs?: number;
} | {
    status: 'failed';
    code: string;
};
interface DeliveryTransport {
    send(input: {
        channelId: string;
        message: NotificationMessage;
        idempotencyKey: string;
        signal: AbortSignal;
    }): Promise<DeliveryResult>;
}
interface NotificationOptions {
    store: StateStore<NotificationState>;
    now?: () => number;
    metrics?: MetricCollector;
}
/** Recipient selection and HTTP authorization remain with the app. Every inbox operation is scoped. */
declare class NotificationCenter {
    private readonly options;
    private readonly now;
    constructor(options: NotificationOptions);
    create(recipientId: string, topic: string, message: NotificationMessage, channels?: readonly string[]): Promise<string>;
    list(recipientId: string, limit?: number): Promise<NotificationEntry[]>;
    unreadCount(recipientId: string): Promise<number>;
    markRead(recipientId: string, id?: string): Promise<void>;
    eraseRecipient(recipientId: string): Promise<void>;
    /** Delivery is at least once; transports receive a stable idempotency key for deduplication. */
    deliverNext(transport: DeliveryTransport, parent?: AbortSignal): Promise<boolean>;
}

export { type DeliveryResult, type DeliveryTransport, NotificationCenter, type NotificationEntry, type NotificationMessage, type NotificationOptions, type NotificationState, initialNotificationState, notificationStateSchema };
