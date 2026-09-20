import { describe, expect, it } from 'vitest';

import { VerificationStatus, XEventType, XSourceType } from '../../lib/collector/types';
import {
    PUBLIC_OFFICIALS_ROLE_REGISTRY,
    XEventDetectorService,
    type XSource,
    XVerificationService,
} from '../../lib/collector/x';

describe('X Verification and Event Detection', () => {
    const verifier = new XVerificationService(PUBLIC_OFFICIALS_ROLE_REGISTRY);
    const detector = new XEventDetectorService();

    describe('Verification Compromise Defense', () => {
        const secSource: XSource = {
            handle: 'SECGov',
            displayName: 'U.S. SEC',
            enabled: true,
            sourceType: XSourceType.GOVERNMENT_AGENCY,
            credibilityScore: 100,
            priority: 'P0',
            pollingInterval: 60,
            categories: ['REGULATION', 'CRYPTO'],
            watchTopics: ['ETF', 'enforcement'],
            requiresConfirmation: true,
            officialDomain: 'sec.gov',
            rsshubRoute: '/twitter/user/SECGov',
        };

        it('should classify as CONFIRMED_PRIMARY_SOURCE when official source links to official domain', () => {
            const linkAnalysis = {
                linkedUrls: ['https://www.sec.gov/news/press-release/2025-1'],
                linkedDomains: ['sec.gov'],
                hasPrimarySourceLink: true,
                matchedOfficialDomain: 'sec.gov',
            };

            const result = verifier.verifyPost(secSource, linkAnalysis);
            expect(result.status).toBe(VerificationStatus.CONFIRMED_PRIMARY_SOURCE);
            expect(result.isPrimarySourceLinked).toBe(true);
        });

        it('should classify as OFFICIAL_SOCIAL_ONLY when official source has NO official domain link (defense against compromise)', () => {
            const linkAnalysis = {
                linkedUrls: [],
                linkedDomains: [],
                hasPrimarySourceLink: false,
            };

            const result = verifier.verifyPost(secSource, linkAnalysis);
            expect(result.status).toBe(VerificationStatus.OFFICIAL_SOCIAL_ONLY);
            expect(result.isPrimarySourceLinked).toBe(false);
            expect(result.isEnactedPolicy).toBe(false);
        });

        it('should classify public official posts as ATTRIBUTED_STATEMENT and never enacted policy', () => {
            const trumpSource: XSource = {
                handle: 'realDonaldTrump',
                displayName: 'Donald Trump',
                enabled: true,
                sourceType: XSourceType.PUBLIC_OFFICIAL,
                credibilityScore: 90,
                priority: 'P0',
                pollingInterval: 60,
                categories: ['GOVERNMENT', 'MACRO'],
                watchTopics: ['crypto', 'tariff'],
                requiresConfirmation: false,
                rsshubRoute: '/twitter/user/realDonaldTrump',
            };

            const linkAnalysis = {
                linkedUrls: [],
                linkedDomains: [],
                hasPrimarySourceLink: false,
            };

            const result = verifier.verifyPost(trumpSource, linkAnalysis);
            expect(result.status).toBe(VerificationStatus.ATTRIBUTED_STATEMENT);
            expect(result.isEnactedPolicy).toBe(false);
            expect(result.speaker).toBe('Donald Trump');
            expect(result.role).toBe('PRESIDENT');
        });
    });

    describe('Event Classification and Impact Scoring', () => {
        it('should detect BROKER_LISTING for Robinhood meme listing with high impact', () => {
            const robinhoodSource: XSource = {
                handle: 'RobinhoodApp',
                displayName: 'Robinhood',
                enabled: true,
                sourceType: XSourceType.BROKER,
                credibilityScore: 95,
                priority: 'P0',
                pollingInterval: 60,
                categories: ['CRYPTO', 'MEMECOIN'],
                watchTopics: ['listing', 'meme'],
                requiresConfirmation: false,
                officialDomain: 'robinhood.com',
                rsshubRoute: '/twitter/user/RobinhoodApp',
            };

            const text = "We've added PEPE ($PEPE) to Robinhood. Trading begins now.";
            const event = detector.detectEvent(text, robinhoodSource, ['PEPE']);

            expect(event.eventType).toBe(XEventType.BROKER_LISTING);
            expect(event.impactScore).toBe(90);
            expect(event.primarySymbol).toBe('PEPE');
        });

        it('should detect EXCHANGE_LISTING for Coinbase Markets with impact 92', () => {
            const coinbaseSource: XSource = {
                handle: 'CoinbaseMarkets',
                displayName: 'Coinbase Markets',
                enabled: true,
                sourceType: XSourceType.EXCHANGE,
                credibilityScore: 95,
                priority: 'P0',
                pollingInterval: 60,
                categories: ['CRYPTO'],
                watchTopics: ['listing'],
                requiresConfirmation: false,
                officialDomain: 'coinbase.com',
                rsshubRoute: '/twitter/user/CoinbaseMarkets',
            };

            const text = 'Assets added to the roadmap: PEPE. Spot listing will commence today.';
            const event = detector.detectEvent(text, coinbaseSource, ['PEPE']);

            expect(event.eventType).toBe(XEventType.EXCHANGE_LISTING);
            expect(event.impactScore).toBe(92);
            expect(event.primarySymbol).toBe('PEPE');
        });

        it('should detect CENTRAL_BANK_DECISION for Federal Reserve with impact 98', () => {
            const fedSource: XSource = {
                handle: 'federalreserve',
                displayName: 'Federal Reserve',
                enabled: true,
                sourceType: XSourceType.CENTRAL_BANK,
                credibilityScore: 100,
                priority: 'P0',
                pollingInterval: 60,
                categories: ['MACRO'],
                watchTopics: ['interest rate', 'FOMC'],
                requiresConfirmation: true,
                officialDomain: 'federalreserve.gov',
                rsshubRoute: '/twitter/user/federalreserve',
            };

            const text = 'FOMC Statement: The Federal Reserve lowered the target range for the federal funds rate by 25 basis points.';
            const event = detector.detectEvent(text, fedSource);

            expect(event.eventType).toBe(XEventType.CENTRAL_BANK_DECISION);
            expect(event.impactScore).toBe(98);
        });

        it('should detect NETWORK_INCIDENT for Layer 1 project outages', () => {
            const solanaSource: XSource = {
                handle: 'solana',
                displayName: 'Solana',
                enabled: true,
                sourceType: XSourceType.CRYPTO_PROJECT,
                credibilityScore: 92,
                priority: 'P1',
                pollingInterval: 120,
                categories: ['CRYPTO', 'INFRASTRUCTURE'],
                watchTopics: ['network upgrade', 'outage'],
                requiresConfirmation: false,
                officialDomain: 'solana.com',
                rsshubRoute: '/twitter/user/solana',
            };

            const text = 'Mainnet Beta outage detected. Validator operators are preparing cluster restart instructions.';
            const event = detector.detectEvent(text, solanaSource, ['SOL']);

            expect(event.eventType).toBe(XEventType.NETWORK_INCIDENT);
            expect(event.impactScore).toBe(90);
        });

        it('should assign low impact score for community / influencer mentions', () => {
            const communitySource: XSource = {
                handle: 'random_influencer',
                displayName: 'Crypto Moon',
                enabled: true,
                sourceType: XSourceType.COMMUNITY,
                credibilityScore: 40,
                priority: 'P3',
                pollingInterval: 300,
                categories: ['MEMECOIN'],
                watchTopics: ['meme'],
                requiresConfirmation: false,
                rsshubRoute: '/twitter/user/random_influencer',
            };

            const text = 'Buy PEPE now before it goes 100x!';
            const event = detector.detectEvent(text, communitySource, ['PEPE']);

            expect(event.eventType).toBe(XEventType.MEME_MENTION);
            expect(event.impactScore).toBe(25);
        });
    });
});
