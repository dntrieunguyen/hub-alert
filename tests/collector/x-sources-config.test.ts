import { describe, expect, it } from 'vitest';

import { SourceTier, XSourceType } from '@/collector/types';
import {
    buildXFeedSources,
    CRYPTO_PROJECT_X_SOURCES,
    EUROPE_MACRO_X_SOURCES,
    EXCHANGE_AND_BROKER_X_SOURCES,
    GOVERNMENT_AND_MACRO_X_SOURCES,
    INITIAL_X_SOURCES,
    PUBLIC_OFFICIALS_ROLE_REGISTRY,
    PUBLIC_OFFICIALS_X_SOURCES,
} from '@/collector/x';

describe('X Intelligence Sources Configuration', () => {
    it('should include all required macro and government sources', () => {
        const handles = GOVERNMENT_AND_MACRO_X_SOURCES.map((s) => s.handle);
        expect(handles).toContain('federalreserve');
        expect(handles).toContain('USTreasury');
        expect(handles).toContain('SECGov');
        expect(handles).toContain('CFTC');
        expect(handles).toContain('BLS_gov');
        expect(handles).toContain('WhiteHouse');
        expect(handles).toContain('POTUS');

        const fed = GOVERNMENT_AND_MACRO_X_SOURCES.find((s) => s.handle === 'federalreserve')!;
        expect(fed.sourceType).toBe(XSourceType.CENTRAL_BANK);
        expect(fed.credibilityScore).toBe(100);
        expect(fed.priority).toBe('P0');
        expect(fed.officialDomain).toBe('federalreserve.gov');
        expect(fed.rsshubRoute).toBe('/twitter/user/federalreserve');
    });

    it('should include public officials with dynamic role attribution', () => {
        expect(PUBLIC_OFFICIALS_ROLE_REGISTRY.length).toBeGreaterThan(0);
        const trump = PUBLIC_OFFICIALS_ROLE_REGISTRY.find((r) => r.role === 'PRESIDENT')!;
        expect(trump.handle).toBe('realDonaldTrump');
        expect(trump.name).toBe('Donald Trump');

        const source = PUBLIC_OFFICIALS_X_SOURCES.find((s) => s.handle === 'realDonaldTrump')!;
        expect(source.sourceType).toBe(XSourceType.PUBLIC_OFFICIAL);
        expect(source.role).toBe('PRESIDENT');
    });

    it('should include European macro sources (ECB & Bank of England)', () => {
        const handles = EUROPE_MACRO_X_SOURCES.map((s) => s.handle);
        expect(handles).toContain('ECB');
        expect(handles).toContain('bankofengland');

        const ecb = EUROPE_MACRO_X_SOURCES.find((s) => s.handle === 'ECB')!;
        expect(ecb.officialDomain).toBe('ecb.europa.eu');
        expect(ecb.sourceType).toBe(XSourceType.CENTRAL_BANK);
    });

    it('should include broker and exchange sources with regional separation', () => {
        const handles = EXCHANGE_AND_BROKER_X_SOURCES.map((s) => s.handle);
        expect(handles).toContain('RobinhoodApp');
        expect(handles).toContain('RobinhoodApp_EU');
        expect(handles).toContain('CoinbaseMarkets');
        expect(handles).toContain('binance');

        const robinhoodUS = EXCHANGE_AND_BROKER_X_SOURCES.find((s) => s.handle === 'RobinhoodApp')!;
        const robinhoodEU = EXCHANGE_AND_BROKER_X_SOURCES.find((s) => s.handle === 'RobinhoodApp_EU')!;
        expect(robinhoodUS.sourceType).toBe(XSourceType.BROKER);
        expect(robinhoodEU.regions).toContain('EU');
    });

    it('should include crypto infrastructure project sources', () => {
        const handles = CRYPTO_PROJECT_X_SOURCES.map((s) => s.handle);
        expect(handles).toContain('ethereum');
        expect(handles).toContain('solana');
        expect(handles).toContain('base');
        expect(handles).toContain('arbitrum');
        expect(handles).toContain('Optimism');
        expect(handles).toContain('chainlink');

        const solana = CRYPTO_PROJECT_X_SOURCES.find((s) => s.handle === 'solana')!;
        expect(solana.sourceType).toBe(XSourceType.CRYPTO_PROJECT);
        expect(solana.priority).toBe('P1');
    });

    it('should convert XSources into valid FeedSource objects', () => {
        const feedSources = buildXFeedSources(INITIAL_X_SOURCES);
        expect(feedSources.length).toBe(INITIAL_X_SOURCES.length);

        for (const fs of feedSources) {
            expect(fs.platform).toBe('X');
            expect(fs.id).toMatch(/^x-/);
            expect(fs.handle).toBeDefined();
            expect(fs.rssUrl).toMatch(/^\/twitter\/user\//);
            expect(fs.sourceTier).toBeDefined();
            expect(fs.pollingInterval).toBeGreaterThan(0);
        }
    });
});
