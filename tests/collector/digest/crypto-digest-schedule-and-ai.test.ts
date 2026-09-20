import { describe, expect, it, vi } from 'vitest';
import { CryptoDigestConfigService } from '../../../lib/collector/digest/crypto-digest-config.service';
import { CryptoDigestRankingService } from '../../../lib/collector/digest/crypto-digest-ranking.service';
import { CryptoDigestScheduler } from '../../../lib/collector/digest/crypto-digest-scheduler';
import { CryptoDigestSelectionService } from '../../../lib/collector/digest/crypto-digest-selection.service';
import { CryptoDigestService } from '../../../lib/collector/digest/crypto-digest.service';
import type { AiNewsAnalysis } from '../../../lib/collector/intelligence/types';
import { EventPriority, type MarketEvent, MarketEventType, VerificationStatus } from '../../../lib/collector/notifications/types';
import type { IFeedRepository } from '../../../lib/collector/storage/feed-repository.interface';
import { type CryptoFeedItem, SourceTier } from '../../../lib/collector/types';

const createFeedItem = (id: string, overrides: Partial<CryptoFeedItem> = {}): CryptoFeedItem => ({
    id,
    externalId: id,
    fingerprint: `fp_${id}`,
    sourceId: 'src_1',
    sourceName: 'Federal Reserve',
    sourceTier: SourceTier.OFFICIAL,
    category: 'MACRO',
    title: `Federal Reserve Statement ${id}`,
    summary: 'Central bank statement on monetary policy',
    content: 'Full content of statement',
    url: `https://federalreserve.gov/press/${id}`,
    publishedAt: new Date(Date.now() - 30 * 60 * 1000),
    collectedAt: new Date(),
    tokens: ['BTC'],
    symbols: ['$BTC'],
    chains: [],
    topics: ['MACRO'],
    entities: ['Federal Reserve'],
    credibilityScore: 100,
    impactScore: 95,
    breaking: false,
    ...overrides,
});

describe('CryptoDigestScheduler: 05:00 / 11:00 / 17:00 Schedule & Windows', () => {
    it('should compute correct next run target for morning, noon, and evening in Asia/Ho_Chi_Minh', () => {
        const tz = 'Asia/Ho_Chi_Minh';

        // 1. When it is 02:00 in Vietnam, next target is 05:00 today
        const at0200 = new Date('2026-09-20T02:00:00+07:00');
        const nextFrom0200 = CryptoDigestScheduler.getNextScheduledRun(at0200, tz);
        const parts0200 = CryptoDigestScheduler.getVietnamTimeParts(nextFrom0200, tz);
        expect(parts0200.hour).toBe(5);

        // 2. When it is 06:00 in Vietnam, next target is 11:00 today
        const at0600 = new Date('2026-09-20T06:00:00+07:00');
        const nextFrom0600 = CryptoDigestScheduler.getNextScheduledRun(at0600, tz);
        const parts0600 = CryptoDigestScheduler.getVietnamTimeParts(nextFrom0600, tz);
        expect(parts0600.hour).toBe(11);

        // 3. When it is 12:00 in Vietnam, next target is 17:00 today
        const at1200 = new Date('2026-09-20T12:00:00+07:00');
        const nextFrom1200 = CryptoDigestScheduler.getNextScheduledRun(at1200, tz);
        const parts1200 = CryptoDigestScheduler.getVietnamTimeParts(nextFrom1200, tz);
        expect(parts1200.hour).toBe(17);

        // 4. When it is 18:00 in Vietnam (all passed), next target is 05:00 tomorrow
        const at1800 = new Date('2026-09-20T18:00:00+07:00');
        const nextFrom1800 = CryptoDigestScheduler.getNextScheduledRun(at1800, tz);
        const parts1800 = CryptoDigestScheduler.getVietnamTimeParts(nextFrom1800, tz);
        expect(parts1800.hour).toBe(5);
    });

    it('should compute lookback window correctly for 05:00, 11:00, and 17:00 slots', () => {
        const tz = 'Asia/Ho_Chi_Minh';

        // At 05:00 slot (morning): lookback covers 12 hours (back to 17:00 yesterday)
        const at0500 = new Date('2026-09-20T05:00:00+07:00');
        const window0500 = CryptoDigestScheduler.computeWindowFrom(at0500, tz, 12);
        const diffHours0500 = (at0500.getTime() - window0500.getTime()) / (1000 * 60 * 60);
        expect(diffHours0500).toBe(12);

        // At 11:00 slot (noon): lookback covers 6 hours (back to 05:00)
        const at1100 = new Date('2026-09-20T11:00:00+07:00');
        const window1100 = CryptoDigestScheduler.computeWindowFrom(at1100, tz, 12);
        const diffHours1100 = (at1100.getTime() - window1100.getTime()) / (1000 * 60 * 60);
        expect(diffHours1100).toBe(6);

        // If last successful delivery exists, prioritizes it
        const lastRun = new Date(at1100.getTime() - 4 * 60 * 60 * 1000);
        const windowWithLastRun = CryptoDigestScheduler.computeWindowFrom(at1100, tz, 12, lastRun);
        expect(windowWithLastRun.getTime()).toBe(lastRun.getTime());
    });
});

