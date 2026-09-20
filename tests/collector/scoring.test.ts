import { describe, expect, it } from 'vitest';

import { BreakingNewsService } from '../../lib/collector/scoring/breaking-news.service';
import { CredibilityScoreService } from '../../lib/collector/scoring/credibility-score.service';
import { MarketImpactScoreService } from '../../lib/collector/scoring/market-impact-score.service';
import { TrendScoreService } from '../../lib/collector/scoring/trend-score.service';
import { type CryptoFeedItem, type FeedSource, SourceTier } from '../../lib/collector/types';

describe('Scoring Services', () => {
    describe('CredibilityScoreService', () => {
        const credibilityService = new CredibilityScoreService();

        it('should correctly score sources across all tiers within baseline bounds', () => {
            const officialSource: FeedSource = {
                id: 'binance',
                name: 'Binance',
                enabled: true,
                category: 'CRYPTO_NEWS',
                sourceTier: SourceTier.OFFICIAL,
                rssUrl: '/binance',
                pollingInterval: 120,
                credibilityScore: 98,
                tags: [],
                failureCount: 0,
                nextFetchAt: new Date(),
            };
            expect(credibilityService.calculateScore(officialSource)).toBe(98);

            const newsSource: FeedSource = {
                ...officialSource,
                id: 'news',
                sourceTier: SourceTier.NEWS,
                credibilityScore: 85,
            };
            expect(credibilityService.calculateScore(newsSource)).toBe(85);

            const socialSource: FeedSource = {
                ...officialSource,
                id: 'social',
                sourceTier: SourceTier.SOCIAL,
                credibilityScore: 60,
            };
            expect(credibilityService.calculateScore(socialSource)).toBe(60);

            const communitySource: FeedSource = {
                ...officialSource,
                id: 'reddit',
                sourceTier: SourceTier.COMMUNITY,
                credibilityScore: 45,
            };
            expect(credibilityService.calculateScore(communitySource)).toBe(45);
        });

        it('should clamp out-of-bound scores to tier baselines', () => {
            const lowOfficial: FeedSource = {
                id: 'fed',
                name: 'Fed',
                enabled: true,
                category: 'MARKET',
                sourceTier: SourceTier.OFFICIAL,
                rssUrl: '/fed',
                pollingInterval: 120,
                credibilityScore: 20,
                tags: [],
                failureCount: 0,
                nextFetchAt: new Date(),
            };
            expect(credibilityService.calculateScore(lowOfficial)).toBe(95);
        });
    });

    describe('MarketImpactScoreService', () => {
        const impactService = new MarketImpactScoreService();

        it('should assign high impact score to macro and market-moving events', () => {
            const highImpactItem: Partial<CryptoFeedItem> = {
                title: 'Federal Reserve announces surprise 50 bps interest rate cut following cool CPI',
                summary: 'FOMC statement highlights easing inflation and rising liquidity.',
                sourceTier: SourceTier.OFFICIAL,
                topics: ['FED', 'INFLATION', 'LIQUIDITY'],
            };

            const score = impactService.calculateImpactScore(highImpactItem);
            expect(score).toBeGreaterThanOrEqual(75);
        });

        it('should assign moderate impact score to routine articles', () => {
            const routineItem: Partial<CryptoFeedItem> = {
                title: 'Community meetup scheduled for next weekend in Berlin',
                summary: 'Developers gather to discuss open source tools.',
                sourceTier: SourceTier.COMMUNITY,
                topics: [],
            };

            const score = impactService.calculateImpactScore(routineItem);
            expect(score).toBeLessThan(30);
        });
    });

    describe('TrendScoreService', () => {
        const trendScoreService = new TrendScoreService();

        it('should compute normalized trend score between 0 and 100', () => {
            const scoreHigh = trendScoreService.calculateTrendScore({
                mentionVelocity: 15,
                uniqueSources: 8,
                avgEngagement: 80,
                avgCredibility: 90,
                latestMentionAgeMinutes: 10,
            });

            const scoreLow = trendScoreService.calculateTrendScore({
                mentionVelocity: 0.2,
                uniqueSources: 1,
                avgEngagement: 20,
                avgCredibility: 40,
                latestMentionAgeMinutes: 1200,
            });

            expect(scoreHigh).toBeGreaterThanOrEqual(80);
            expect(scoreHigh).toBeLessThanOrEqual(100);
            expect(scoreLow).toBeLessThan(30);
            expect(scoreLow).toBeGreaterThanOrEqual(0);
        });
    });

    describe('BreakingNewsService', () => {
        const breakingService = new BreakingNewsService(120, 15);

        it('should mark Tier 1 official listing announcement as breaking', () => {
            const officialItem: CryptoFeedItem = {
                id: '1',
                externalId: 'ext-1',
                fingerprint: 'fp-1',
                sourceId: 'binance-listings',
                sourceName: 'Binance',
                sourceTier: SourceTier.OFFICIAL,
                category: 'CRYPTO_NEWS',
                title: 'Binance Will List Pepe (PEPE) with Seed Tag Applied',
                url: 'https://binance.com/listing-pepe',
                publishedAt: new Date(),
                collectedAt: new Date(),
                tokens: ['PEPE'],
                symbols: ['$PEPE'],
                chains: ['Ethereum'],
                topics: ['LISTING'],
                entities: ['Binance'],
                credibilityScore: 98,
                impactScore: 85,
                breaking: false,
            };

            expect(breakingService.evaluateBreaking(officialItem, [])).toBe(true);
        });

        it('should mark cross-source confirmed events as breaking', () => {
            const now = new Date();
            const otherSources: CryptoFeedItem[] = [
                {
                    id: '2',
                    externalId: 'ext-2',
                    fingerprint: 'fp-2',
                    sourceId: 'coindesk',
                    sourceName: 'CoinDesk',
                    sourceTier: SourceTier.NEWS,
                    category: 'CRYPTO_NEWS',
                    title: 'Solana validator update released following network incident',
                    url: 'https://coindesk.com/sol-update',
                    publishedAt: new Date(now.getTime() - 2 * 60 * 1000),
                    collectedAt: new Date(),
                    tokens: ['SOL'],
                    symbols: ['$SOL'],
                    chains: ['Solana'],
                    topics: ['NETWORK_UPGRADE'],
                    entities: [],
                    credibilityScore: 88,
                    impactScore: 60,
                    breaking: false,
                },
                {
                    id: '3',
                    externalId: 'ext-3',
                    fingerprint: 'fp-3',
                    sourceId: 'theblock',
                    sourceName: 'The Block',
                    sourceTier: SourceTier.NEWS,
                    category: 'CRYPTO_NEWS',
                    title: 'New Solana client version distributed to validators',
                    url: 'https://theblock.co/sol-client',
                    publishedAt: new Date(now.getTime() - 4 * 60 * 1000),
                    collectedAt: new Date(),
                    tokens: ['SOL'],
                    symbols: ['$SOL'],
                    chains: ['Solana'],
                    topics: ['NETWORK_UPGRADE'],
                    entities: [],
                    credibilityScore: 89,
                    impactScore: 60,
                    breaking: false,
                },
            ];

            const incomingItem: CryptoFeedItem = {
                id: '4',
                externalId: 'ext-4',
                fingerprint: 'fp-4',
                sourceId: 'decrypt',
                sourceName: 'Decrypt',
                sourceTier: SourceTier.NEWS,
                category: 'CRYPTO_NEWS',
                title: 'Solana engineers issue patch for network upgrade',
                url: 'https://decrypt.co/sol-patch',
                publishedAt: now,
                collectedAt: now,
                tokens: ['SOL'],
                symbols: ['$SOL'],
                chains: ['Solana'],
                topics: ['NETWORK_UPGRADE'],
                entities: [],
                credibilityScore: 85,
                impactScore: 65,
                breaking: false,
            };

            expect(breakingService.evaluateBreaking(incomingItem, otherSources)).toBe(true);
        });
    });
});
