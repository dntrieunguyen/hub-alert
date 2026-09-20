import { describe, expect, it, vi } from 'vitest';
import { CryptoFeedItem, FeedCategory, SourceTier, VerificationStatus } from '../../../lib/collector/types';
import { EventPriority, MarketEventType, type MarketEvent } from '../../../lib/collector/notifications/types';
import { InMemoryFeedRepository } from '../../../lib/collector/storage/in-memory-feed.repository';
import { CryptoDigestConfigService } from '../../../lib/collector/digest/crypto-digest-config.service';
import { CryptoDigestService } from '../../../lib/collector/digest/crypto-digest.service';
import { CryptoDigestSelectionService, getSourceAuthoritativenessRank } from '../../../lib/collector/digest/crypto-digest-selection.service';
import { CryptoDigestRankingService } from '../../../lib/collector/digest/crypto-digest-ranking.service';
import { CryptoDigestFormatterService } from '../../../lib/collector/digest/crypto-digest-formatter.service';
import { CryptoDigestSummaryService } from '../../../lib/collector/digest/crypto-digest-summary.service';
import { isCryptoMarketRelevant, isValidTitle } from '../../../lib/collector/digest/crypto-digest-relevance.service';
import { detectGenericFiller, isValidHttpUrl, validateVietnameseOutput } from '../../../lib/collector/digest/crypto-digest-vietnamese-validator';
import { GoogleChatNotificationService } from '../../../lib/collector/notifications/google-chat/google-chat-notification.service';
import { NotificationConfigService } from '../../../lib/collector/notifications/config/notification-config.service';
import { MarketEventService } from '../../../lib/collector/notifications/events/market-event.service';
import type { AiNewsAnalyzer } from '../../../lib/collector/intelligence/ai-news-analyzer.interface';
import type { AiNewsAnalysis } from '../../../lib/collector/intelligence/types';
import app from '../../../lib/app';

