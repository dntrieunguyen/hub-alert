import type { IDigestDeliveryRepository } from './digest-delivery.interface';
import { type DigestDeliveryRecord, DigestDeliveryStatus } from '../types';

export class InMemoryDigestDeliveryRepository implements IDigestDeliveryRepository {
    private deliveries: DigestDeliveryRecord[] = [];
    private deliveredFingerprints: Set<string> = new Set();
    private criticalAlertedEventIds: Set<string> = new Set();

    async recordDelivery(record: Omit<DigestDeliveryRecord, 'id' | 'startedAt'>): Promise<DigestDeliveryRecord> {
        const id = `digest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const delivery: DigestDeliveryRecord = {
            id,
            startedAt: new Date(),
            ...record,
        };

        this.deliveries.unshift(delivery);

        // Keep last 100 delivery records
        if (this.deliveries.length > 100) {
            this.deliveries.length = 100;
        }

        // Track delivered fingerprints if successful
        if (record.status === DigestDeliveryStatus.SUCCESS) {
            for (const fp of record.eventFingerprints) {
                this.deliveredFingerprints.add(fp);
            }
        }

        return delivery;
    }

    async getLatestSuccessfulDelivery(): Promise<DigestDeliveryRecord | null> {
        return this.deliveries.find((d) => d.status === DigestDeliveryStatus.SUCCESS) || null;
    }

    async getDeliveredFingerprints(): Promise<Set<string>> {
        return new Set(this.deliveredFingerprints);
    }

    async getDeliveryHistory(limit = 20): Promise<DigestDeliveryRecord[]> {
        return this.deliveries.slice(0, limit);
    }

    async recordCriticalAlert(eventId: string): Promise<void> {
        this.criticalAlertedEventIds.add(eventId);
    }

    async wasCriticalAlerted(eventId: string): Promise<boolean> {
        return this.criticalAlertedEventIds.has(eventId);
    }

    async clearHistory(): Promise<void> {
        this.deliveries = [];
        this.deliveredFingerprints.clear();
        this.criticalAlertedEventIds.clear();
    }
}
