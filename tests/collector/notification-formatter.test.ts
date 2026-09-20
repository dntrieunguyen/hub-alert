import { describe, expect, it } from 'vitest';

import { GoogleChatMessageFormatter } from '../../lib/collector/notifications/google-chat/google-chat-message.formatter';
import { EventPriority, type MarketEvent, MarketEventType, VerificationStatus } from '../../lib/collector/notifications/types';
import { SourceTier } from '../../lib/collector/types';

describe('GoogleChatMessageFormatter', () => {
    const formatter = new GoogleChatMessageFormatter();

    it('should format Crypto Listing alert with correct structure and emojis', () => {
        const event: MarketEvent = {
            id: 'evt_listing_1',
            title: 'Coinbase announced support for PEPE.',
            summary: 'Coinbase announced support for PEPE.',
            url: 'https://coinbase.com/announcement/pepe',
            source: {
                id: 'coinbase',
                name: 'Coinbase Markets',
                tier: SourceTier.OFFICIAL,
                credibilityScore: 98,
            },
            category: 'CRYPTO_NEWS',
            eventType: MarketEventType.EXCHANGE_LISTING,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            priority: EventPriority.P0,
            impactScore: 92,
            tokens: ['PEPE'],
            symbols: ['$PEPE'],
            chains: ['Ethereum'],
            publishedAt: new Date('2026-09-20T06:20:00.000Z'),
            createdAt: new Date(),
        };

        const message = formatter.formatMarketEvent(event);

        expect(message).toContain('🚨 CRYPTO ALERT');
        expect(message).toContain('PEPE');
        expect(message).toContain('Coinbase announced support for PEPE.');
        expect(message).toContain('Event:\nEXCHANGE_LISTING');
        expect(message).toContain('Source:\nCoinbase Markets');
        expect(message).toContain('Impact:\n92/100');
        expect(message).toContain('Verification:\nCONFIRMED_PRIMARY_SOURCE');
        expect(message).toContain('GMT+7');
        expect(message).toContain('https://coinbase.com/announcement/pepe');
    });

    it('should format Meme Alert with metrics and official sources', () => {
        const event: MarketEvent = {
            id: 'evt_meme_1',
            title: 'Meme surge detected for $PEPE',
            url: 'https://robinhood.com/crypto/pepe',
            source: {
                id: 'market-intel',
                name: 'Robinhood',
                tier: SourceTier.OFFICIAL,
                credibilityScore: 95,
            },
            category: 'MEMECOIN',
            eventType: MarketEventType.MEME_TREND,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            priority: EventPriority.P0,
            impactScore: 94,
            trendScore: 94,
            tokens: ['PEPE'],
            symbols: ['$PEPE'],
            chains: ['Ethereum'],
            officialSources: ['Robinhood', 'Coinbase Markets'],
            memeMetrics: {
                mentions1h: 428,
                mentionChangePercent: 376,
                uniqueSources: 91,
                velocity: 42.8,
            },
            publishedAt: new Date('2026-09-20T06:20:00.000Z'),
            createdAt: new Date(),
        };

        const message = formatter.formatMarketEvent(event);

        expect(message).toContain('🔥 MEME TREND ALERT');
        expect(message).toContain('$PEPE');
        expect(message).toContain('Trend Score:\n94/100');
        expect(message).toContain('Mentions 1h:\n428');
        expect(message).toContain('Mention Change:\n+376%');
        expect(message).toContain('Unique Sources:\n91');
        expect(message).toContain('Official Sources:\nRobinhood\nCoinbase Markets');
        expect(message).toContain('Chain:\nEthereum');
        expect(message).toContain('Source:\nhttps://robinhood.com/crypto/pepe');
    });

    it('should format Macro Alert with affected assets and Federal Reserve details', () => {
        const event: MarketEvent = {
            id: 'evt_macro_1',
            title: 'Federal Reserve Rate Decision',
            url: 'https://federalreserve.gov/newsevents/pressreleases/monetary20260920a.htm',
            source: {
                id: 'fed',
                name: 'Federal Reserve',
                tier: SourceTier.OFFICIAL,
                credibilityScore: 99,
            },
            category: 'MARKET',
            eventType: MarketEventType.CENTRAL_BANK_DECISION,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            priority: EventPriority.P0,
            impactScore: 98,
            tokens: [],
            symbols: [],
            chains: [],
            macroMetrics: {
                affectedAssets: ['BTC', 'ETH', 'Crypto', 'Nasdaq', 'Gold'],
            },
            publishedAt: new Date('2026-09-20T06:20:00.000Z'),
            createdAt: new Date(),
        };

        const message = formatter.formatMarketEvent(event);

        expect(message).toContain('🔴 MACRO ALERT');
        expect(message).toContain('Federal Reserve Rate Decision');
        expect(message).toContain('Event:\nCENTRAL_BANK_DECISION');
        expect(message).toContain('Impact:\n98/100');
        expect(message).toContain('Source:\nFederal Reserve');
        expect(message).toContain('Verification:\nCONFIRMED_PRIMARY_SOURCE');
        expect(message).toContain('Affected:\nBTC\nETH\nCrypto\nNasdaq\nGold');
        expect(message).toContain('GMT+7');
    });

    it('should format Public Official Statement and keep it strictly separated from enacted government policy', () => {
        const event: MarketEvent = {
            id: 'evt_statement_1',
            title: 'Donald Trump comments on crypto regulatory framework',
            url: 'https://truthsocial.com/statement/12345',
            source: {
                id: 'truth-social',
                name: 'Truth Social',
                tier: SourceTier.SOCIAL,
                credibilityScore: 75,
            },
            category: 'CRYPTO_NEWS',
            eventType: MarketEventType.PUBLIC_OFFICIAL_STATEMENT,
            verificationStatus: VerificationStatus.ATTRIBUTED_STATEMENT,
            priority: EventPriority.P1,
            impactScore: 82,
            tokens: ['BTC'],
            symbols: ['$BTC'],
            chains: [],
            statementDetails: {
                speaker: 'Donald Trump',
                topic: 'Crypto / Digital Assets',
                isEnactedPolicy: false,
            },
            publishedAt: new Date('2026-09-20T06:20:00.000Z'),
            createdAt: new Date(),
        };

        const message = formatter.formatMarketEvent(event);

        expect(message).toContain('🏛️ OFFICIAL STATEMENT');
        expect(message).toContain('Donald Trump');
        expect(message).toContain('Topic:\nCrypto / Digital Assets');
        expect(message).toContain('Type:\nPUBLIC_OFFICIAL_STATEMENT');
        expect(message).toContain('Impact:\n82/100');
        expect(message).toContain('Verification:\nATTRIBUTED_STATEMENT');
        expect(message).toContain('Important:\nThis is a public statement and is not classified as enacted government policy.');
        expect(message).toContain('https://truthsocial.com/statement/12345');
    });

    it('should format timestamps accurately in GMT+7 Asia/Ho_Chi_Minh', () => {
        // 06:20 UTC is 13:20 in GMT+7
        const date = new Date('2026-09-20T06:20:00.000Z');
        const formatted = formatter.formatVietnamTime(date);
        expect(formatted).toBe('2026-09-20 13:20 GMT+7');
    });
});
