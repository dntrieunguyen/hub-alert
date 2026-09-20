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

    it('should format a complete digest matching the requested Google Chat format', () => {
        const item1 = createSampleAggregated();
        const payload: DigestPayload = {
            id: 'digest_test_1',
            title: 'Top 1 Crypto Intelligence Digest',
            periodHours: 6,
            generatedAt: new Date(),
            items: [item1],
            snapshot: {
                btcContext: 'BTC tiếp tục tích lũy quanh ngưỡng kháng cự chính',
                macroContext: 'Fed chuẩn bị họp FOMC công bố lãi suất',
            },
            trendingTokens: [
                {
                    symbol: '$PEPE',
                    name: 'Pepe',
                    trendScore: 94,
                    mentionChangePercent: 376,
                    topSources: ['Coinbase', 'Robinhood', 'CoinDesk'],
                },
            ],
            macroHighlights: ['Federal Reserve: Quyết định lãi suất giữ nguyên'],
            signalsToWatch: ['Token $PEPE đang xuất hiện đồng thời trên Coinbase và Robinhood'],
        };

        const result = formatter.formatDigest(payload);

        // Header checks
        expect(result).toContain('🚀 CRYPTO INTELLIGENCE DIGEST');
        expect(result).toContain('Bản tin chắt lọc những sự kiện Crypto, Meme và thị trường');

        // Section 1 checks
        expect(result).toContain('📌 1. ĐIỂM TIN QUAN TRỌNG');
        expect(result).toContain('1. <https://coinbase.com/listing/pepe|Coinbase thông báo niêm yết $PEPE>');
        expect(result).toContain('Coinbase Markets xác nhận hỗ trợ giao dịch $PEPE');
        expect(result).toContain('Nguồn: Coinbase Markets (Nguồn chính thức)');
        expect(result).toContain('Độ tin cậy: Chính thức / Rất cao');
        expect(result).toContain('Mức ảnh hưởng: 92/100');

        // Section 2 Market Snapshot checks
        expect(result).toContain('📊 2. MARKET SNAPSHOT');
        expect(result).toContain('• BTC: BTC tiếp tục tích lũy');
        expect(result).toContain('• Macro: Fed chuẩn bị họp');

        // Section 3 Trending tokens checks
        expect(result).toContain('🔥 3. TOKEN ĐANG ĐƯỢC CHÚ Ý');
        expect(result).toContain('1. $PEPE — Trend Score 94/100 (Tốc độ đề cập 1h: +376%)');
        expect(result).toContain('Nguồn nổi bật: Coinbase, Robinhood, CoinDesk');

        // Section 4 Macro & Regulation checks
        expect(result).toContain('🏛️ 4. MACRO & REGULATION');
        expect(result).toContain('• Federal Reserve: Quyết định lãi suất');

        // Section 5 Signals to watch checks
        expect(result).toContain('👀 5. CẦN THEO DÕI');
        expect(result).toContain('• Token $PEPE đang xuất hiện');

        // Footer check
        expect(result).toContain('Bản tin không cấu thành khuyến nghị đầu tư tài chính');
    });

    it('should omit optional sections when no data exists', () => {
        const item1 = createSampleAggregated();
        const payload: DigestPayload = {
            id: 'digest_test_2',
            title: 'Top 1 Crypto Intelligence Digest',
            periodHours: 6,
            generatedAt: new Date(),
            items: [item1],
        };

        const result = formatter.formatDigest(payload);
        expect(result).toContain('📌 1. ĐIỂM TIN QUAN TRỌNG');
        expect(result).not.toContain('📊 2. MARKET SNAPSHOT');
        expect(result).not.toContain('🔥 3. TOKEN ĐANG ĐƯỢC CHÚ Ý');
        expect(result).not.toContain('🏛️ 4. MACRO & REGULATION');
        expect(result).not.toContain('👀 5. CẦN THEO DÕI');
    });

    it('should include critical alert badge when item was previously alerted', () => {
        const item1 = createSampleAggregated();
        item1.wasCriticalAlerted = true;

        const payload: DigestPayload = {
            id: 'digest_test_3',
            title: 'Top 1 Crypto Intelligence Digest',
            periodHours: 6,
            generatedAt: new Date(),
            items: [item1],
        };

        const result = formatter.formatDigest(payload);
        expect(result).toContain('⚠️ Trạng thái: [Đã phát cảnh báo khẩn cấp trước đó]');
    });
});
