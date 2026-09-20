import { describe, expect, it, vi } from 'vitest';
import { SourceTier, VerificationStatus } from '../../../lib/collector/types';
import { EventPriority, MarketEventType, type MarketEvent } from '../../../lib/collector/notifications/types';
import type { AggregatedMarketEvent, DigestPayload } from '../../../lib/collector/digest/types';
import { CryptoDigestSummaryService } from '../../../lib/collector/digest/crypto-digest-summary.service';
import { CryptoDigestFormatterService } from '../../../lib/collector/digest/crypto-digest-formatter.service';
import { DeepSeekMarketIntelligenceValidator } from '../../../lib/collector/intelligence/deepseek/deepseek-market-intelligence-validator';
import {
    buildMarketIntelligenceUserPrompt,
    DEEPSEEK_MARKET_INTELLIGENCE_SYSTEM_PROMPT,
} from '../../../lib/collector/intelligence/deepseek/deepseek-market-intelligence-prompt';
import { DeepSeekNewsAnalyzer } from '../../../lib/collector/intelligence/deepseek/deepseek-news-analyzer.service';
import { validateVietnameseOutput } from '../../../lib/collector/digest/crypto-digest-vietnamese-validator';

describe('AI Crypto Market Intelligence Brief (25 Specifications)', () => {
    const summaryService = new CryptoDigestSummaryService();
    const formatterService = new CryptoDigestFormatterService();

    const createSampleEvent = (
        id: string,
        title: string,
        sourceName: string,
        tier: SourceTier,
        credibilityScore: number,
        tokens: string[],
        eventType: MarketEventType,
        impactScore = 70,
        options: Partial<MarketEvent> = {}
    ): AggregatedMarketEvent => {
        const primaryEvent: MarketEvent = {
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
            category: 'CRYPTO_NEWS',
            eventType,
            verificationStatus:
                tier === SourceTier.OFFICIAL
                    ? VerificationStatus.CONFIRMED_PRIMARY_SOURCE
                    : VerificationStatus.ATTRIBUTED_STATEMENT,
            priority: EventPriority.P1,
            tokens,
            symbols: tokens.map((t) => `$${t}`),
            chains: ['Ethereum'],
            publishedAt: new Date(),
            createdAt: new Date(),
            impactScore,
            confidence: 0.9,
            channels: [],
            ...options,
        };

        return {
            id: `agg_${id}`,
            canonicalFingerprint: `fp_${id}`,
            primaryEvent,
            title,
            vietnameseTitle: title,
            summary: primaryEvent.summary,
            vietnameseSummary: primaryEvent.summary,
            canonicalUrl: primaryEvent.url,
            category: primaryEvent.category,
            eventType: primaryEvent.eventType,
            verificationStatus: primaryEvent.verificationStatus,
            tokens,
            symbols: primaryEvent.symbols,
            chains: primaryEvent.chains,
            topics: [eventType],
            impactScore,
            publishedAt: primaryEvent.publishedAt,
            createdAt: primaryEvent.createdAt,
            sources: [
                {
                    id: primaryEvent.source.id,
                    name: sourceName,
                    tier,
                    credibilityScore,
                    url: primaryEvent.url,
                    publishedAt: primaryEvent.publishedAt,
                },
            ],
            sourceCount: 1,
            officialSourceCount: tier === SourceTier.OFFICIAL ? 1 : 0,
            newsSourceCount: 1,
            socialSourceCount: 0,
        };
    };

    it('1. DeepSeekMarketIntelligenceValidator correctly validates structured JSON', () => {
        const rawValid = {
            summaryVi: 'Bitcoin tiếp tục dẫn dắt thị trường nhờ dòng vốn ETF ổn định.',
            overallImpactScore: 68,
            analysisConfidence: 87,
            marketState: {
                overall: 'NGHIÊNG TÍCH CỰC ĐỐI VỚI BTC, TRUNG LẬP ĐỐI VỚI ALTCOIN',
                btc: 'Tích cực',
                eth: 'Trung lập',
                altcoin: 'Thận trọng',
                meme: 'Chưa có tín hiệu đủ mạnh',
            },
            narratives: [
                {
                    titleVi: 'BTC tiếp tục dẫn dắt',
                    summaryVi: 'Bitcoin duy trì relative strength cao hơn phần còn lại của thị trường.',
                    strength: 'HIGH',
                    supportingEventIds: ['agg_1'],
                },
            ],
            assetAnalysis: [
                {
                    asset: 'BTC',
                    outlook: 'TÍCH CỰC',
                    summaryVi: 'Dòng vốn tổ chức ưu tiên Bitcoin.',
                    signalsVi: ['ETF inflow ròng mạnh', 'Khả năng giữ giá ổn định'],
                },
            ],
            institutionalFlowVi: 'Bitcoin ETF ghi nhận $433M inflow vào thứ Sáu.',
            regulationVi: 'SEC đang mở rộng hướng tiếp cận tokenized stocks.',
            catalystsVi: ['Bitcoin ETF tiếp tục hút dòng tiền tổ chức.'],
            risksVi: ['Altcoin vẫn yếu tương đối.'],
            watchNextVi: ['Bitcoin ETF inflow có tiếp tục duy trì?'],
            usedEventIds: ['agg_1'],
            ignoredEventIds: [
                {
                    eventId: 'agg_noise',
                    reasonVi: 'Tin tức AI không liên quan đến crypto',
                },
            ],
        };

        const validated = DeepSeekMarketIntelligenceValidator.validateAnalysis(rawValid, ['agg_1', 'agg_noise']);
        expect(validated).not.toBeNull();
        expect(validated?.summaryVi).toBe(rawValid.summaryVi);
        expect(validated?.overallImpactScore).toBe(68);
        expect(validated?.analysisConfidence).toBe(87);
        expect(validated?.narratives.length).toBe(1);
        expect(validated?.assetAnalysis.length).toBe(1);
        expect(validated?.institutionalFlowVi).toBe(rawValid.institutionalFlowVi);
        expect(validated?.regulationVi).toBe(rawValid.regulationVi);
        expect(validated?.ignoredEventIds.length).toBe(1);
    });

    it('2. DeepSeekMarketIntelligenceValidator rejects invalid non-Vietnamese or empty JSON', () => {
        expect(DeepSeekMarketIntelligenceValidator.validateAnalysis(null, [])).toBeNull();
        expect(DeepSeekMarketIntelligenceValidator.validateAnalysis({}, [])).toBeNull();
        // Missing Vietnamese summary
        expect(
            DeepSeekMarketIntelligenceValidator.validateAnalysis(
                {
                    summaryVi: 'English only summary without vietnamese words',
                    narratives: [],
                },
                []
            )
        ).toBeNull();
    });

    it('3. Prompt builders create proper context and system instructions', () => {
        expect(DEEPSEEK_MARKET_INTELLIGENCE_SYSTEM_PROMPT).toContain('Chief Crypto Market Strategist');
        expect(DEEPSEEK_MARKET_INTELLIGENCE_SYSTEM_PROMPT).toContain('KHÔNG ĐƯA LỜI KHUYÊN ĐẦU TƯ');
        expect(DEEPSEEK_MARKET_INTELLIGENCE_SYSTEM_PROMPT).toContain('100% TIẾNG VIỆT');
        expect(DEEPSEEK_MARKET_INTELLIGENCE_SYSTEM_PROMPT).toContain('PHÂN BIỆT SIGNAL VS NOISE');

        const ev1 = createSampleEvent('1', 'Bitcoin ETF inflow $433M', 'The Block', SourceTier.NEWS, 85, ['BTC'], MarketEventType.ETF);
        const userPrompt = buildMarketIntelligenceUserPrompt([ev1]);
        expect(userPrompt).toContain('EVIDENCE INPUT');
        expect(userPrompt).toContain('Bitcoin ETF inflow $433M');
    });

    it('4. DeepSeekNewsAnalyzer.synthesizeMarketIntelligence handles API call and validation', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            summaryVi: 'Thị trường crypto duy trì trạng thái phân hóa với Bitcoin đóng vai trò trụ cột.',
                            overallImpactScore: 72,
                            analysisConfidence: 88,
                            marketState: {
                                overall: 'NGHIÊNG TÍCH CỰC',
                                btc: 'Tích cực',
                            },
                            narratives: [
                                {
                                    titleVi: 'Dòng vốn ETF hỗ trợ giá Bitcoin',
                                    summaryVi: 'Các tổ chức lớn tiếp tục giải ngân qua quỹ ETF.',
                                    strength: 'HIGH',
                                    supportingEventIds: ['agg_1'],
                                },
                            ],
                            assetAnalysis: [
                                {
                                    asset: 'BTC',
                                    outlook: 'TÍCH CỰC',
                                    summaryVi: 'Bitcoin có relative strength cao.',
                                    signalsVi: ['Inflow mạnh'],
                                },
                            ],
                            catalystsVi: ['ETF duy trì dòng tiền'],
                            risksVi: ['Thanh khoản altcoin suy giảm'],
                            watchNextVi: ['Theo dõi dòng tiền ETF tuần tới'],
                            usedEventIds: ['agg_1'],
                            ignoredEventIds: [],
                        }),
                    },
                },
            ],
        });

        const analyzer = new DeepSeekNewsAnalyzer({
            config: {
                enabled: true,
                apiKey: 'test-key',
            },
            fetchFn: mockFetch,
        });

        const ev1 = createSampleEvent('1', 'Bitcoin ETF inflow $433M', 'The Block', SourceTier.NEWS, 85, ['BTC'], MarketEventType.ETF);
        const result = await analyzer.synthesizeMarketIntelligence([ev1]);

        expect(result).not.toBeNull();
        expect(result?.summaryVi).toContain('Thị trường crypto duy trì trạng thái');
        expect(result?.overallImpactScore).toBe(72);
        expect(result?.analysisConfidence).toBe(88);
        expect(result?.narratives.length).toBe(1);
    });

    it('5. Deterministic fallback synthesizes comprehensive Market Intelligence Brief from 10 inputs and filters noise', () => {
        const events: AggregatedMarketEvent[] = [
            createSampleEvent('1', 'Glassnode / Bybit: Bitcoin relative strength dominates', 'Decrypt', SourceTier.NEWS, 85, ['BTC'], MarketEventType.GENERAL_NEWS, 80),
            createSampleEvent('2', 'SEC expands guidance for tokenized stocks, benefiting Coinbase & Robinhood', 'CoinDesk', SourceTier.NEWS, 90, ['COIN'], MarketEventType.REGULATION, 85),
            createSampleEvent('3', 'Bitcoin resilience shines amid volatile market sentiment', 'CoinDesk', SourceTier.NEWS, 85, ['BTC'], MarketEventType.GENERAL_NEWS, 75),
            createSampleEvent('4', 'Bitcoin ETFs see $433M Friday inflow while Ether ETF 4-week streak ends', 'The Block', SourceTier.NEWS, 88, ['BTC', 'ETH'], MarketEventType.ETF, 90),
            createSampleEvent('5', 'Clarity Act failure keeps SEC and CFTC in central crypto roles', 'Decrypt', SourceTier.NEWS, 85, ['CRYPTO'], MarketEventType.REGULATION, 80),
            createSampleEvent('6', 'Grayscale announces Zcash ETF share split', 'Cointelegraph', SourceTier.NEWS, 80, ['ZEC'], MarketEventType.ETF, 65),
            // Noise items that should be ignored into ignoredEventIds
            createSampleEvent('7', 'Trump signs executive order establishing US AI Task Force', 'TechCrunch', SourceTier.NEWS, 70, [], MarketEventType.GENERAL_NEWS, 50),
            createSampleEvent('8', 'Accenture partners with Anthropic on enterprise AI software', 'VentureBeat', SourceTier.NEWS, 70, [], MarketEventType.GENERAL_NEWS, 50),
        ];

        const intel = summaryService.synthesizeDeterministicMarketIntelligence(events);

        // 1. Noise filtering verification
        expect(intel.ignoredEventIds.length).toBe(2);
        expect(intel.ignoredEventIds.some((i) => i.eventId.includes('7'))).toBe(true);
        expect(intel.ignoredEventIds.some((i) => i.eventId.includes('8'))).toBe(true);
        expect(intel.usedEventIds.length).toBe(6);

        // 2. Summary verification
        expect(intel.summaryVi).toContain('Bitcoin tiếp tục là tài sản dẫn dắt rõ rệt');
        expect(validateVietnameseOutput(intel.summaryVi)).toBe(true);

        // 3. Market State
        expect(intel.marketState.btc).toBe('Tích cực');
        expect(intel.marketState.eth).toBe('Trung lập');
        expect(intel.marketState.altcoin).toBe('Thận trọng');

        // 4. Narratives (3-5 narratives)
        expect(intel.narratives.length).toBeGreaterThanOrEqual(3);
        expect(intel.narratives.length).toBeLessThanOrEqual(5);
        expect(intel.narratives.some((n) => n.titleVi.includes('BTC tiếp tục'))).toBe(true);
        expect(intel.narratives.some((n) => n.titleVi.includes('Dòng tiền tổ chức'))).toBe(true);
        expect(intel.narratives.some((n) => n.titleVi.includes('Tokenization'))).toBe(true);

        // 5. Asset analysis
        expect(intel.assetAnalysis.some((a) => a.asset === 'BTC' && a.outlook === 'TÍCH CỰC')).toBe(true);
        expect(intel.assetAnalysis.some((a) => a.asset === 'ETH' && a.outlook === 'TRUNG LẬP')).toBe(true);
        expect(intel.assetAnalysis.some((a) => a.asset === 'ALTCOIN' && a.outlook === 'THẬN TRỌNG')).toBe(true);

        // 6. Institutional flows and Regulation
        expect(intel.institutionalFlowVi).toBeDefined();
        expect(intel.institutionalFlowVi).toContain('Dữ liệu ETF');
        expect(intel.regulationVi).toBeDefined();
        expect(intel.regulationVi).toContain('Cơ quan quản lý');

        // 7. Catalysts, Risks, Watch
        expect(intel.catalystsVi.length).toBeGreaterThan(0);
        expect(intel.risksVi.length).toBeGreaterThan(0);
        expect(intel.watchNextVi.length).toBeGreaterThan(0);

        // 8. Scores
        expect(intel.overallImpactScore).toBeGreaterThanOrEqual(60);
        expect(intel.analysisConfidence).toBeGreaterThanOrEqual(80);
    });

    it('6. CryptoDigestFormatterService renders Section 18 Google Chat layout with precision', () => {
        const events: AggregatedMarketEvent[] = [
            createSampleEvent('1', 'Glassnode / Bybit: Bitcoin relative strength', 'Decrypt', SourceTier.NEWS, 85, ['BTC'], MarketEventType.GENERAL_NEWS, 80),
            createSampleEvent('2', 'SEC guidance on tokenized stocks', 'CoinDesk', SourceTier.NEWS, 90, ['COIN'], MarketEventType.REGULATION, 85),
            createSampleEvent('3', 'Bitcoin ETF inflows surge $433M', 'The Block', SourceTier.NEWS, 88, ['BTC'], MarketEventType.ETF, 90),
        ];

        const payload: DigestPayload = {
            id: 'digest_s18',
            title: 'Crypto Market Intelligence',
            periodHours: 6,
            generatedAt: new Date(),
            items: events,
        };

        const output = formatterService.formatDigest(payload);

        // Header
        expect(output).toContain('🚀 CRYPTO MARKET INTELLIGENCE');
        expect(output).toContain('Phân tích tổng hợp từ 3 nguồn tin mới nhất và đáng chú ý.');

        // Sections in exact order
        expect(output).toContain('🧭 TÓM TẮT THỊ TRƯỜNG');
        expect(output).toContain('🌡️ Trạng thái:');
        expect(output).toContain('BTC: Tích cực');
        expect(output).toContain('📊 Mức ảnh hưởng tổng hợp:');

        // Narratives
        expect(output).toContain('NARRATIVE CHÍNH');
        expect(output).toContain('1️⃣ BTC tiếp tục dẫn dắt thị trường');

        // Asset sections
        expect(output).toContain('₿ BTC — TÍCH CỰC');
        expect(output).toContain('→ Tín hiệu chính:');

        // Institutional & Regulation
        expect(output).toContain('🏦 DÒNG TIỀN TỔ CHỨC');
        expect(output).toContain('🏛️ PHÁP LÝ & THỊ TRƯỜNG');

        // Catalysts, Risks, Watch
        expect(output).toContain('🚀 CATALYST ĐÁNG CHÚ Ý');
        expect(output).toContain('⚠️ RỦI RO');
        expect(output).toContain('👀 CẦN THEO DÕI');

        // Sources appendix (Section 19: 1 line per source)
        expect(output).toContain('📰 NGUỒN THAM CHIẾU');
        expect(output).toContain('1. Decrypt — Glassnode / Bybit: Bitcoin relative strength');
        expect(output).toContain('2. CoinDesk — SEC guidance on tokenized stocks');
        expect(output).toContain('3. The Block — Bitcoin ETF inflows surge $433M');

        // Confidence and disclaimer
        expect(output).toContain('📊 Độ tin cậy phân tích:');
        expect(output).toContain('Thông tin nhằm hỗ trợ theo dõi thị trường,\nkhông phải khuyến nghị đầu tư.');

        // Verify no raw feed alert title
        expect(output).not.toContain('⚡ [HUB ALERT] TIN TỨC MỚI NHẤT');
        expect(output).not.toContain('CRYPTO INTELLIGENCE DIGEST');

        // Verify no BUY / SELL financial advice
        expect(output).not.toMatch(/\bBUY\b/i);
        expect(output).not.toMatch(/\bSELL\b/i);
        expect(output).not.toContain('khuyên mua');
        expect(output).not.toContain('khuyên bán');
    });
});
