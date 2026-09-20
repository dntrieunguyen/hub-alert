import { describe, expect, it } from 'vitest';
import { SourceTier, VerificationStatus } from '../../../lib/collector/types';
import { EventPriority, MarketEventType, type MarketEvent } from '../../../lib/collector/notifications/types';
import { CryptoDigestRankingService } from '../../../lib/collector/digest/crypto-digest-ranking.service';
import type { AggregatedMarketEvent } from '../../../lib/collector/digest/types';

describe('CryptoDigestRankingService', () => {
    const rankingService = new CryptoDigestRankingService();

    const createSampleEvent = (overrides: Partial<AggregatedMarketEvent> = {}): AggregatedMarketEvent => {
        const primaryEvent: MarketEvent = {
            id: 'evt_sample_1',
            title: 'Sample Event',
            url: 'https://sample.com',
            source: {
                id: 'coinbase',
                name: 'Coinbase Markets',
                tier: SourceTier.OFFICIAL,
                credibilityScore: 95,
            },
            category: 'CRYPTO_NEWS',
            eventType: MarketEventType.EXCHANGE_LISTING,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            priority: EventPriority.P0,
            impactScore: 90,
            tokens: ['PEPE'],
            symbols: ['$PEPE'],
            chains: ['Ethereum'],
            publishedAt: new Date(),
            createdAt: new Date(),
        };

        return {
            id: 'agg_sample_1',
            canonicalFingerprint: 'sample_fingerprint',
            primaryEvent,
            title: primaryEvent.title,
            canonicalUrl: primaryEvent.url,
            category: primaryEvent.category,
            eventType: primaryEvent.eventType,
            verificationStatus: primaryEvent.verificationStatus,
            tokens: primaryEvent.tokens,
            symbols: primaryEvent.symbols,
            chains: primaryEvent.chains,
            topics: ['LISTING'],
            impactScore: primaryEvent.impactScore,
            publishedAt: primaryEvent.publishedAt,
            createdAt: primaryEvent.createdAt,
            sources: [
                {
                    id: 'coinbase',
                    name: 'Coinbase Markets',
                    tier: SourceTier.OFFICIAL,
                    credibilityScore: 95,
                    url: 'https://sample.com',
                    publishedAt: new Date(),
                },
            ],
            sourceCount: 1,
            officialSourceCount: 1,
            newsSourceCount: 0,
            socialSourceCount: 0,
            ...overrides,
        };
    };

    it('should score 100 for Government / Central Bank / Fed sources', () => {
        const fedEvent = createSampleEvent({
            sources: [
                {
                    id: 'fed',
                    name: 'Federal Reserve',
                    tier: SourceTier.OFFICIAL,
                    credibilityScore: 100,
                    url: 'https://federalreserve.gov',
                    publishedAt: new Date(),
                },
            ],
        });
        expect(rankingService.calculateCredibilityScore(fedEvent)).toBe(100);
    });

    it('should score 95 for top exchanges like Coinbase or Binance and top news like Reuters', () => {
        const coinbaseEvent = createSampleEvent();
        expect(rankingService.calculateCredibilityScore(coinbaseEvent)).toBe(95);

        const reutersEvent = createSampleEvent({
            sources: [
                {
                    id: 'reuters',
                    name: 'Reuters',
                    tier: SourceTier.NEWS,
                    credibilityScore: 95,
                    url: 'https://reuters.com',
                    publishedAt: new Date(),
                },
            ],
        });
        expect(rankingService.calculateCredibilityScore(reutersEvent)).toBe(95);
    });

    it('should score 85 for tier-1 crypto media (CoinDesk, The Block) and 80 for Decrypt', () => {
        const coindeskEvent = createSampleEvent({
            sources: [
                {
                    id: 'coindesk',
                    name: 'CoinDesk',
                    tier: SourceTier.NEWS,
                    credibilityScore: 85,
                    url: 'https://coindesk.com',
                    publishedAt: new Date(),
                },
            ],
        });
        expect(rankingService.calculateCredibilityScore(coindeskEvent)).toBe(85);

        const decryptEvent = createSampleEvent({
            sources: [
                {
                    id: 'decrypt',
                    name: 'Decrypt',
                    tier: SourceTier.NEWS,
                    credibilityScore: 80,
                    url: 'https://decrypt.co',
                    publishedAt: new Date(),
                },
            ],
        });
        expect(rankingService.calculateCredibilityScore(decryptEvent)).toBe(80);
    });

    it('should correctly score verification weight according to Section 6', () => {
        expect(rankingService.calculateVerificationScore(createSampleEvent({ verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE }))).toBe(100);
        expect(rankingService.calculateVerificationScore(createSampleEvent({ verificationStatus: VerificationStatus.CONFIRMED_MULTI_SOURCE }))).toBe(95);
        expect(rankingService.calculateVerificationScore(createSampleEvent({ verificationStatus: VerificationStatus.ATTRIBUTED_STATEMENT }))).toBe(85);
        expect(rankingService.calculateVerificationScore(createSampleEvent({ verificationStatus: VerificationStatus.OFFICIAL_SOCIAL_ONLY }))).toBe(75);
        expect(rankingService.calculateVerificationScore(createSampleEvent({ verificationStatus: VerificationStatus.UNVERIFIED }))).toBe(30);
        expect(rankingService.calculateVerificationScore(createSampleEvent({ verificationStatus: VerificationStatus.DISPUTED }))).toBe(0);
    });

    it('should boost cross-source score when multiple independent sources report', () => {
        const singleSource = createSampleEvent({ sourceCount: 1, officialSourceCount: 1 });
        const multiSource = createSampleEvent({
            sourceCount: 3,
            officialSourceCount: 1,
            newsSourceCount: 2,
            socialSourceCount: 1,
        });

        const singleScore = rankingService.calculateCrossSourceScore(singleSource);
        const multiScore = rankingService.calculateCrossSourceScore(multiSource);

        expect(multiScore).toBeGreaterThan(singleScore);
        expect(multiScore).toBe(100);
    });

    it('should decay recency score across the lookback window', () => {
        const now = new Date();
        const freshScore = rankingService.calculateRecencyScore(now, 6);
        expect(freshScore).toBe(100);

        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const olderScore = rankingService.calculateRecencyScore(fourHoursAgo, 6);
        expect(olderScore).toBeLessThan(freshScore);
        expect(olderScore).toBeGreaterThanOrEqual(40);
    });

    it('should calculate overall weighted digestRankingScore in 0-100 range', () => {
        const event = createSampleEvent();
        const breakdown = rankingService.calculateRankingScore(event, 6);

        expect(breakdown.totalRankingScore).toBeGreaterThan(70);
        expect(breakdown.totalRankingScore).toBeLessThanOrEqual(100);
        expect(breakdown.credibilityScore).toBe(95);
        expect(breakdown.informationImpact).toBe(90);
    });
});
