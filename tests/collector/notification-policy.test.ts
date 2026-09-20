import { describe, expect, it } from 'vitest';

import { NotificationPolicyService } from '../../lib/collector/notifications/policy/notification-policy.service';
import { EventPriority, type MarketEvent, MarketEventType, VerificationStatus } from '../../lib/collector/notifications/types';
import { SourceTier } from '../../lib/collector/types';

describe('NotificationPolicyService', () => {
    const policy = new NotificationPolicyService({ minImpactScore: 80 });

    const createBaseEvent = (overrides: Partial<MarketEvent> = {}): MarketEvent => ({
        id: 'evt_test_1',
        title: 'Test Market Event',
        url: 'https://official.exchange.com/announcements/1',
        source: {
            id: 'binance-official',
            name: 'Binance',
            tier: SourceTier.OFFICIAL,
            credibilityScore: 98,
        },
        category: 'CRYPTO_NEWS',
        eventType: MarketEventType.GENERAL_NEWS,
        verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
        priority: EventPriority.P1,
        impactScore: 82,
        tokens: ['BTC'],
        symbols: ['$BTC'],
        chains: ['Bitcoin'],
        publishedAt: new Date(),
        createdAt: new Date(),
        ...overrides,
    });

    it('should immediately alert for priority P0 events', () => {
        const event = createBaseEvent({ priority: EventPriority.P0, impactScore: 70 });
        expect(policy.shouldNotify(event)).toBe(true);
    });

    it('should alert for verified events meeting minImpactScore threshold', () => {
        const event = createBaseEvent({ impactScore: 85, verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE });
        expect(policy.shouldNotify(event)).toBe(true);
    });

    it('should reject events with impactScore below threshold', () => {
        const event = createBaseEvent({ priority: EventPriority.P2, impactScore: 65, verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE });
        expect(policy.shouldNotify(event)).toBe(false);
    });

    it('should reject unverified events even if impactScore is above threshold', () => {
        const event = createBaseEvent({
            priority: EventPriority.P1,
            impactScore: 88,
            verificationStatus: VerificationStatus.UNVERIFIED,
        });
        expect(policy.shouldNotify(event)).toBe(false);
    });

    it('should alert for critical event types with verified sources', () => {
        const listingEvent = createBaseEvent({
            eventType: MarketEventType.EXCHANGE_LISTING,
            impactScore: 78,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
        });
        expect(policy.shouldNotify(listingEvent)).toBe(true);

        const centralBankEvent = createBaseEvent({
            eventType: MarketEventType.CENTRAL_BANK_DECISION,
            impactScore: 79,
            verificationStatus: VerificationStatus.CONFIRMED_MULTI_SOURCE,
        });
        expect(policy.shouldNotify(centralBankEvent)).toBe(true);
    });

    describe('Meme Alert Evaluation', () => {
        it('should alert when official exchange mentions token (e.g., Robinhood lists PEPE)', () => {
            const memeEvent = createBaseEvent({
                category: 'MEMECOIN',
                eventType: MarketEventType.BROKER_LISTING,
                tokens: ['PEPE'],
                symbols: ['$PEPE'],
                source: {
                    id: 'robinhood',
                    name: 'Robinhood',
                    tier: SourceTier.OFFICIAL,
                    credibilityScore: 95,
                },
                officialSources: ['Robinhood'],
            });
            expect(policy.shouldNotify(memeEvent)).toBe(true);
        });

        it('should alert when trendScore >= 85', () => {
            const memeEvent = createBaseEvent({
                category: 'MEMECOIN',
                eventType: MarketEventType.MEME_TREND,
                trendScore: 89,
                tokens: ['BONK'],
                symbols: ['$BONK'],
                source: {
                    id: 'reddit',
                    name: 'Reddit',
                    tier: SourceTier.COMMUNITY,
                    credibilityScore: 50,
                },
            });
            expect(policy.shouldNotify(memeEvent)).toBe(true);
        });

        it('should alert when mentionVelocity and uniqueSources exceed thresholds', () => {
            const memeEvent = createBaseEvent({
                category: 'MEMECOIN',
                eventType: MarketEventType.MEME_TREND,
                trendScore: 70,
                memeMetrics: {
                    velocity: 25,
                    uniqueSources: 10,
                },
            });
            expect(policy.shouldNotify(memeEvent)).toBe(true);
        });

        it('should reject routine random social mentions', () => {
            const routineMemeEvent = createBaseEvent({
                category: 'MEMECOIN',
                eventType: MarketEventType.MEME_TREND,
                trendScore: 50,
                source: {
                    id: 'reddit-memecoins',
                    name: 'Reddit',
                    tier: SourceTier.COMMUNITY,
                    credibilityScore: 40,
                },
                memeMetrics: {
                    velocity: 2,
                    uniqueSources: 1,
                },
            });
            expect(policy.shouldNotify(routineMemeEvent)).toBe(false);
        });
    });
});
