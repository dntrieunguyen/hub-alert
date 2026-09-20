import type { CryptoFeedItem, FeedFilterOptions } from '../types';
import type { IFeedRepository } from './feed-repository.interface';

export class InMemoryFeedRepository implements IFeedRepository {
    private items: Map<string, CryptoFeedItem> = new Map();
    private fingerprintMap: Map<string, string> = new Map();

    async saveItem(item: CryptoFeedItem): Promise<boolean> {
        if (this.fingerprintMap.has(item.fingerprint)) {
            return false;
        }
        this.items.set(item.id, { ...item });
        this.fingerprintMap.set(item.fingerprint, item.id);
        return true;
    }

    async saveBatch(items: CryptoFeedItem[]): Promise<{ saved: number; duplicates: number }> {
        let saved = 0;
        let duplicates = 0;
        for (const item of items) {
            const isSaved = await this.saveItem(item);
            if (isSaved) {
                saved++;
            } else {
                duplicates++;
            }
        }
        return { saved, duplicates };
    }

    async findById(id: string): Promise<CryptoFeedItem | null> {
        const item = this.items.get(id);
        return item ? { ...item } : null;
    }

    async findByFingerprint(fingerprint: string): Promise<CryptoFeedItem | null> {
        const id = this.fingerprintMap.get(fingerprint);
        if (!id) {
            return null;
        }
        return this.findById(id);
    }

    async hasFingerprint(fingerprint: string): Promise<boolean> {
        return this.fingerprintMap.has(fingerprint);
    }

    async findItems(options: FeedFilterOptions = {}): Promise<{ items: CryptoFeedItem[]; total: number }> {
        let results = Array.from(this.items.values());

        // Apply filters
        if (options.category) {
            results = results.filter((i) => i.category === options.category);
        }
        if (options.sourceId) {
            results = results.filter((i) => i.sourceId === options.sourceId);
        }
        if (options.sourceTier) {
            results = results.filter((i) => i.sourceTier === options.sourceTier);
        }
        if (options.token) {
            const upperToken = options.token.toUpperCase().replace(/^\$/, '');
            results = results.filter((i) => i.tokens.includes(upperToken));
        }
        if (options.topic) {
            const upperTopic = options.topic.toUpperCase();
            results = results.filter((i) => i.topics.includes(upperTopic));
        }
        if (options.breaking !== undefined) {
            results = results.filter((i) => i.breaking === options.breaking);
        }
        if (options.minCredibility !== undefined) {
            results = results.filter((i) => i.credibilityScore >= options.minCredibility!);
        }
        if (options.from) {
            const fromMs = options.from.getTime();
            results = results.filter((i) => i.publishedAt.getTime() >= fromMs);
        }
        if (options.to) {
            const toMs = options.to.getTime();
            results = results.filter((i) => i.publishedAt.getTime() <= toMs);
        }
        if (options.platform) {
            results = results.filter((i) => i.platform === options.platform);
        }
        if (options.xSourceType) {
            results = results.filter((i) => i.xSourceType === options.xSourceType);
        }
        if (options.handle) {
            const cleanHandle = options.handle.toLowerCase().replace(/^@/, '');
            results = results.filter((i) => i.handle?.toLowerCase() === cleanHandle);
        }
        if (options.verificationStatus) {
            results = results.filter((i) => i.xMetadata?.verificationStatus === options.verificationStatus);
        }
        if (options.eventType) {
            results = results.filter((i) => i.metadata?.eventType === options.eventType);
        }

        // Sort by publishedAt descending
        results.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

        const total = results.length;
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 50;
        const paginated = results.slice(offset, offset + limit);

        return {
            items: paginated,
            total,
        };
    }

    async findLatest(limit = 20): Promise<CryptoFeedItem[]> {
        const { items } = await this.findItems({ limit });
        return items;
    }

    async findBreaking(limit = 20): Promise<CryptoFeedItem[]> {
        const { items } = await this.findItems({ breaking: true, limit });
        return items;
    }

    async findMacroEvents(limit = 20): Promise<CryptoFeedItem[]> {
        const { items } = await this.findItems({ category: 'MARKET', limit });
        return items;
    }

    async findRecentItemsForWindow(windowMs: number): Promise<CryptoFeedItem[]> {
        const threshold = Date.now() - windowMs;
        return Array.from(this.items.values()).filter((i) => i.publishedAt.getTime() >= threshold);
    }

    async count(): Promise<number> {
        return this.items.size;
    }

    async clear(): Promise<void> {
        this.items.clear();
        this.fingerprintMap.clear();
    }
}
