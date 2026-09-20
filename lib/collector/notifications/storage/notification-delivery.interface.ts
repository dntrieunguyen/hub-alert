import type { NotificationChannel, NotificationDelivery, NotificationStatus } from '../types';

export interface INotificationDeliveryRepository {
    findDelivery(eventId: string, channel: NotificationChannel): Promise<NotificationDelivery | null>;
    isAlreadySent(eventId: string, channel: NotificationChannel): Promise<boolean>;
    recordPending(eventId: string, channel: NotificationChannel): Promise<NotificationDelivery>;
    recordSuccess(eventId: string, channel: NotificationChannel): Promise<NotificationDelivery>;
    recordFailure(eventId: string, channel: NotificationChannel, error: string): Promise<NotificationDelivery>;
}
