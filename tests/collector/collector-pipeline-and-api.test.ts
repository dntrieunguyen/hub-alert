import { describe, expect, it } from 'vitest';

import { createCollectorRouter } from '../../lib/collector/api/collector-router';
import { CollectorService } from '../../lib/collector/collector.service';
import { FeedSchedulerService } from '../../lib/collector/scheduler/feed-scheduler.service';
import { FeedSourceService } from '../../lib/collector/sources/feed-source.service';
import { InMemoryFeedRepository } from '../../lib/collector/storage/in-memory-feed.repository';
import { TokenTrendService } from '../../lib/collector/trends/token-trend.service';
import { type FeedSource, SourceTier } from '../../lib/collector/types';

describe('Collector Pipeline & REST API End-to-End', () => {
    it('should collect, normalize, extract, score, deduplicate, and expose via API', async () => {
        const repository = new InMemoryFeedRepository();

        const mockClient: any = {
            fetchFeed: async (source: FeedSource) => {
                if (source.id === 'binance-test') {
                    return {
                        sourceId: source.id,
                        durationMs: 40,
                        feed: {
                            title: 'Binance Announcements',
                            items: [
                                {
                                    id: 'binance-1',
                                    title: 'Binance Will List Pepe (PEPE) with USDT Margin',
                                    link: 'https://binance.com/announcement/pepe',
                                    pubDate: new Date().toISOString(),
                                    description: 'Binance opens spot trading for PEPE on Ethereum network.',
                                },
                            ],
                        },
                    };
                }
                if (source.id === 'fed-test') {
                    return {
                        sourceId: source.id,
                        durationMs: 50,
                        feed: {
                            title: 'Federal Reserve Press',
                            items: [
                                {
                                    id: 'fed-1',
                                    title: 'FOMC Statement: Federal Reserve cuts interest rate by 25 bps as CPI cools',
                                    link: 'https://federalreserve.gov/press/1',
                                    pubDate: new Date().toISOString(),
                                    description: 'Inflation is moderating towards the 2% target.',
                                },
                            ],
                        },
                    };
                }
                return {
                    sourceId: source.id,
                    durationMs: 30,
                    feed: { items: [] },
                };
            },
        };

        const collector = new CollectorService(repository, { client: mockClient });

        const binanceSource: FeedSource = {
            id: 'binance-test',
            name: 'Binance',
            enabled: true,
            category: 'CRYPTO_NEWS',
            sourceTier: SourceTier.OFFICIAL,
            rssUrl: '/binance',
            pollingInterval: 120,
            credibilityScore: 98,
            tags: ['binance', 'listing'],
            failureCount: 0,
            nextFetchAt: new Date(),
        };

        const fedSource: FeedSource = {
            id: 'fed-test',
            name: 'Federal Reserve',
            enabled: true,
            category: 'MARKET',
            sourceTier: SourceTier.OFFICIAL,
            rssUrl: 'https://federalreserve.gov/press',
            pollingInterval: 300,
            credibilityScore: 100,
            tags: ['fed', 'macro'],
            failureCount: 0,
            nextFetchAt: new Date(),
        };

        const sourceService = new FeedSourceService([binanceSource, fedSource]);

        // 1. Process first time
        const result1 = await collector.collectAndProcessSource(binanceSource);
        expect(result1.received).toBe(1);
        expect(result1.created).toBe(1);
        expect(result1.duplicates).toBe(0);

        const savedPepe = result1.items[0];
        expect(savedPepe.tokens).toContain('PEPE');
        expect(savedPepe.topics).toContain('LISTING');
        expect(savedPepe.chains).toContain('Ethereum');
        expect(savedPepe.breaking).toBe(true);
        expect(savedPepe.credibilityScore).toBe(98);

        // 2. Process duplicate run: should not create duplicates
        const result2 = await collector.collectAndProcessSource(binanceSource);
        expect(result2.received).toBe(1);
        expect(result2.created).toBe(0);
        expect(result2.duplicates).toBe(1);

        // 3. Process Fed macro event
        const fedResult = await collector.collectAndProcessSource(fedSource);
        expect(fedResult.created).toBe(1);
        const savedFed = fedResult.items[0];
        expect(savedFed.category).toBe('MARKET');
        expect(savedFed.topics).toContain('FED');
        expect(savedFed.topics).toContain('INFLATION');
        expect(savedFed.impactScore).toBeGreaterThanOrEqual(70);

        // 4. Test Trends
        const trendService = new TokenTrendService(repository);
        const memeTrends = await trendService.getMemeTrends('1h');
        expect(memeTrends.length).toBeGreaterThanOrEqual(1);
        expect(memeTrends[0].symbol).toBe('PEPE');
        expect(memeTrends[0].officialMentions).toBe(1);
        expect(memeTrends[0].trendingScore).toBeGreaterThan(0);

        // 5. Test REST API Router
        const router = createCollectorRouter({
            repository,
            trendService,
            sourceService,
            collectorService: collector,
        });

        // Test GET /feeds
        const resFeeds = await router.request('/feeds?token=PEPE');
        expect(resFeeds.status).toBe(200);
        const dataFeeds: any = await resFeeds.json();
        expect(dataFeeds.items).toHaveLength(1);
        expect(dataFeeds.items[0].tokens).toContain('PEPE');

        // Test GET /feeds/breaking
        const resBreaking = await router.request('/feeds/breaking');
        expect(resBreaking.status).toBe(200);
        const dataBreaking: any = await resBreaking.json();
        expect(dataBreaking.items.length).toBeGreaterThanOrEqual(1);

        // Test GET /market/events
        const resMacro = await router.request('/market/events');
        expect(resMacro.status).toBe(200);
        const dataMacro: any = await resMacro.json();
        expect(dataMacro.items.length).toBeGreaterThanOrEqual(1);
        expect(dataMacro.items[0].category).toBe('MARKET');

        // Test GET /trends/memes
        const resMemes = await router.request('/trends/memes?window=1h');
        expect(resMemes.status).toBe(200);
        const dataMemes: any = await resMemes.json();
        expect(dataMemes[0].symbol).toBe('PEPE');

        // Test GET /sources
        const resSources = await router.request('/sources');
        expect(resSources.status).toBe(200);
        const dataSources: any = await resSources.json();
        expect(dataSources.count).toBe(2);

        // 6. Test Scheduler tick
        const scheduler = new FeedSchedulerService(sourceService, collector, { concurrency: 2 });
        binanceSource.nextFetchAt = new Date(Date.now() - 1000);
        fedSource.nextFetchAt = new Date(Date.now() - 1000);

        const tickResult = await scheduler.tick();
        expect(tickResult.processed).toBe(2);
        expect(tickResult.failed).toBe(0);
    });

    it('should handle GET /feeds/latest and GET /latest as Market Intelligence without sending to Google Chat on GET', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'test-item-1',
            externalId: 'ext-1',
            fingerprint: 'fp-1',
            sourceId: 'source-1',
            sourceName: 'CoinDesk',
            sourceTier: SourceTier.NEWS,
            category: 'CRYPTO_NEWS',
            title: 'Bitcoin Surges Past $100K in Historic Rally',
            summary: 'BTC hit a record high today amid massive institutional inflows.',
            url: 'https://coindesk.com/btc-100k',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: ['BTC'],
            symbols: ['$BTC'],
            chains: ['Bitcoin'],
            topics: ['MARKET'],
            entities: [],
            credibilityScore: 90,
            impactScore: 95,
            breaking: true,
        });

        const sentMessages: string[] = [];
        const mockNotificationModule: any = {
            configService: {
                isEnabled: () => true,
            },
            formatter: {
                formatVietnamTime: (d: Date) => d.toISOString(),
            },
            notificationService: {
                sendText: async (text: string) => {
                    sentMessages.push(text);
                },
            },
        };

        const router = createCollectorRouter({
            repository,
            trendService: {} as any,
            sourceService: { getAllSources: () => [] } as any,
            collectorService: {} as any,
            notificationModule: mockNotificationModule,
        });

        // 1. Call GET /feeds/latest (returns Market Intelligence, DOES NOT auto-send to Google Chat)
        const resLatest = await router.request('/feeds/latest');
        expect(resLatest.status).toBe(200);
        const dataLatest: any = await resLatest.json();
        expect(dataLatest.items).toHaveLength(1);
        expect(dataLatest.items[0]).toHaveProperty('analysis');
        expect(dataLatest.items[0]).toHaveProperty('whyItMatters');
        expect(dataLatest).toHaveProperty('summary');
        expect(sentMessages).toHaveLength(0); // GET MUST NOT SEND GOOGLE CHAT!

        // 2. Call GET /latest (alias)
        const resAlias = await router.request('/latest');
        expect(resAlias.status).toBe(200);
        const dataAlias: any = await resAlias.json();
        expect(dataAlias.items).toHaveLength(1);
        expect(sentMessages).toHaveLength(0); // Still 0

        // 3. Call GET /latest/raw (debug raw feeds)
        const resRaw = await router.request('/latest/raw');
        expect(resRaw.status).toBe(200);
        const dataRaw: any = await resRaw.json();
        expect(dataRaw.items).toHaveLength(1);
        expect(dataRaw.items[0].title).toBe('Bitcoin Surges Past $100K in Historic Rally');

        // 4. Call explicit POST /latest/notify (triggers Google Chat dispatch)
        const resNotify = await router.request('/latest/notify', { method: 'POST' });
        expect(resNotify.status).toBe(200);
        const dataNotify: any = await resNotify.json();
        expect(dataNotify.sent).toBe(true);
        expect(sentMessages).toHaveLength(1);
        expect(sentMessages[0]).toContain('HUB ALERT');
    });
});
