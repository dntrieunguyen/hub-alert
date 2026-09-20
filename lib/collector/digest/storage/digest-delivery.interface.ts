import type { DigestDeliveryRecord, DigestDeliveryStatus } from '../types';

export interface IDigestDeliveryRepository {
    recordDelivery(record: Omit<DigestDeliveryRecord, 'id' | 'startedAt'>): Promise<DigestDeliveryRecord>;
    getLatestSuccessfulDelivery(): Promise<DigestDeliveryRecord | null>;
    getDeliveryForSlot(slotKey: string): Promise<DigestDeliveryRecord | null>;
    getDeliveredFingerprints(): Promise<Set<string>>;
    getDeliveryHistory(limit?: number): Promise<DigestDeliveryRecord[]>;
    clearHistory(): Promise<void>;
}
