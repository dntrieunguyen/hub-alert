import { createHash } from 'node:crypto';

export class FeedDeduplicationService {
    private seenFingerprints: Set<string> = new Set();
    private maxCacheSize: number;

    constructor(maxCacheSize = 50000) {
        this.maxCacheSize = maxCacheSize;
    }

    /**
     * Generates a deterministic SHA-256 fingerprint for an item.
     */
    generateFingerprint(title: string, url: string, externalId?: string): string {
        const normalizedTitle = title
            .toLowerCase()
            .replaceAll(/[^\p{L}\p{N}\s]/gu, '')
            .replaceAll(/\s+/g, ' ')
            .trim();

        let cleanUrl = (url || '').trim();
        try {
            if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
                const parsed = new URL(cleanUrl);
                cleanUrl = `${parsed.hostname}${parsed.pathname}`;
            }
        } catch {
            cleanUrl = cleanUrl.split('?')[0];
        }
        const normalizedUrl = cleanUrl
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/+$/, '')
            .trim();

        const rawString = `${normalizedTitle}|${normalizedUrl || externalId || ''}`;
        return createHash('sha256').update(rawString).digest('hex');
    }

    /**
     * Checks if the fingerprint was already processed in this deduplication scope.
     */
    isDuplicate(fingerprint: string): boolean {
        return this.seenFingerprints.has(fingerprint);
    }

    /**
     * Marks a fingerprint as seen.
     */
    markSeen(fingerprint: string): void {
        if (this.seenFingerprints.size >= this.maxCacheSize) {
            // Trim oldest items
            const toDelete = Math.floor(this.maxCacheSize * 0.2);
            let count = 0;
            for (const key of this.seenFingerprints) {
                if (count++ >= toDelete) {
                    break;
                }
                this.seenFingerprints.delete(key);
            }
        }
        this.seenFingerprints.add(fingerprint);
    }

    /**
     * Calculates Jaccard similarity between two titles (word token sets)
     */
    calculateTitleSimilarity(titleA: string, titleB: string): number {
        const tokenize = (t: string) =>
            new Set(
                t
                    .toLowerCase()
                    .replaceAll(/[^\p{L}\p{N}\s]/gu, '')
                    .split(/\s+/)
                    .filter((w) => w.length > 2)
            );

        const setA = tokenize(titleA);
        const setB = tokenize(titleB);

        if (setA.size === 0 || setB.size === 0) {
            return 0;
        }

        let intersection = 0;
        for (const word of setA) {
            if (setB.has(word)) {
                intersection++;
            }
        }

        const union = setA.size + setB.size - intersection;
        return union === 0 ? 0 : intersection / union;
    }
}
