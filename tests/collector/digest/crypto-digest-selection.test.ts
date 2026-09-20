import { describe, expect, it } from 'vitest';
import { SourceTier, VerificationStatus } from '../../../lib/collector/types';
import { EventPriority, MarketEventType, type MarketEvent } from '../../../lib/collector/notifications/types';
import { CryptoDigestConfigService } from '../../../lib/collector/digest/crypto-digest-config.service';
import { CryptoDigestRankingService } from '../../../lib/collector/digest/crypto-digest-ranking.service';
import { CryptoDigestSelectionService } from '../../../lib/collector/digest/crypto-digest-selection.service';

describe('CryptoDigestSelectionService', () => {
    const rankingService = new CryptoDigestRankingService();
    const selectionService = new CryptoDigestSelectionService(rankingService);
    const configService = new CryptoDigestConfigService();
    const config = configService.getConfig();

    const makeEvent = (
        id: string,
        title: string,
        sourceName: string,
        sourceTier: SourceTier,
        credibilityScore: number,
        tokens: string[],
        eventType: MarketEventType,
        impactScore = 85,
        verificationStatus = VerificationStatus.CONFIRMED_PRIMARY_SOURCE
    ): MarketEvent => ({
        id,
        title,
        url: `https://example.com/${id}`,
        source: {
            id: sourceName.toLowerCase().replace(/\s+/g, '-'),
            name: sourceName,
            tier: sourceTier,
            credibilityScore,
        },
        category: 'CRYPTO_NEWS',
        eventType,
        verificationStatus,
        priority: EventPriority.P0,
        impactScore,
        tokens,
        symbols: tokens.map((t) => `$${t}`),
        chains: ['Ethereum'],
        publishedAt: new Date(),
        createdAt: new Date(),
    });

    it('should deduplicate multiple sources reporting the same listing event into 1 aggregated event', () => {
        const events: MarketEvent[] = [
            makeEvent('evt1', 'Coinbase announces PEPE listing', 'Coinbase Markets', SourceTier.OFFICIAL, 95, ['PEPE'], MarketEventType.EXCHANGE_LISTING),
            makeEvent('evt2', 'CoinDesk reports Coinbase lists PEPE', 'CoinDesk', SourceTier.NEWS, 85, ['PEPE'], MarketEventType.EXCHANGE_LISTING),
            makeEvent('evt3', 'PEPE listed on Coinbase says community', 'X Community', SourceTier.COMMUNITY, 40, ['PEPE'], MarketEventType.EXCHANGE_LISTING),
        ];

        const aggregated = selectionService.aggregateEvents(events);
        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].sourceCount).toBe(3);
        expect(aggregated[0].officialSourceCount).toBe(1);
        expect(aggregated[0].newsSourceCount).toBe(1);
        expect(aggregated[0].socialSourceCount).toBe(1);
        // Canonical url should pick the official Coinbase url
        expect(aggregated[0].canonicalUrl).toBe('https://example.com/evt1');
    });

    it('should exclude disputed events and low quality items below threshold', async () => {
        const events: MarketEvent[] = [
            makeEvent('evt_good', 'Fed cuts rates 50bps', 'Federal Reserve', SourceTier.OFFICIAL, 100, ['BTC'], MarketEventType.CENTRAL_BANK_DECISION, 98),
            makeEvent('evt_disputed', 'Fake news about SEC approving ETF', 'Random Blog', SourceTier.COMMUNITY, 30, ['SOL'], MarketEventType.ETF, 90, VerificationStatus.DISPUTED),
            makeEvent('evt_low_score', 'Minor token website redesign', 'Small Blog', SourceTier.COMMUNITY, 40, ['XYZ'], MarketEventType.GENERAL_NEWS, 40, VerificationStatus.UNVERIFIED),
        ];

        const selected = await selectionService.selectDigestEvents(events, config);
        expect(selected).toHaveLength(1);
        expect(selected[0].tokens).toContain('BTC');
    });

    it('should reject memecoins without strong signals (influencer hype only)', async () => {
        const randomHype = makeEvent(
            'evt_meme_hype',
            'Random influencer tweets buy $SHIB2',
            'Random X Account',
            SourceTier.COMMUNITY,
            30,
            ['SHIB2'],
            MarketEventType.MEME_TREND,
            60,
            VerificationStatus.UNVERIFIED
        );
        randomHype.category = 'MEMECOIN';

        const officialListing = makeEvent(
            'evt_meme_listing',
            'Robinhood adds support for $PEPE',
            'Robinhood',
            SourceTier.OFFICIAL,
            95,
            ['PEPE'],
            MarketEventType.BROKER_LISTING,
            92
        );
        officialListing.category = 'MEMECOIN';

        const selected = await selectionService.selectDigestEvents([randomHype, officialListing], config);
        expect(selected).toHaveLength(1);
        expect(selected[0].tokens).toContain('PEPE');
    });

    it('should enforce diversity limits (max 2 per token, max 3 per source)', async () => {
        // Create 4 events for the same token (BTC) from same source
        const events: MarketEvent[] = [
            makeEvent('btc1', 'CoinDesk: Bitcoin surges past 100k', 'CoinDesk', SourceTier.NEWS, 85, ['BTC'], MarketEventType.GENERAL_NEWS, 90),
            makeEvent('btc2', 'CoinDesk: Bitcoin hash rate hits all time high', 'CoinDesk', SourceTier.NEWS, 85, ['BTC'], MarketEventType.NETWORK_INCIDENT, 88),
            makeEvent('btc3', 'CoinDesk: Bitcoin miners increase holdings', 'CoinDesk', SourceTier.NEWS, 85, ['BTC'], MarketEventType.GENERAL_NEWS, 85),
            makeEvent('eth1', 'Coinbase: Ethereum upgrade successful', 'Coinbase', SourceTier.OFFICIAL, 95, ['ETH'], MarketEventType.GENERAL_NEWS, 90),
            makeEvent('sol1', 'Robinhood: Solana staking launched', 'Robinhood', SourceTier.OFFICIAL, 95, ['SOL'], MarketEventType.EXCHANGE_LISTING, 90),
        ];

        const selected = await selectionService.selectDigestEvents(events, config);
        const btcItems = selected.filter((i) => i.tokens.includes('BTC'));

        // Max 2 items for BTC
        expect(btcItems.length).toBeLessThanOrEqual(config.diversity.maxPerToken);
        expect(selected.map((s) => s.tokens[0])).toEqual(expect.arrayContaining(['BTC', 'ETH', 'SOL']));
    });

    it('should return exactly the number of qualified items without padding to 10', async () => {
        const events: MarketEvent[] = [
            makeEvent('evt1', 'Fed holds interest rates', 'Federal Reserve', SourceTier.OFFICIAL, 100, ['BTC'], MarketEventType.CENTRAL_BANK_DECISION, 98),
            makeEvent('evt2', 'SEC issues statement on crypto staking', 'SEC', SourceTier.OFFICIAL, 100, ['ETH'], MarketEventType.REGULATION, 94),
            makeEvent('evt3', 'Coinbase lists new asset', 'Coinbase Markets', SourceTier.OFFICIAL, 95, ['AAVE'], MarketEventType.EXCHANGE_LISTING, 90),
        ];

        const selected = await selectionService.selectDigestEvents(events, config);
        // Only 3 qualified items -> return exactly 3, not 10!
        expect(selected).toHaveLength(3);
    });

    it('should skip events already delivered in past digests', async () => {
        const events: MarketEvent[] = [
            makeEvent('evt1', 'Fed holds interest rates', 'Federal Reserve', SourceTier.OFFICIAL, 100, ['BTC'], MarketEventType.CENTRAL_BANK_DECISION, 98),
        ];

        const fp = selectionService.computeCanonicalFingerprint(events[0]);
        const delivered = new Set([fp]);

        const selected = await selectionService.selectDigestEvents(events, config, delivered);
        expect(selected).toHaveLength(0);
    });
});
