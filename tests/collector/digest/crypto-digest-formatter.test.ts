import { describe, expect, it } from 'vitest';
import { SourceTier, VerificationStatus } from '../../../lib/collector/types';
import { EventPriority, MarketEventType, type MarketEvent } from '../../../lib/collector/notifications/types';
import { CryptoDigestFormatterService } from '../../../lib/collector/digest/crypto-digest-formatter.service';
import type { AggregatedMarketEvent, DigestPayload } from '../../../lib/collector/digest/types';

describe('CryptoDigestFormatterService', () => {
    const formatter = new CryptoDigestFormatterService();

    const createSampleAggregated = (): AggregatedMarketEvent => {
        const primaryEvent: MarketEvent = {
            id: 'evt_1',
            title: 'Coinbase niêm yết $PEPE',
            url: 'https://coinbase.com/listing/pepe',
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
            impactScore: 92,
            tokens: ['PEPE'],
            symbols: ['$PEPE'],
            chains: ['Ethereum'],
            publishedAt: new Date(),
            createdAt: new Date(),
        };

        return {
            id: 'agg_1',
            canonicalFingerprint: 'listing_coinbase_pepe',
            primaryEvent,
            title: primaryEvent.title,
            vietnameseTitle: 'Coinbase thông báo niêm yết $PEPE',
            vietnameseSummary:
                'Coinbase Markets xác nhận hỗ trợ giao dịch $PEPE. Đây là thông tin từ nguồn chính thức giúp tăng mạnh thanh khoản và độ phủ sóng. Sự kiện tác động trực tiếp tới biến động giá của $PEPE.',
            canonicalUrl: primaryEvent.url,
            category: primaryEvent.category,
            eventType: primaryEvent.eventType,
            verificationStatus: primaryEvent.verificationStatus,
            tokens: ['PEPE'],
            symbols: ['$PEPE'],
            chains: ['Ethereum'],
            topics: ['LISTING'],
            impactScore: 92,
            publishedAt: primaryEvent.publishedAt,
            createdAt: primaryEvent.createdAt,
            sources: [
                {
                    id: 'coinbase',
                    name: 'Coinbase Markets',
                    tier: SourceTier.OFFICIAL,
                    credibilityScore: 95,
                    url: primaryEvent.url,
                    publishedAt: new Date(),
                },
            ],
            sourceCount: 1,
            officialSourceCount: 1,
            newsSourceCount: 0,
            socialSourceCount: 0,
        };
    };

    it('should format a complete digest matching the requested AI Market Intelligence Brief format', () => {
        const item1 = createSampleAggregated();
        const payload: DigestPayload = {
            id: 'digest_test_1',
            title: 'Top 1 Crypto Market Intelligence',
            periodHours: 6,
            generatedAt: new Date(),
            items: [item1],
            marketIntelligence: {
                summaryVi: 'Bitcoin và thị trường tiền mã hóa tiếp tục phân hóa mạnh mẽ. Hoạt động niêm yết mới của các sàn giao dịch lớn mang lại thanh khoản cho token meme, tuy nhiên dòng tiền lớn vẫn tập trung chọn lọc.',
                overallImpactScore: 68,
                analysisConfidence: 87,
                marketState: {
                    overall: 'NGHIÊNG TÍCH CỰC ĐỐI VỚI BTC, TRUNG LẬP ĐỐI VỚI ALTCOIN',
                    btc: 'Tích cực',
                    eth: 'Trung lập',
                    altcoin: 'Thận trọng',
                    meme: 'Theo dõi biến động',
                },
                narratives: [
                    {
                        titleVi: 'Sàn lớn mở rộng hỗ trợ giao dịch cho memecoin thanh khoản cao',
                        summaryVi: 'Coinbase niêm yết $PEPE mở rộng cánh cửa tiếp cận vốn cho nhà đầu tư bán lẻ và tổ chức.',
                        strength: 'HIGH',
                        supportingEventIds: ['agg_1'],
                    },
                ],
                assetAnalysis: [
                    {
                        asset: 'MEME',
                        outlook: 'THEO DÕI',
                        summaryVi: 'Dòng tiền đầu cơ có dấu hiệu tăng nhiệt cục bộ sau thông tin niêm yết.',
                        signalsVi: ['Coinbase niêm yết $PEPE', 'Thanh khoản giao dịch đột biến ngắn hạn'],
                    },
                ],
                catalystsVi: ['Coinbase chính thức mở giao dịch $PEPE'],
                risksVi: ['Biến động hai chiều mạnh đối với nhóm memecoin'],
                watchNextVi: ['Thanh khoản của $PEPE có được duy trì ổn định sau niêm yết?'],
                usedEventIds: ['agg_1'],
                ignoredEventIds: [],
            },
        };

        const result = formatter.formatDigest(payload);

        // Header checks (Section 18 & 24)
        expect(result).toContain('🚀 CRYPTO MARKET INTELLIGENCE');
        expect(result).toContain('Phân tích tổng hợp từ 1 nguồn tin mới nhất và đáng chú ý.');

        // Market overview summary
        expect(result).toContain('🧭 TÓM TẮT THỊ TRƯỜNG');
        expect(result).toContain('Bitcoin và thị trường tiền mã hóa tiếp tục phân hóa mạnh mẽ.');
        expect(result).toContain('🌡️ Trạng thái:');
        expect(result).toContain('BTC: Tích cực');
        expect(result).toContain('📊 Mức ảnh hưởng tổng hợp:');
        expect(result).toContain('68/100 — Đáng chú ý');

        // Narratives
        expect(result).toContain('🔥 1 NARRATIVE CHÍNH');
        expect(result).toContain('1️⃣ Sàn lớn mở rộng hỗ trợ giao dịch cho memecoin thanh khoản cao');

        // Asset analysis
        expect(result).toContain('🐸 MEME — THEO DÕI');
        expect(result).toContain('• Coinbase niêm yết $PEPE');
        expect(result).toContain('→ Tín hiệu chính:');

        // Catalysts, risks, watch
        expect(result).toContain('🚀 CATALYST ĐÁNG CHÚ Ý');
        expect(result).toContain('⚠️ RỦI RO');
        expect(result).toContain('👀 CẦN THEO DÕI');

        // Sources appendix (Section 19: 1 line per source)
        expect(result).toContain('📰 NGUỒN THAM CHIẾU');
        expect(result).toContain('1. Coinbase Markets — Coinbase thông báo niêm yết $PEPE');

        // Confidence and disclaimer (Section 18)
        expect(result).toContain('📊 Độ tin cậy phân tích: 87/100 — Cao');
        expect(result).toContain('Thông tin nhằm hỗ trợ theo dõi thị trường,');
        expect(result).toContain('không phải khuyến nghị đầu tư.');
    });

    it('should fallback gracefully to deterministic synthesis when marketIntelligence is not pre-set', () => {
        const item1 = createSampleAggregated();
        const payload: DigestPayload = {
            id: 'digest_test_2',
            title: 'Top 1 Crypto Market Intelligence',
            periodHours: 6,
            generatedAt: new Date(),
            items: [item1],
        };

        const result = formatter.formatDigest(payload);
        expect(result).toContain('🚀 CRYPTO MARKET INTELLIGENCE');
        expect(result).toContain('🧭 TÓM TẮT THỊ TRƯỜNG');
        expect(result).toContain('NARRATIVE CHÍNH');
        expect(result).toContain('📰 NGUỒN THAM CHIẾU');
        expect(result).toContain('1. Coinbase Markets —');
    });
});
