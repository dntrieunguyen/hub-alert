import { describe, expect, it } from 'vitest';

import { SourceTier, XSourceType } from '../../lib/collector/types';
import { XEventAggregatorService } from '../../lib/collector/x';

describe('XEventAggregatorService', () => {
    it('should aggregate mentions across exchanges and compute consensus and trend score', () => {
        const aggregator = new XEventAggregatorService(20);
        const baseTime = new Date('2026-09-20T10:00:00Z');

        // 1. Robinhood mentions PEPE at T+0
        aggregator.recordMention(
            'PEPE',
            { handle: 'RobinhoodApp', displayName: 'Robinhood', sourceType: XSourceType.BROKER },
            'https://x.com/RobinhoodApp/status/1',
            90,
            baseTime,
        );

        // 2. CoinbaseMarkets mentions PEPE at T+5m
        aggregator.recordMention(
            'PEPE',
            { handle: 'CoinbaseMarkets', displayName: 'Coinbase Markets', sourceType: XSourceType.EXCHANGE },
            'https://x.com/CoinbaseMarkets/status/2',
            92,
            new Date(baseTime.getTime() + 5 * 60 * 1000),
        );

        // 3. Binance mentions PEPE at T+10m
        aggregator.recordMention(
            'PEPE',
            { handle: 'binance', displayName: 'Binance', sourceType: XSourceType.EXCHANGE },
            'https://x.com/binance/status/3',
            90,
            new Date(baseTime.getTime() + 10 * 60 * 1000),
        );

        // 4. News source mentions PEPE at T+12m
        aggregator.recordMention(
            'PEPE',
            { handle: 'CoinDesk', displayName: 'CoinDesk', sourceType: SourceTier.NEWS },
            'https://coindesk.com/markets/pepe-listings',
            80,
            new Date(baseTime.getTime() + 12 * 60 * 1000),
        );

        const checkTime = new Date(baseTime.getTime() + 15 * 60 * 1000);
        const agg = aggregator.getAggregation('PEPE', checkTime);

        expect(agg).not.toBeNull();
        expect(agg?.symbol).toBe('PEPE');
        expect(agg?.officialSources).toBe(3);
        expect(agg?.newsSources).toBe(1);
        expect(agg?.socialMentions).toBe(4);
        expect(agg?.event).toBe('PEPE_MULTI_EXCHANGE_LISTING_CONSENSUS');
        expect(agg?.trendScore).toBeGreaterThanOrEqual(90);
        expect(agg?.sources).toContain('RobinhoodApp');
        expect(agg?.sources).toContain('CoinbaseMarkets');
        expect(agg?.sources).toContain('binance');
        expect(agg?.postUrls).toHaveLength(4);
    });

    it('should prune mentions outside the 20-minute rolling window', () => {
        const aggregator = new XEventAggregatorService(20);
        const baseTime = new Date('2026-09-20T10:00:00Z');

        aggregator.recordMention(
            'WIF',
            { handle: 'RobinhoodApp', displayName: 'Robinhood', sourceType: XSourceType.BROKER },
            'https://x.com/RobinhoodApp/status/100',
            90,
            baseTime,
        );

        // Within window: T+10m
        expect(aggregator.getAggregation('WIF', new Date(baseTime.getTime() + 10 * 60 * 1000))).not.toBeNull();

        // Outside window: T+25m
        expect(aggregator.getAggregation('WIF', new Date(baseTime.getTime() + 25 * 60 * 1000))).toBeNull();
    });
});