describe('CryptoDigestRankingService: Combined AI Scoring', () => {
    it('should incorporate AI informationValue (15%) and marketRelevance (10%) when AI analysis is present', () => {
        const rankingService = new CryptoDigestRankingService();

        const itemWithAi: any = {
            id: 'item_1',
            title: 'Coinbase niêm yết $PEPE',
            sources: [{ name: 'Coinbase', tier: SourceTier.OFFICIAL, credibilityScore: 95 }],
            primaryEvent: { source: { name: 'Coinbase', tier: SourceTier.OFFICIAL, credibilityScore: 95 } },
            impactScore: 90,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            publishedAt: new Date(Date.now() - 30 * 60 * 1000),
            sourceCount: 1,
            officialSourceCount: 1,
            newsSourceCount: 0,
            socialSourceCount: 0,
            eventType: MarketEventType.EXCHANGE_LISTING,
            tokens: ['PEPE'],
            aiAnalysis: {
                informationValueScore: 95,
                marketRelevanceScore: 90,
            },
        };

        const weights = {
            credibility: 0.20,
            impact: 0.20,
            verification: 0.15,
            recency: 0.10,
            crossSource: 0.10,
            marketRelevance: 0.05,
            aiInformationValue: 0.15,
            aiMarketRelevance: 0.10,
        };

        const breakdown = rankingService.calculateRankingScore(itemWithAi, 6, weights);
        expect(breakdown.aiInformationValue).toBe(95);
        expect(breakdown.aiMarketRelevance).toBe(90);
        expect(breakdown.totalRankingScore).toBeGreaterThanOrEqual(90);
    });

    it('should seamlessly fallback to deterministic ranking weights if AI analysis is not present', () => {
        const rankingService = new CryptoDigestRankingService();

        const itemWithoutAi: any = {
            id: 'item_no_ai',
            title: 'Coinbase niêm yết $PEPE',
            sources: [{ name: 'Coinbase', tier: SourceTier.OFFICIAL, credibilityScore: 95 }],
            primaryEvent: { source: { name: 'Coinbase', tier: SourceTier.OFFICIAL, credibilityScore: 95 } },
            impactScore: 90,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            publishedAt: new Date(Date.now() - 30 * 60 * 1000),
            sourceCount: 1,
            officialSourceCount: 1,
            newsSourceCount: 0,
            socialSourceCount: 0,
            eventType: MarketEventType.EXCHANGE_LISTING,
            tokens: ['PEPE'],
            aiAnalysis: undefined,
        };

        const weights = {
            credibility: 0.20,
            impact: 0.20,
            verification: 0.15,
            recency: 0.10,
            crossSource: 0.10,
            marketRelevance: 0.05,
            aiInformationValue: 0.15,
            aiMarketRelevance: 0.10,
        };

        const breakdown = rankingService.calculateRankingScore(itemWithoutAi, 6, weights);
        expect(breakdown.aiInformationValue).toBeUndefined();
        expect(breakdown.totalRankingScore).toBeGreaterThanOrEqual(85);
    });
});

describe('CryptoDigestService: End-to-End AI Digest Integration', () => {
    it('should execute full AI digest pipeline and select Top <= 10 quality events without padding', async () => {
        const items = [
            createFeedItem('item_1', { title: 'Fed cuts interest rates', impactScore: 98, tokens: ['BTC'] }),
            createFeedItem('item_2', { title: 'Coinbase lists PEPE', sourceName: 'Coinbase', impactScore: 92, tokens: ['PEPE'] }),
            createFeedItem('item_3', { title: 'SEC approves crypto ETF', sourceName: 'SEC', impactScore: 96, tokens: ['ETH'] }),
        ];

        const mockRepo: IFeedRepository = {
            findItems: vi.fn().mockResolvedValue({ items, total: 3 }),
            saveItem: vi.fn(),
            saveItems: vi.fn(),
            findByFingerprint: vi.fn(),
            deleteOlderThan: vi.fn(),
            count: vi.fn().mockResolvedValue(3),
            getStats: vi.fn(),
        } as unknown as IFeedRepository;

        const mockAiAnalyzer = {
            providerName: 'deepseek',
            analyzeEvents: vi.fn().mockResolvedValue(
                new Map([
                    [
                        'evt_item_1',
                        {
                            eventId: 'evt_item_1',
                            isValuable: true,
                            titleVi: 'Fed chính thức cắt giảm lãi suất',
                            summaryVi: 'Cục Dự trữ Liên bang Mỹ vừa công bố cắt giảm lãi suất 50bps.',
                            whyItMattersVi: 'Kích thích thanh khoản và tạo động lực tăng trưởng cho thị trường rủi ro.',
                            informationValueScore: 98,
                            marketRelevanceScore: 99,
                        },
                    ],
                    [
                        'evt_item_2',
                        {
                            eventId: 'evt_item_2',
                            isValuable: true,
                            titleVi: 'Coinbase niêm yết token PEPE',
                            summaryVi: 'Sàn Coinbase mở rộng hỗ trợ giao dịch cho PEPE.',
                            whyItMattersVi: 'Tăng mạnh thanh khoản và mở rộng tệp nhà đầu tư.',
                            informationValueScore: 90,
                            marketRelevanceScore: 92,
                        },
                    ],
                ])
            ),
            analyzeSingleEvent: vi.fn(),
        };

        const digestService = new CryptoDigestService(mockRepo, {
            aiAnalyzer: mockAiAnalyzer as any,
        });

        const result = await digestService.generateAndSendDigest({ dryRun: true });
        expect(result.success).toBe(true);
        // Only 3 items in input, so output should be 3 items, never padded to 10!
        expect(result.itemCount).toBe(3);
        expect(result.previewText).toContain('🚀 CRYPTO MARKET INTELLIGENCE');
        expect(result.previewText).toContain('Fed chính thức cắt giảm lãi suất');
        expect(result.previewText).toContain('🧭 TÓM TẮT THỊ TRƯỜNG');
        expect(result.previewText).toContain('NARRATIVE CHÍNH');
    });
});
