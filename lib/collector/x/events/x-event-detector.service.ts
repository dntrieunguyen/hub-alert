import { VerificationStatus, XEventType, XSourceType } from '../../types';
import type { XSource } from '../types';

export interface DetectedXEvent {
    eventType: XEventType;
    impactScore: number;
    detectedKeywords: string[];
    primarySymbol?: string;
    reason: string;
}

export class XEventDetectorService {
    /**
     * Classifies an X post into a specific XEventType and calculates informational impact score
     */
    public detectEvent(
        text: string,
        source: XSource,
        tokens: string[] = [],
        verificationStatus: VerificationStatus = VerificationStatus.UNVERIFIED,
    ): DetectedXEvent {
        const textLower = text.toLowerCase();
        const primarySymbol = tokens.length > 0 ? tokens[0] : undefined;
        const detectedKeywords: string[] = [];

        // 1. Check Public Official Statement first
        if (source.sourceType === XSourceType.PUBLIC_OFFICIAL) {
            const keywords = ['crypto', 'bitcoin', 'tariff', 'china', 'regulation', 'tax', 'executive order', 'fed', 'dollar'];
            for (const kw of keywords) {
                if (textLower.includes(kw)) {
                    detectedKeywords.push(kw);
                }
            }
            return {
                eventType: XEventType.PUBLIC_OFFICIAL_STATEMENT,
                impactScore: detectedKeywords.length > 0 ? 85 : 70,
                detectedKeywords,
                primarySymbol,
                reason: `Statement made by public official @${source.handle}`,
            };
        }

        // 2. Central Bank Decisions
        if (source.sourceType === XSourceType.CENTRAL_BANK) {
            const rateKws = ['interest rate', 'rate cut', 'rate hike', 'fomc', 'monetary policy', 'balance sheet', 'qt', 'qe', 'inflation'];
            for (const kw of rateKws) {
                if (textLower.includes(kw)) {
                    detectedKeywords.push(kw);
                }
            }
            return {
                eventType: XEventType.CENTRAL_BANK_DECISION,
                impactScore: 98,
                detectedKeywords,
                primarySymbol,
                reason: `Central bank policy announcement from ${source.displayName}`,
            };
        }

        // 3. Macro Economic Data (BLS, Treasury, etc.)
        if (source.handle.toLowerCase() === 'bls_gov' || textLower.includes('cpi') || textLower.includes('ppi') || textLower.includes('nfp') || textLower.includes('unemployment')) {
            const macroKws = ['cpi', 'ppi', 'jobs', 'nfp', 'unemployment', 'wages', 'inflation'];
            for (const kw of macroKws) {
                if (textLower.includes(kw)) {
                    detectedKeywords.push(kw);
                }
            }
            if (detectedKeywords.length > 0) {
                return {
                    eventType: XEventType.MACRO_DATA,
                    impactScore: 95,
                    detectedKeywords,
                    primarySymbol,
                    reason: `Macro economic report released`,
                };
            }
        }

        // 4. ETF Approvals / Filings / Rejections
        if (textLower.includes('etf')) {
            const etfKws = ['etf', 'approved', 'approval', 'rejected', 'rejection', 'filing', 's-1', '19b-4'];
            for (const kw of etfKws) {
                if (textLower.includes(kw)) {
                    detectedKeywords.push(kw);
                }
            }
            const isRegulator = source.sourceType === XSourceType.GOVERNMENT_AGENCY;
            return {
                eventType: XEventType.ETF,
                impactScore: isRegulator ? 95 : 85,
                detectedKeywords,
                primarySymbol,
                reason: `ETF-related announcement`,
            };
        }

        // 5. Sanctions & Government Policies
        if (source.sourceType === XSourceType.GOVERNMENT_AGENCY || source.sourceType === XSourceType.GOVERNMENT_INSTITUTION) {
            const sanctionKws = ['sanction', 'ofac', 'enforcement', 'fraud', 'indictment', 'charges'];
            for (const kw of sanctionKws) {
                if (textLower.includes(kw)) {
                    detectedKeywords.push(kw);
                }
            }
            if (detectedKeywords.length > 0) {
                return {
                    eventType: XEventType.SANCTIONS,
                    impactScore: 92,
                    detectedKeywords,
                    primarySymbol,
                    reason: `Government enforcement / sanction announcement`,
                };
            }

            return {
                eventType: XEventType.GOVERNMENT_POLICY,
                impactScore: 90,
                detectedKeywords: ['government', 'agency'],
                primarySymbol,
                reason: `Official government agency publication`,
            };
        }

        // 6. Exchange & Broker Listings / Delistings
        const listingKws = ['listing', 'listed', 'now available', 'trading begins', 'added', 'support for', 'spot listing', 'futures listing'];
        const delistingKws = ['delisting', 'delist', 'remove pair', 'cease trading'];

        for (const kw of delistingKws) {
            if (textLower.includes(kw)) {
                detectedKeywords.push(kw);
            }
        }
        if (detectedKeywords.length > 0 && (source.sourceType === XSourceType.EXCHANGE || source.sourceType === XSourceType.BROKER)) {
            return {
                eventType: XEventType.EXCHANGE_DELISTING,
                impactScore: 88,
                detectedKeywords,
                primarySymbol,
                reason: `Token delisting on ${source.displayName}`,
            };
        }

        for (const kw of listingKws) {
            if (textLower.includes(kw)) {
                detectedKeywords.push(kw);
            }
        }

        if (detectedKeywords.length > 0) {
            if (source.sourceType === XSourceType.BROKER) {
                // High impact broker listing (e.g. Robinhood adding PEPE)
                return {
                    eventType: XEventType.BROKER_LISTING,
                    impactScore: 90,
                    detectedKeywords,
                    primarySymbol,
                    reason: `Broker asset listing on ${source.displayName}`,
                };
            }

            if (source.sourceType === XSourceType.EXCHANGE) {
                const isCoinbaseOrBinance = source.handle.toLowerCase().includes('coinbase') || source.handle.toLowerCase() === 'binance';
                return {
                    eventType: XEventType.EXCHANGE_LISTING,
                    impactScore: isCoinbaseOrBinance ? 92 : 88,
                    detectedKeywords,
                    primarySymbol,
                    reason: `Exchange listing on ${source.displayName}`,
                };
            }
        }

        // 7. Network / Infrastructure Outage or Incident
        if (source.sourceType === XSourceType.CRYPTO_PROJECT) {
            const incidentKws = ['outage', 'downtime', 'degraded', 'incident', 'restarting', 'cluster halted', 'exploit', 'hack'];
            for (const kw of incidentKws) {
                if (textLower.includes(kw)) {
                    detectedKeywords.push(kw);
                }
            }
            if (detectedKeywords.length > 0) {
                return {
                    eventType: XEventType.NETWORK_INCIDENT,
                    impactScore: 90,
                    detectedKeywords,
                    primarySymbol: primarySymbol || source.handle.toUpperCase(),
                    reason: `Network incident reported by ${source.displayName}`,
                };
            }

            return {
                eventType: XEventType.PROJECT_ANNOUNCEMENT,
                impactScore: 75,
                detectedKeywords: ['announcement', 'protocol'],
                primarySymbol,
                reason: `Official protocol update from ${source.displayName}`,
            };
        }

        // 8. Meme or Social Mention fallback
        if (primarySymbol) {
            const isMemeCategory = source.categories.includes('MEMECOIN');
            return {
                eventType: isMemeCategory ? XEventType.MEME_MENTION : XEventType.SOCIAL_MENTION,
                impactScore: source.credibilityScore > 70 ? 40 : 25,
                detectedKeywords,
                primarySymbol,
                reason: `Token mention on social feed`,
            };
        }

        return {
            eventType: XEventType.SOCIAL_MENTION,
            impactScore: Math.min(30, Math.floor(source.credibilityScore * 0.3)),
            detectedKeywords,
            primarySymbol,
            reason: `General social feed update`,
        };
    }
}
