import { describe, expect, it } from 'vitest';

import { FeedDeduplicationService } from '../../lib/collector/deduplication/feed-deduplication.service';

describe('FeedDeduplicationService', () => {
    const deduplication = new FeedDeduplicationService();

    it('should generate identical fingerprints for same normalized title and url', () => {
        const title1 = 'Bitcoin Hits $100,000 Milestone!';
        const url1 = 'https://coindesk.com/markets/bitcoin-100k?utm_source=twitter&ref=feed';

        const title2 = 'bitcoin hits 100000 milestone';
        const url2 = 'https://coindesk.com/markets/bitcoin-100k/';

        const fp1 = deduplication.generateFingerprint(title1, url1);
        const fp2 = deduplication.generateFingerprint(title2, url2);

        expect(fp1).toBe(fp2);
    });

    it('should generate different fingerprints for different articles', () => {
        const fp1 = deduplication.generateFingerprint('Ethereum Pectra upgrade scheduled', 'https://coindesk.com/eth');
        const fp2 = deduplication.generateFingerprint('Solana validator client release', 'https://coindesk.com/sol');

        expect(fp1).not.toBe(fp2);
    });

    it('should correctly detect and mark duplicate items', () => {
        const fp = deduplication.generateFingerprint('SEC delays ETF decision', 'https://reuters.com/sec-etf');
        expect(deduplication.isDuplicate(fp)).toBe(false);

        deduplication.markSeen(fp);
        expect(deduplication.isDuplicate(fp)).toBe(true);
    });

    it('should calculate title similarity for cross-source deduplication', () => {
        const title1 = 'Binance Announces Listing of PEPE Token for Spot Trading';
        const title2 = 'Binance to List PEPE with New Spot Trading Pairs';
        const title3 = 'Federal Reserve Leaves Interest Rates Unchanged';

        const similaritySame = deduplication.calculateTitleSimilarity(title1, title2);
        const similarityDifferent = deduplication.calculateTitleSimilarity(title1, title3);

        expect(similaritySame).toBeGreaterThanOrEqual(0.3);
        expect(similarityDifferent).toBeLessThan(0.1);
    });
});