describe('Top 10 Scheduled Crypto Intelligence Digest Refactor (35 Rules)', () => {
    const marketEventService = new MarketEventService();
    const rankingService = new CryptoDigestRankingService();
    const selectionService = new CryptoDigestSelectionService(rankingService);
    const summaryService = new CryptoDigestSummaryService();
    const formatterService = new CryptoDigestFormatterService();

    const makeEvent = (
        id: string,
        title: string,
        sourceName: string,
        tier: SourceTier,
        credibilityScore: number,
        tokens: string[],
        impactScore = 70,
        options: Partial<MarketEvent> = {}
    ): MarketEvent => ({
        id,
        feedItemId: `feed_${id}`,
        title,
        summary: `Summary of ${title}`,
        content: `Detailed content of ${title}`,
        url: `https://news.example.com/${id}`,
        source: {
            id: sourceName.toLowerCase().replace(/\s+/g, '-'),
            name: sourceName,
            tier,
            credibilityScore,
        },
        category: 'CRYPTO_NEWS' as FeedCategory,
        eventType: MarketEventType.GENERAL_NEWS,
        verificationStatus: tier === SourceTier.OFFICIAL ? VerificationStatus.CONFIRMED_PRIMARY_SOURCE : VerificationStatus.ATTRIBUTED_STATEMENT,
        priority: EventPriority.P2,
        tokens,
        symbols: tokens.map((t) => `$${t}`),
        chains: ['Ethereum'],
        publishedAt: new Date(Date.now() - 3600 * 1000),
        createdAt: new Date(),
        impactScore,
        confidence: 0.9,
        channels: [],
        ...options,
    });

    const defaultConfig = new CryptoDigestConfigService({
        CRYPTO_DIGEST_ENABLED: 'true',
        CRYPTO_DIGEST_LOOKBACK_HOURS: '6',
        CRYPTO_DIGEST_MAX_ITEMS: '10',
        CRYPTO_DIGEST_MIN_CREDIBILITY: '70',
        CRYPTO_DIGEST_MIN_RANKING_SCORE: '50',
        CRYPTO_DIGEST_MIN_IMPACT_SCORE: '45',
        CRYPTO_DIGEST_MIN_INFORMATION_VALUE: '60',
        CRYPTO_DIGEST_MIN_MARKET_RELEVANCE: '60',
        CRYPTO_DIGEST_MAX_PER_SOURCE: '2',
        CRYPTO_DIGEST_MAX_PER_TOKEN: '2',
        CRYPTO_DIGEST_MAX_PER_TOPIC: '3',
    }).getConfig();

    // 1. duplicate ETF articles become one event
    it('1. duplicate ETF articles become one event across multiple sources', async () => {
        const e1 = makeEvent('etf_1', 'Grayscale announces Zcash ETF split', 'CoinDesk', SourceTier.NEWS, 85, ['ZEC'], 80, {
            eventType: MarketEventType.ETF,
        });
        const e2 = makeEvent('etf_2', 'Zcash ETF to undergo 3-for-1 split', 'Reuters', SourceTier.NEWS, 95, ['ZEC'], 80, {
            eventType: MarketEventType.ETF,
        });
        const e3 = makeEvent('etf_3', 'Grayscale ZEC fund announces share split', 'Jin10', SourceTier.NEWS, 80, ['ZEC'], 80, {
            eventType: MarketEventType.ETF,
        });

        const selected = await selectionService.selectDigestEvents([e1, e2, e3], defaultConfig);

        expect(selected.length).toBe(1);
        expect(selected[0].sources.length).toBe(3);
        expect(selected[0].verificationStatus).toBe(VerificationStatus.CONFIRMED_MULTI_SOURCE);
    });

    // 2. Chinese unrelated financial news rejected
    it('2. Chinese unrelated financial news is rejected by isCryptoMarketRelevant', () => {
        const irrelevantChineseNews = {
            title: '上海建元智慧停充一期私募投资基金合伙企业（有限合伙）成立',
            summary: '出资额为20.02亿元人民币，经营范围包含以私募基金从事股权投资、投资管理、资产管理等活动。由隧道股份、陆家嘴信托等共同持股。',
            tokens: [],
            eventType: MarketEventType.GENERAL_NEWS,
        };

        expect(isCryptoMarketRelevant(irrelevantChineseNews)).toBe(false);
    });

    // 3. Chinese relevant crypto article translated to Vietnamese
    it('3. Chinese relevant crypto article is accepted and translated to Vietnamese', async () => {
        const chineseCryptoNews = makeEvent(
            'cn_btc',
            '香港虚拟资产现货ETF今日成交额超过3000万港元',
            'Jin10 Global Flash',
            SourceTier.NEWS,
            85,
            ['BTC', 'ETH'],
            75,
            { eventType: MarketEventType.ETF }
        );

        expect(isCryptoMarketRelevant(chineseCryptoNews)).toBe(true);

        const selected = await selectionService.selectDigestEvents([chineseCryptoNews], defaultConfig);
        expect(selected.length).toBe(1);

        const summaryService = new CryptoDigestSummaryService();
        const { title, summary } = summaryService.generateVietnameseSummary(selected[0]);
        selected[0].vietnameseTitle = title;
        selected[0].vietnameseSummary = summary;

        expect(validateVietnameseOutput(selected[0].vietnameseTitle)).toBe(true);
        expect(validateVietnameseOutput(selected[0].vietnameseSummary)).toBe(true);

        const formatter = new CryptoDigestFormatterService();
        const payload = {
            id: 'test_vn',
            title: 'Test Digest',
            periodHours: 6,
            generatedAt: new Date(),
            items: selected,
        };
        const text = formatter.formatDigest(payload);

        expect(text).toContain('🚀 CRYPTO INTELLIGENCE DIGEST');
        expect(text).toContain('ETF');
        expect(validateVietnameseOutput(text)).toBe(true);
    });

    // 4. Untitled rejected
    it('4. Untitled, empty, or too short titles are rejected by isValidTitle', () => {
        expect(isValidTitle('Untitled')).toBe(false);
        expect(isValidTitle('untitled')).toBe(false);
        expect(isValidTitle('No title')).toBe(false);
        expect(isValidTitle('N/A')).toBe(false);
        expect(isValidTitle('null')).toBe(false);
        expect(isValidTitle('undefined')).toBe(false);
        expect(isValidTitle('')).toBe(false);
        expect(isValidTitle('-')).toBe(false);
        expect(isValidTitle('Too short')).toBe(false); // < 15 chars
        expect(isValidTitle('Short headline')).toBe(false); // 14 chars
        expect(isValidTitle('Federal Reserve cuts interest rates by 50bps')).toBe(true);
    });

    // 5. impact score 15 rejected
    it('5. item with impactScore = 15 is rejected by quality gate', async () => {
        const lowImpactEvent = makeEvent(
            'low_impact',
            'Minor local project website update and maintenance',
            'CoinDesk',
            SourceTier.NEWS,
            85,
            ['BTC'],
            15 // impact 15
        );

        const selected = await selectionService.selectDigestEvents([lowImpactEvent], defaultConfig);
        expect(selected.length).toBe(0);
    });

    // 6. high credibility but irrelevant article rejected
    it('6. high credibility source with irrelevant non-crypto article is rejected', async () => {
        const highCredIrrelevant = makeEvent(
            'jin10_parking',
            '上海建元智慧停充一期私募投资基金正式设立运作',
            'Jin10 Flash',
            SourceTier.NEWS,
            90, // Credibility 90!
            [],
            20
        );

        expect(isCryptoMarketRelevant(highCredIrrelevant)).toBe(false);

        const selected = await selectionService.selectDigestEvents([highCredIrrelevant], defaultConfig);
        expect(selected.length).toBe(0);
    });

    // 7. same source max 2
    it('7. same source is capped at max 2 items in Top 10 (diversity control)', async () => {
        const jin10Events = [
            makeEvent('j1', 'Bitcoin surges past 65000 amidst US rate cuts', 'Jin10 Flash', SourceTier.NEWS, 80, ['BTC'], 85),
            makeEvent('j2', 'Ethereum layer 2 transactions reach new all time high', 'Jin10 Flash', SourceTier.NEWS, 80, ['ETH'], 80),
            makeEvent('j3', 'Solana decentralized exchanges see massive volume spike', 'Jin10 Flash', SourceTier.NEWS, 80, ['SOL'], 75),
            makeEvent('j4', 'Avalanche foundation announces multi million grant fund', 'Jin10 Flash', SourceTier.NEWS, 80, ['AVAX'], 70),
        ];

        const selected = await selectionService.selectDigestEvents(jin10Events, defaultConfig);
        const jin10Selected = selected.filter((i) => i.sources[0]?.name.includes('Jin10'));
        expect(jin10Selected.length).toBeLessThanOrEqual(2);
    });

    // 8. invalid URL markup rejected (no <|Title>)
    it('8. invalid URL does not produce empty link markup <|Title>', () => {
        expect(isValidHttpUrl('')).toBe(false);
        expect(isValidHttpUrl('not-a-url')).toBe(false);
        expect(isValidHttpUrl('ftp://example.com')).toBe(false);
        expect(isValidHttpUrl('https://valid.com/news/1')).toBe(true);

        const eventWithNoUrl = makeEvent('no_url', 'SEC confirms review of crypto staking ETF', 'SEC Official', SourceTier.OFFICIAL, 95, ['ETH'], 90);
        eventWithNoUrl.url = '';

        const aggregated = selectionService.aggregateEvents([eventWithNoUrl]);
        const formatted = formatterService.formatDigest({
            id: 'no_url_test',
            title: 'Test',
            periodHours: 6,
            generatedAt: new Date(),
            items: aggregated,
        });

        expect(formatted).not.toContain('<|');
    });

    // 9. Top 10 replenishment loads more candidates
    it('9. replenishment loop evaluates subsequent batches when initial items are rejected', async () => {
        // Create 20 events: first 10 have impact < 45 (rejected), next 10 have impact >= 70 (qualified)
        const events: MarketEvent[] = [];
        for (let i = 1; i <= 10; i++) {
            events.push(makeEvent(`low_${i}`, `Minor local test noise event number ${i}`, `Source_${i}`, SourceTier.NEWS, 75, [`T${i}`], 20));
        }
        for (let i = 11; i <= 20; i++) {
            events.push(makeEvent(`high_${i}`, `Major protocol milestone release event ${i}`, `Source_${i}`, SourceTier.OFFICIAL, 90, [`T${i}`], 85));
        }

        const selected = await selectionService.selectDigestEvents(events, defaultConfig);
        // The first 10 were rejected, replenishment must pick up the qualified items
        expect(selected.length).toBe(10);
        expect(selected.every((item) => item.impactScore >= 45)).toBe(true);
    });

    // 10. AI rejects candidate -> replacement candidate selected
    it('10. AI rejects candidate -> pipeline replaces with next qualified candidate', async () => {
        const e1 = makeEvent('ev_1', 'Fed cuts interest rate by 50 basis points', 'Reuters', SourceTier.NEWS, 95, ['BTC'], 90);
        const e2 = makeEvent('ev_2', 'Coinbase launches instant crypto deposits', 'Coinbase', SourceTier.OFFICIAL, 95, ['ETH'], 85);
        const e3 = makeEvent('ev_3', 'Spam token promotional campaign online', 'Social Spam', SourceTier.NEWS, 75, ['PEPE'], 70);
        const e4 = makeEvent('ev_4', 'Kraken obtains regulatory license in Europe', 'Kraken', SourceTier.OFFICIAL, 95, ['SOL'], 80);

        const mockAiAnalyzer: AiNewsAnalyzer = {
            providerName: 'mock',
            async analyzeEvents(evs: MarketEvent[]): Promise<Map<string, AiNewsAnalysis>> {
                const map = new Map<string, AiNewsAnalysis>();
                for (const ev of evs) {
                    if (ev.id === 'ev_3') {
                        // AI explicitly rejects ev_3 as spam/unrelated
                        map.set(ev.id, {
                            eventId: ev.id,
                            includeInDigest: false,
                            rejectionReason: 'Tin rác quảng cáo không có giá trị thông tin',
                            isValuable: false,
                            isNewInformation: false,
                            category: 'OTHER',
                            informationValueScore: 10,
                            marketRelevanceScore: 20,
                            aiConfidence: 0.95,
                            isHotNews: false,
                            titleVi: 'Tin rác bị loại',
                            summaryVi: 'Không có thông tin giá trị.',
                            whyItMattersVi: '',
                            affectedAssets: [],
                            affectedNarratives: [],
                            keyFacts: [],
                            risks: [],
                        });
                    } else {
                        map.set(ev.id, {
                            eventId: ev.id,
                            includeInDigest: true,
                            isValuable: true,
                            isNewInformation: true,
                            category: 'CRYPTO_MARKET',
                            informationValueScore: 85,
                            marketRelevanceScore: 90,
                            aiConfidence: 0.9,
                            isHotNews: false,
                            titleVi: `Tiêu đề tiếng Việt cho ${ev.id}`,
                            summaryVi: `Tóm tắt tiếng Việt cụ thể cho ${ev.id}`,
                            whyItMattersVi: `Tác động thực tế cho ${ev.id}`,
                            affectedAssets: ev.tokens,
                            affectedNarratives: ['Crypto'],
                            keyFacts: ['Fact 1'],
                            risks: [],
                        });
                    }
                }
                return map;
            },
        };

        const selected = await selectionService.selectDigestEvents([e1, e2, e3, e4], { ...defaultConfig, maxItems: 3 }, new Set(), mockAiAnalyzer);

        expect(selected.length).toBe(3);
        expect(selected.some((s) => s.primaryEvent.id === 'ev_3')).toBe(false);
        expect(selected.some((s) => s.primaryEvent.id === 'ev_4')).toBe(true);
    });

    // 11. digest always Vietnamese
    it('11. user-facing digest output translates all enums and metadata to Vietnamese', () => {
        expect(formatterService.formatVerificationLabel(VerificationStatus.CONFIRMED_PRIMARY_SOURCE)).toBe('Nguồn chính thức');
        expect(formatterService.formatVerificationLabel(VerificationStatus.CONFIRMED_MULTI_SOURCE)).toBe('Đa nguồn');
        expect(formatterService.formatVerificationLabel(VerificationStatus.UNVERIFIED)).toBe('Chưa xác minh');
        expect(formatterService.formatTopicLabel('LISTING')).toBe('Niêm yết sàn');
        expect(formatterService.formatTopicLabel('REGULATION')).toBe('Pháp lý');
        expect(formatterService.formatImpactLabel(95)).toBe('Rất lớn');
        expect(formatterService.formatImpactLabel(65)).toBe('Đáng chú ý');
        expect(formatterService.formatImpactLabel(50)).toBe('Trung bình');
    });

    // 12. duplicate scheduler execution sends once (idempotency lock)
    it('12. duplicate scheduler execution in same slot is blocked by idempotency lock', async () => {
        const repo = new InMemoryFeedRepository();
        await repo.saveItem({
            id: 'item_slot_test',
            title: 'Federal Reserve officially announces rate decision',
            sourceName: 'Federal Reserve',
            sourceTier: SourceTier.OFFICIAL,
            credibilityScore: 100,
            tokens: ['BTC'],
            symbols: ['$BTC'],
            chains: [],
            topics: ['MACRO'],
            category: 'MACRO' as FeedCategory,
            url: 'https://federalreserve.gov/news/1',
            fingerprint: 'fp_slot_test',
            publishedAt: new Date(),
            collectedAt: new Date(),
            impactScore: 95,
            breaking: true,
        });

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ name: 'msg1' }),
        });
        const notifConfig = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/test',
        });
        const notifService = new GoogleChatNotificationService(notifConfig, { fetchFn: mockFetch });

        const digestService = new CryptoDigestService(repo, {
            configService: new CryptoDigestConfigService({
                CRYPTO_DIGEST_ENABLED: 'true',
            }),
            notificationService: notifService,
        });

        // First execution: should succeed and send message
        const firstRun = await digestService.generateAndSendDigest();
        expect(firstRun.success).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second execution: should be intercepted by idempotency slot lock!
        const secondRun = await digestService.generateAndSendDigest();
        expect(secondRun.success).toBe(true);
        expect(secondRun.message).toContain('already delivered');
        // Still called only 1 time!
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // 13. fewer than 10 only when candidate pool exhausted
    it('13. returns fewer than 10 only when candidate pool exhausted, without padding garbage', async () => {
        const events = [
            makeEvent('ev_a', 'Bitcoin institutional inflow sets new monthly record', 'CoinDesk', SourceTier.NEWS, 85, ['BTC'], 80),
            makeEvent('ev_b', 'Ethereum layer 2 TVL crosses 40 billion dollars', 'The Block', SourceTier.NEWS, 85, ['ETH'], 75),
            makeEvent('ev_c', 'Solana validator network completes performance upgrade', 'Solana Foundation', SourceTier.OFFICIAL, 95, ['SOL'], 85),
        ];

        const selected = await selectionService.selectDigestEvents(events, defaultConfig);
        // Only 3 high-quality events exist, so exactly 3 are returned! Never padded to 10 with filler.
        expect(selected.length).toBe(3);
    });

    // 14. generic AI filler rejected
    it('14. detectGenericFiller detects forbidden filler phrases', () => {
        expect(detectGenericFiller('Sự kiện đang thu hút sự quan tâm của cộng đồng.')).toBe(true);
        expect(detectGenericFiller('Có thể tác động ngắn hạn tới thị trường crypto.')).toBe(true);
        expect(detectGenericFiller('Đây là động lực then chốt cho thị trường.')).toBe(true);
        expect(detectGenericFiller('Có thể tạo biến động giao dịch mạnh mẽ.')).toBe(true);
        expect(detectGenericFiller('Rất đáng để nhà đầu tư theo dõi.')).toBe(true);
        expect(detectGenericFiller('Grayscale công bố chia tách cổ phần ETF Zcash theo tỷ lệ 3:1 sau phiên giao dịch ngày 28/9.')).toBe(false);
    });

    // 15. official source preferred over aggregator
    it('15. official source is preferred over aggregator for canonical URL and primary event', () => {
        const eOfficial = makeEvent('sec_notice', 'SEC publishes rule change order on exchange listings', 'SEC Official', SourceTier.OFFICIAL, 100, ['BTC'], 90, {
            url: 'https://sec.gov/rules/crypto_notice.pdf',
        });
        const eAggregator = makeEvent('jin10_flash', 'SEC updates exchange listing rules', 'Jin10 Flash', SourceTier.NEWS, 75, ['BTC'], 90, {
            url: 'https://jin10.com/flash/12345',
        });

        expect(getSourceAuthoritativenessRank('SEC Official', SourceTier.OFFICIAL)).toBeGreaterThan(
            getSourceAuthoritativenessRank('Jin10 Flash', SourceTier.NEWS)
        );

        const aggregated = selectionService.aggregateEvents([eAggregator, eOfficial]);
        expect(aggregated.length).toBe(1);
        expect(aggregated[0].primaryEvent.source.name).toBe('SEC Official');
        expect(aggregated[0].canonicalUrl).toBe('https://sec.gov/rules/crypto_notice.pdf');
    });

    // 16. route /api/collector/latest works without 404
    it('16. route /api/collector/latest is mounted properly and does not return 404', async () => {
        const res = await app.request('/api/collector/latest');
        expect(res.status).not.toBe(404);
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json).toHaveProperty('items');
        expect(json).toHaveProperty('notification');
    });
});
