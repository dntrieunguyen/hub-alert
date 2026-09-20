import type { CryptoFeedItem, FeedFilterOptions } from '../types';

export interface IFeedRepository {
    saveItem(item: CryptoFeedItem): Promise<boolean>;
    saveBatch(items: CryptoFeedItem[]): Promise<{ saved: number; duplicates: number }>;
    findById(id: string): Promise<CryptoFeedItem | null>;
    findByFingerprint(fingerprint: string): Promise<CryptoFeedItem | null>;
    hasFingerprint(fingerprint: string): Promise<boolean>;
    findItems(options?: FeedFilterOptions): Promise<{ items: CryptoFeedItem[]; total: number }>;
    findLatest(limit?: number): Promise<CryptoFeedItem[]>;
    findBreaking(limit?: number): Promise<CryptoFeedItem[]>;
    findMacroEvents(limit?: number): Promise<CryptoFeedItem[]>;
    findRecentItemsForWindow(windowMs: number): Promise<CryptoFeedItem[]>;
    count(): Promise<number>;
    clear(): Promise<void>;
}
