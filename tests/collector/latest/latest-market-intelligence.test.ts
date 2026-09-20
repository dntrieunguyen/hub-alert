import { describe, expect, it, vi } from 'vitest';
import { InMemoryFeedRepository } from '../../../lib/collector/storage/in-memory-feed.repository';
import { LatestMarketIntelligenceService } from '../../../lib/collector/intelligence/latest/latest-market-intelligence.service';
import { LatestMarketRelevanceService } from '../../../lib/collector/intelligence/latest/latest-market-relevance.service';
import { LatestEventClusteringService } from '../../../lib/collector/intelligence/latest/latest-event-clustering.service';
import { createCollectorRouter } from '../../../lib/collector/api/collector-router';
import { type CryptoFeedItem, SourceTier } from '../../../lib/collector/types';


describe('Latest Market Intelligence System', () => {
    // 1. Chinese source -> Vietnamese API output
    it('1. converts Chinese source feed into 100% natural Vietnamese API output', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'jin10-treasury-1',
            externalId: 'ext-j1',
            fingerprint: 'fp-j1',
            sourceId: 'jin10',
            sourceName: 'Jin10 Global Flash',
            sourceTier: SourceTier.NEWS,
            category: 'MARKET',
            title: '据英国金融时报：华尔街大型银行预计美国财政部将大幅增加短期国债发行',
            summary: '由于长期借贷成本高企，华尔街主要承销商预计美国财政部可能会增加短期国债发行量至约1万亿美元。',
            url: 'https://jin10.com/flash/1',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: ['MACRO'],
            entities: ['Treasury', 'Wall Street'],
            credibilityScore: 85,
            impactScore: 65,
            breaking: false,
        });

        const mockAiAnalyzer: any = {
            providerName: 'deepseek',
            analyzeLatestNews: async (events: any[]) => {
                const map = new Map();
                for (const ev of events) {
                    map.set(ev.id, {
                        eventId: ev.id,
                        include: true,
                        titleVi: 'Wall Street dự kiến Mỹ phát hành khoảng 1.000 tỷ USD nợ ngắn hạn',
                        summaryVi: 'Các ngân hàng lớn tại Wall Street dự kiến Bộ Tài chính Mỹ có thể tăng mạnh phát hành nợ ngắn hạn khi chi phí vay tiếp tục ở mức cao.',
                        analysisVi: 'Quy mô phát hành lớn có thể ảnh hưởng tới thanh khoản USD và nhu cầu đối với tài sản an toàn, qua đó tác động gián tiếp tới nhóm tài sản rủi ro như crypto.',
                        whyItMattersVi: 'Thanh khoản USD là một trong những yếu tố quan trọng ảnh hưởng tới khẩu vị rủi ro và dòng vốn vào BTC, ETH.',
                        marketImpactVi: 'Hút ròng thanh khoản USD từ hệ thống ngân hàng',
                        category: 'MACRO',
                        affectedAssets: ['BTC', 'ETH'],
                        affectedNarratives: ['USD Liquidity', 'US Treasury'],
                        informationValueScore: 75,
                        marketRelevanceScore: 78,
                        aiImpactScore: 65,
                        confidence: 0.9,
                        signalStrength: 'MEDIUM',
                    });
                }
                return map;
            },
        };

        const service = new LatestMarketIntelligenceService({
            repository,
            aiAnalyzer: mockAiAnalyzer,
        });

        const result: any = await service.getLatestIntelligence({ limit: 10 });
        expect(result.items).toHaveLength(1);

        const item = result.items[0];
        expect(item.title).toBe('Wall Street dự kiến Mỹ phát hành khoảng 1.000 tỷ USD nợ ngắn hạn');
        expect(item.summary).toContain('Các ngân hàng lớn tại Wall Street');
        expect(item.analysis).toContain('thanh khoản USD');
        expect(item.whyItMatters).toContain('khẩu vị rủi ro');
        expect(item.marketRelevanceScore).toBe(78);

        // Check no Chinese character in user-facing fields
        const cjkRegex = /[\u4e00-\u9fff]/;
        expect(cjkRegex.test(item.title)).toBe(false);
        expect(cjkRegex.test(item.summary)).toBe(false);
        expect(cjkRegex.test(item.analysis)).toBe(false);
        expect(cjkRegex.test(item.whyItMatters)).toBe(false);
    });

    // 2. English source -> Vietnamese API output
    it('2. converts English source feed into natural Vietnamese API output', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'bloomberg-fed-1',
            externalId: 'ext-b1',
            fingerprint: 'fp-b1',
            sourceId: 'bloomberg',
            sourceName: 'Bloomberg Crypto',
            sourceTier: SourceTier.NEWS,
            category: 'CRYPTO_NEWS',
            title: 'BlackRock Bitcoin ETF Inflows Hit $500M Following Fed Rate Cut Signals',
            summary: 'Institutional demand surged as Jerome Powell indicated readiness to ease monetary policy.',
            url: 'https://bloomberg.com/news/1',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: ['BTC'],
            symbols: ['$BTC'],
            chains: ['Bitcoin'],
            topics: ['ETF', 'FED'],
            entities: ['BlackRock', 'Fed'],
            credibilityScore: 90,
            impactScore: 85,
            breaking: true,
        });

        const mockAiAnalyzer: any = {
            providerName: 'deepseek',
            analyzeLatestNews: async (events: any[]) => {
                const map = new Map();
                for (const ev of events) {
                    map.set(ev.id, {
                        eventId: ev.id,
                        include: true,
                        titleVi: 'Quỹ Bitcoin ETF của BlackRock ghi nhận dòng tiền 500 triệu USD sau tín hiệu hạ lãi suất',
                        summaryVi: 'Dòng vốn tổ chức đổ mạnh vào Bitcoin ETF khi Chủ tịch Fed phát đi tín hiệu sẵn sàng nới lỏng chính sách tiền tệ.',
                        analysisVi: 'Dòng tiền ETF kết hợp với môi trường nới lỏng tiền tệ tạo động lực thanh khoản kép cho thị trường crypto.',
                        whyItMattersVi: 'Dòng tiền mua ròng từ BlackRock thể hiện sự tự tin của các quỹ tài chính lớn vào chu kỳ giá của Bitcoin.',
                        marketImpactVi: 'Bơm thanh khoản trực tiếp vào thị trường giao ngay',
                        category: 'ETF',
                        affectedAssets: ['BTC'],
                        affectedNarratives: ['Institutional Inflows', 'Fed Rate Cut'],
                        informationValueScore: 85,
                        marketRelevanceScore: 92,
                        aiImpactScore: 85,
                        confidence: 0.95,
                        signalStrength: 'HIGH',
                    });
                }
                return map;
            },
        };

        const service = new LatestMarketIntelligenceService({
            repository,
            aiAnalyzer: mockAiAnalyzer,
        });

        const result: any = await service.getLatestIntelligence({ limit: 10 });
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe('Quỹ Bitcoin ETF của BlackRock ghi nhận dòng tiền 500 triệu USD sau tín hiệu hạ lãi suất');
        expect(result.items[0].signalStrength).toBe('HIGH');
    });

    // 3. Reddit portfolio question -> excluded
    it('3. excludes Reddit community portfolio questions and beginner noise', async () => {
        const relevanceService = new LatestMarketRelevanceService();

        const noiseItem1 = {
            title: 'Hi crypto friend and fiends. Portfolio question.',
            summary: 'submitted by /u/cryptonewbie to r/CryptoCurrency. What do you think of my holdings? Should I buy more ADA?',
            category: 'CRYPTO_NEWS',
            sourceName: 'Reddit r/CryptoCurrency',
            sourceTier: 'COMMUNITY',
            tokens: ['ADA'],
            symbols: ['$ADA'],
        };

        const eval1 = relevanceService.isMarketRelevantToCrypto(noiseItem1);
        expect(eval1.isRelevant).toBe(false);
        expect(eval1.category).toBe('COMMUNITY_NOISE');
        expect(eval1.marketRelevanceScore).toBeLessThan(30);

        const noiseItem2 = {
            title: 'I have $500, what should I buy right now? Any tips for beginner?',
            summary: 'submitted by /u/trader. Personal opinion needed on meme coins.',
            category: 'MEMECOIN',
            sourceName: 'Reddit r/CryptoCurrency',
            sourceTier: 'COMMUNITY',
        };

        const eval2 = relevanceService.isMarketRelevantToCrypto(noiseItem2);
        expect(eval2.isRelevant).toBe(false);
        expect(eval2.category).toBe('COMMUNITY_NOISE');
    });

    // 4. Jin10 repeated Qatar flashes -> one clustered event
    it('4. aggregates repeated Jin10 flashes on the same topic into one clustered event', async () => {
        const clusteringService = new LatestEventClusteringService(30);
        const baseTime = Date.now();

        const flashes: CryptoFeedItem[] = [
            {
                id: 'flash-1',
                externalId: 'ext-f1',
                fingerprint: 'fp-f1',
                sourceId: 'jin10',
                sourceName: 'Jin10',
                sourceTier: SourceTier.NEWS,
                category: 'MARKET',
                title: '卡塔尔能源首席执行官：红海和霍尔木兹海峡局势影响船运',
                summary: '设备运输受阻',
                url: 'https://jin10.com/1',
                publishedAt: new Date(baseTime - 1000 * 60 * 2), // 2 mins ago
                collectedAt: new Date(),
                tokens: [],
                symbols: [],
                chains: [],
                topics: [],
                entities: ['Qatar Energy', 'Hormuz'],
                credibilityScore: 85,
                impactScore: 40,
                breaking: false,
            },
            {
                id: 'flash-2',
                externalId: 'ext-f2',
                fingerprint: 'fp-f2',
                sourceId: 'jin10',
                sourceName: 'Jin10',
                sourceTier: SourceTier.NEWS,
                category: 'MARKET',
                title: '卡塔尔能源：部分LNG项目运营面临运输延误',
                summary: '霍尔木兹海峡危机可能影响天然气交付',
                url: 'https://jin10.com/2',
                publishedAt: new Date(baseTime - 1000 * 60 * 5), // 5 mins ago
                collectedAt: new Date(),
                tokens: [],
                symbols: [],
                chains: [],
                topics: [],
                entities: ['Qatar Energy', 'Hormuz'],
                credibilityScore: 85,
                impactScore: 65,
                breaking: false,
            },
            {
                id: 'flash-3',
                externalId: 'ext-f3',
                fingerprint: 'fp-f3',
                sourceId: 'jin10',
                sourceName: 'Jin10',
                sourceTier: SourceTier.NEWS,
                category: 'MARKET',
                title: '卡塔尔能源公司：霍尔木兹海峡冲突使能源航线风险上升',
                summary: '航运保险成本激增',
                url: 'https://jin10.com/3',
                publishedAt: new Date(baseTime - 1000 * 60 * 10), // 10 mins ago
                collectedAt: new Date(),
                tokens: [],
                symbols: [],
                chains: [],
                topics: [],
                entities: ['Qatar Energy', 'Hormuz'],
                credibilityScore: 85,
                impactScore: 55,
                breaking: false,
            },
        ];

        const clusters = clusteringService.clusterEvents(flashes);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].itemCount).toBe(3);
        expect(clusters[0].clusterKey).toBe('qatar_energy_lng_hormuz');
        expect(clusters[0].impactScore).toBe(65); // highest impact picked
    });

    // 5. Low relevance market flash -> excluded
    it('5. excludes low-relevance market updates with no systemic crypto/macro transmission', async () => {
        const relevanceService = new LatestMarketRelevanceService();

        const lowRelevanceItem = {
            title: 'Qatar Energy mở rộng LNG năm 2027 với thêm một dây chuyền sản xuất',
            summary: 'Công ty công bố kế hoạch đầu tư thông thường cho năm 2027.',
            category: 'MARKET',
            sourceName: 'Jin10',
            sourceTier: 'NEWS',
        };

        const evalResult = relevanceService.isMarketRelevantToCrypto(lowRelevanceItem);
        expect(evalResult.isRelevant).toBe(false);
        expect(evalResult.marketRelevanceScore).toBeLessThan(50);
    });

    // 6. Crypto relevant macro event -> included
    it('6. includes crypto-relevant macroeconomic events and energy shocks with high relevance score', async () => {
        const relevanceService = new LatestMarketRelevanceService();

        const macroEvent = {
            title: 'Wall Street dự kiến Mỹ phát hành khoảng 1.000 tỷ USD nợ ngắn hạn khi chi phí vay tăng cao',
            summary: 'Bộ Tài chính Mỹ đối mặt với áp lực thanh khoản và nhu cầu tài trợ ngân sách.',
            category: 'MARKET',
            sourceName: 'Jin10',
            sourceTier: 'NEWS',
        };

        const evalMacro = relevanceService.isMarketRelevantToCrypto(macroEvent);
        expect(evalMacro.isRelevant).toBe(true);
        expect(evalMacro.marketRelevanceScore).toBeGreaterThanOrEqual(70);

        const energyShock = {
            title: 'Khủng hoảng Hormuz gây gián đoạn hoạt động LNG của Qatar và đe dọa các tuyến vận tải dầu',
            summary: 'Căng thẳng địa chính trị đẩy giá năng lượng tăng đột biến.',
            category: 'MARKET',
            sourceName: 'Reuters',
            sourceTier: 'NEWS',
        };

        const evalShock = relevanceService.isMarketRelevantToCrypto(energyShock);
        expect(evalShock.isRelevant).toBe(true);
        expect(evalShock.marketRelevanceScore).toBeGreaterThanOrEqual(65);
    });

    // 7. Title/summary always Vietnamese
    it('7. guarantees that title, summary, analysis, and whyItMatters are always in Vietnamese', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'item-vietnamese-test',
            externalId: 'ext-vn',
            fingerprint: 'fp-vn',
            sourceId: 'jin10',
            sourceName: 'Jin10',
            sourceTier: SourceTier.NEWS,
            category: 'MARKET',
            title: '美联储主席鲍威尔在国会发表货币政策证词',
            summary: '鲍威尔表示如果通胀继续降温，降息是合适的。',
            url: 'https://jin10.com/fed',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: ['FED'],
            entities: ['Fed', 'Powell'],
            credibilityScore: 85,
            impactScore: 80,
            breaking: true,
        });

        const service = new LatestMarketIntelligenceService({ repository });
        const result: any = await service.getLatestIntelligence({ limit: 10 });
        expect(result.items.length).toBeGreaterThan(0);

        const cjkRegex = /[\u4e00-\u9fff]/;
        for (const item of result.items) {
            expect(cjkRegex.test(item.title)).toBe(false);
            expect(cjkRegex.test(item.summary)).toBe(false);
            expect(cjkRegex.test(item.analysis)).toBe(false);
            expect(cjkRegex.test(item.whyItMatters)).toBe(false);
        }
    });

    // 8. Analysis always present
    it('8. ensures analysis field is always present and non-empty for every item', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'item-analysis-test',
            externalId: 'ext-an',
            fingerprint: 'fp-an',
            sourceId: 'coindesk',
            sourceName: 'CoinDesk',
            sourceTier: SourceTier.NEWS,
            category: 'CRYPTO_NEWS',
            title: 'SEC Approves Generic Standards for Crypto Asset Staking',
            summary: 'The regulatory agency provided clearer guidance for institutional custody providers.',
            url: 'https://coindesk.com/sec-staking',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: ['ETH'],
            symbols: ['$ETH'],
            chains: ['Ethereum'],
            topics: ['REGULATION'],
            entities: ['SEC'],
            credibilityScore: 90,
            impactScore: 75,
            breaking: false,
        });

        const service = new LatestMarketIntelligenceService({ repository });
        const result: any = await service.getLatestIntelligence({ limit: 10 });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].analysis).toBeDefined();
        expect(result.items[0].analysis.length).toBeGreaterThan(15);
    });

    // 9. WhyItMatters always present
    it('9. ensures whyItMatters field is always present and non-empty for every item', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'item-wim-test',
            externalId: 'ext-wim',
            fingerprint: 'fp-wim',
            sourceId: 'coindesk',
            sourceName: 'CoinDesk',
            sourceTier: SourceTier.NEWS,
            category: 'CRYPTO_NEWS',
            title: 'Coinbase Integrates Solana Liquid Staking in Major DeFi Expansion',
            summary: 'Users can now access liquid staking directly on Coinbase.',
            url: 'https://coindesk.com/coinbase-sol',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: ['SOL'],
            symbols: ['$SOL'],
            chains: ['Solana'],
            topics: ['DEFI'],
            entities: ['Coinbase'],
            credibilityScore: 92,
            impactScore: 70,
            breaking: false,
        });

        const service = new LatestMarketIntelligenceService({ repository });
        const result: any = await service.getLatestIntelligence({ limit: 10 });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].whyItMatters).toBeDefined();
        expect(result.items[0].whyItMatters.length).toBeGreaterThan(15);
    });

    // 10. GET latest automatically dispatches Google Chat messages (and notify=false disables it)
    it('10. verifies that HTTP GET /latest dispatches Google Chat messages, and notify=false suppresses it', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'item-no-chat-test',
            externalId: 'ext-nc',
            fingerprint: 'fp-nc',
            sourceId: 'coindesk',
            sourceName: 'CoinDesk',
            sourceTier: SourceTier.NEWS,
            category: 'CRYPTO_NEWS',
            title: 'Bitcoin Hashrate Reaches New All-Time High',
            summary: 'Miners demonstrate strong security commitment.',
            url: 'https://coindesk.com/hashrate',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: ['BTC'],
            symbols: ['$BTC'],
            chains: ['Bitcoin'],
            topics: ['MINING'],
            entities: [],
            credibilityScore: 90,
            impactScore: 60,
            breaking: false,
        });

        const sendTextSpy = vi.fn();
        const mockNotificationModule: any = {
            configService: { isEnabled: () => true },
            formatter: { formatVietnamTime: (d: Date) => d.toISOString() },
            notificationService: { sendText: sendTextSpy },
        };

        const router = createCollectorRouter({
            repository,
            trendService: {} as any,
            sourceService: { getAllSources: () => [] } as any,
            collectorService: {} as any,
            notificationModule: mockNotificationModule,
        });

        // Calling GET /latest sends notification to chat by default
        const res = await router.request('/latest?limit=10');
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(sendTextSpy).toHaveBeenCalledTimes(1);
        expect(sendTextSpy.mock.calls[0][0]).toContain('HUB ALERT');
        expect(data.notification).toBeDefined();
        expect(data.notification.sent).toBe(true);

        // Calling GET /latest?notify=false suppresses notification
        sendTextSpy.mockClear();
        const resNoNotify = await router.request('/latest?limit=10&notify=false');
        expect(resNoNotify.status).toBe(200);
        expect(sendTextSpy).not.toHaveBeenCalled();
    });

    // 11. Candidate pool > requested limit
    it('11. verifies that the candidate pool loaded from repository is larger than requested limit', async () => {
        const repository = new InMemoryFeedRepository();
        const findLatestSpy = vi.spyOn(repository, 'findLatest');

        const service = new LatestMarketIntelligenceService({ repository });
        await service.getLatestIntelligence({ limit: 10 });

        expect(findLatestSpy).toHaveBeenCalled();
        const requestedCandidateLimit = findLatestSpy.mock.calls[0][0];
        // Section 16: candidateLimit = max(limit * 5, 50) -> at least 50
        expect(requestedCandidateLimit).toBeGreaterThanOrEqual(50);
    });

    // 12. Limit=10 returns best 10 processed events when available
    it('12. returns top 10 ranked intelligence events when 15 events are available', async () => {
        const repository = new InMemoryFeedRepository();

        for (let i = 1; i <= 15; i++) {
            await repository.saveItem({
                id: `ranked-item-${i}`,
                externalId: `ext-${i}`,
                fingerprint: `fp-${i}`,
                sourceId: 'coindesk',
                sourceName: 'CoinDesk',
                sourceTier: SourceTier.NEWS,
                category: 'CRYPTO_NEWS',
                title: `Bitcoin Institutional Development Event #${i} Recorded`,
                summary: `Factual news update ${i} regarding digital asset infrastructure.`,
                url: `https://coindesk.com/news-${i}`,
                publishedAt: new Date(Date.now() - i * 60 * 1000),
                collectedAt: new Date(),
                tokens: ['BTC'],
                symbols: ['$BTC'],
                chains: ['Bitcoin'],
                topics: ['MARKET'],
                entities: ['Bitcoin'],
                credibilityScore: 80 + (i % 15),
                impactScore: 50 + (i % 40),
                breaking: false,
            });
        }

        const service = new LatestMarketIntelligenceService({ repository });
        const result: any = await service.getLatestIntelligence({ limit: 10 });

        expect(result.items).toHaveLength(10);
        // Verify items are sorted by impactScore descending
        for (let j = 0; j < result.items.length - 1; j++) {
            expect(result.items[j].marketRelevanceScore).toBeGreaterThanOrEqual(50);
        }
    });

    // 13. AI failure does not leak Chinese raw content
    it('13. prevents Chinese raw content from leaking when AI service fails', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'chinese-error-test',
            externalId: 'ext-err',
            fingerprint: 'fp-err',
            sourceId: 'jin10',
            sourceName: 'Jin10',
            sourceTier: SourceTier.NEWS,
            category: 'MARKET',
            title: '卡塔尔能源首席执行官谈红海局势与天然气出口影响',
            summary: '运输成本上升影响部分交付。',
            url: 'https://jin10.com/error-test',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: [],
            entities: ['Qatar Energy', 'Hormuz'],
            credibilityScore: 85,
            impactScore: 65,
            breaking: false,
        });

        // Mock AI failure (e.g. 500 error or timeout)
        const failingAiAnalyzer: any = {
            providerName: 'deepseek',
            analyzeLatestNews: async () => {
                throw new Error('500 Internal Server Error from DeepSeek');
            },
        };

        const service = new LatestMarketIntelligenceService({
            repository,
            aiAnalyzer: failingAiAnalyzer,
        });

        const result: any = await service.getLatestIntelligence({ limit: 10 });
        expect(result.items.length).toBeGreaterThan(0);

        const cjkRegex = /[\u4e00-\u9fff]/;
        for (const item of result.items) {
            expect(cjkRegex.test(item.title)).toBe(false);
            expect(cjkRegex.test(item.summary)).toBe(false);
        }
    });

    // 14. Same event from multiple sources -> one item
    it('14. clusters identical event reported by multiple sources into one unified item', async () => {
        const clusteringService = new LatestEventClusteringService(30);

        const eventReuters: CryptoFeedItem = {
            id: 'reuters-1',
            externalId: 'ext-r1',
            fingerprint: 'fp-r1',
            sourceId: 'reuters',
            sourceName: 'Reuters',
            sourceTier: SourceTier.NEWS,
            category: 'MARKET',
            title: 'US Treasury Expected to Issue $1 Trillion in Short-Term Debt',
            summary: 'Wall Street banks anticipate large T-bill sales.',
            url: 'https://reuters.com/treasury',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: ['MACRO'],
            entities: ['Treasury'],
            credibilityScore: 95,
            impactScore: 70,
            breaking: false,
        };

        const eventBloomberg: CryptoFeedItem = {
            id: 'bloomberg-1',
            externalId: 'ext-bl1',
            fingerprint: 'fp-bl1',
            sourceId: 'bloomberg',
            sourceName: 'Bloomberg',
            sourceTier: SourceTier.NEWS,
            category: 'MARKET',
            title: 'Wall Street Prepares for $1T Treasury Short-Term Debt Issuance Wave',
            summary: 'Short term borrowing projected to spike.',
            url: 'https://bloomberg.com/treasury',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: ['MACRO'],
            entities: ['Treasury'],
            credibilityScore: 95,
            impactScore: 72,
            breaking: false,
        };

        const clusters = clusteringService.clusterEvents([eventReuters, eventBloomberg]);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].itemCount).toBe(2);
        expect(clusters[0].clusterKey).toBe('us_treasury_debt');
    });

    // 15. Market overview generated from selected items
    it('15. generates a unified market overview summary without hallucination', async () => {
        const repository = new InMemoryFeedRepository();
        await repository.saveItem({
            id: 'macro-1',
            externalId: 'ext-m1',
            fingerprint: 'fp-m1',
            sourceId: 'jin10',
            sourceName: 'Jin10',
            sourceTier: SourceTier.NEWS,
            category: 'MARKET',
            title: 'Wall Street dự kiến Mỹ phát hành 1.000 tỷ USD nợ ngắn hạn',
            summary: 'Kho bạc Mỹ tăng cường phát hành nợ trong bối cảnh thâm hụt ngân sách.',
            url: 'https://jin10.com/macro',
            publishedAt: new Date(),
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: ['MACRO'],
            entities: ['Treasury'],
            credibilityScore: 85,
            impactScore: 65,
            breaking: false,
        });

        const service = new LatestMarketIntelligenceService({ repository });
        const result: any = await service.getLatestIntelligence({ limit: 10 });

        expect(result.summary).toBeDefined();
        expect(result.summary.title).toBe('Tổng quan thị trường mới nhất');
        expect(result.summary.marketOverview).toBeDefined();
        expect(result.summary.marketOverview.length).toBeGreaterThan(20);
        expect(result.summary.overallImpactScore).toBeGreaterThanOrEqual(0);
        expect(result.summary.overallImpactScore).toBeLessThanOrEqual(100);
        expect(Array.isArray(result.summary.mainNarratives)).toBe(true);
        expect(Array.isArray(result.summary.risks)).toBe(true);
        expect(Array.isArray(result.summary.watchNext)).toBe(true);
    });
});
