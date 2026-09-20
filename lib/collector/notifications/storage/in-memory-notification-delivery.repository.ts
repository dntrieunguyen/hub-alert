import { type INotificationDeliveryRepository } from './notification-delivery.interface';
import { type NotificationChannel, type NotificationDelivery, NotificationStatus } from '../types';

export class InMemoryNotificationDeliveryRepository implements INotificationDeliveryRepository {
    // Key format: `${eventId}:${channel}`
    private deliveries: Map<string, NotificationDelivery> = new Map();

    private makeKey(eventId: string, channel: NotificationChannel): string {
        return `${eventId}:${channel}`;
    }

    async findDelivery(eventId: string, channel: NotificationChannel): Promise<NotificationDelivery | null> {
        const record = this.deliveries.get(this.makeKey(eventId, channel));
        return record ? { ...record } : null;
    }

    async isAlreadySent(eventId: string, channel: NotificationChannel): Promise<boolean> {
        const record = this.deliveries.get(this.makeKey(eventId, channel));
        return record?.status === NotificationStatus.SENT;
    }

    async recordPending(eventId: string, channel: NotificationChannel): Promise<NotificationDelivery> {
        const key = this.makeKey(eventId, channel);
        const existing = this.deliveries.get(key);

        const record: NotificationDelivery = {
            id: existing ? existing.id : `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            eventId,
            channel,
            status: NotificationStatus.PENDING,
            attemptCount: (existing?.attemptCount || 0) + 1,
            sentAt: existing?.sentAt,
            failedAt: existing?.failedAt,
            lastError: existing?.lastError,
            createdAt: existing?.createdAt || new Date(),
        };

        this.deliveries.set(key, record);
        return { ...record };
    }

    async recordSuccess(eventId: string, channel: NotificationChannel): Promise<NotificationDelivery> {
        const key = this.makeKey(eventId, channel);
        const existing = this.deliveries.get(key);

        const record: NotificationDelivery = {
            id: existing ? existing.id : `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            eventId,
            channel,
            status: NotificationStatus.SENT,
            attemptCount: existing?.attemptCount || 1,
            sentAt: new Date(),
            createdAt: existing?.createdAt || new Date(),
        };

        this.deliveries.set(key, record);
        return { ...record };
    }

    async recordFailure(eventId: string, channel: NotificationChannel, error: string): Promise<NotificationDelivery> {
        const key = this.makeKey(eventId, channel);
        const existing = this.deliveries.get(key);

        const record: NotificationDelivery = {
            id: existing ? existing.id : `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            eventId,
            channel,
            status: NotificationStatus.FAILED,
            attemptCount: existing?.attemptCount || 1,
            failedAt: new Date(),
            lastError: error,
            createdAt: existing?.createdAt || new Date(),
        };

        this.deliveries.set(key, record);
        return { ...record };
    }

    clear(): void {
        this.deliveries.clear();
    }
}
