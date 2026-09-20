import { EventPriority, type MarketEvent, MarketEventType, VerificationStatus } from '../types';

export interface NotificationPolicyOptions {
    minImpactScore?: number;
    memeMinTrendScore?: number;
    memeMinVelocity?: number;
    memeMinUniqueSources?: number;
}

export class NotificationPolicyService {
    private minImpactScore: number;
    private memeMinTrendScore: number;
    private memeMinVelocity: number;
    private memeMinUniqueSources: number;

    constructor(options: NotificationPolicyOptions = {}) {
        this.minImpactScore = options.minImpactScore ?? 80;
        this.memeMinTrendScore = options.memeMinTrendScore ?? 85;
        this.memeMinVelocity = options.memeMinVelocity ?? 10;
        this.memeMinUniqueSources = options.memeMinUniqueSources ?? 5;
    }

    /**
     * Determines whether a MarketEvent satisfies alert criteria for Google Chat dispatch.
     */
    shouldNotify(event: MarketEvent): boolean {
        // Unverified events are never alerted unless exceptional P0 (>= 95)
        if (event.verificationStatus === VerificationStatus.UNVERIFIED && event.impactScore < 95) {
            return false;
        }

        // Special handling for Meme alerts
        if (event.eventType === MarketEventType.MEME_TREND || event.category === 'MEMECOIN') {
            return this.evaluateMemeAlert(event);
        }

        // Rule 1: Immediate alert for P0 priority events
        if (event.priority === EventPriority.P0) {
            return true;
        }

        // Rule 2: Critical event types with verified source
        const criticalEventTypes = [
            MarketEventType.CENTRAL_BANK_DECISION,
            MarketEventType.MACRO_DATA,
            MarketEventType.ETF,
            MarketEventType.REGULATION,
            MarketEventType.GOVERNMENT_POLICY,
            MarketEventType.EXCHANGE_LISTING,
            MarketEventType.EXCHANGE_DELISTING,
            MarketEventType.BROKER_LISTING,
            MarketEventType.SECURITY_INCIDENT,
            MarketEventType.NETWORK_INCIDENT,
        ];

        if (criticalEventTypes.includes(event.eventType)) {
            const hasVerifiedSource = [VerificationStatus.CONFIRMED_PRIMARY_SOURCE, VerificationStatus.CONFIRMED_MULTI_SOURCE, VerificationStatus.ATTRIBUTED_STATEMENT].includes(event.verificationStatus);
            if (hasVerifiedSource && event.impactScore >= Math.min(this.minImpactScore, 75)) {
                return true;
            }
        }

        // Rule 3: High impact events meeting minimum threshold
        const isImpactEligible = event.impactScore >= this.minImpactScore;
        const isVerified = [VerificationStatus.CONFIRMED_PRIMARY_SOURCE, VerificationStatus.CONFIRMED_MULTI_SOURCE, VerificationStatus.ATTRIBUTED_STATEMENT].includes(event.verificationStatus);

        return isImpactEligible && isVerified;
    }

    /**
     * Evaluates meme alert criteria:
     * - trendScore >= 85
     * - OR (velocity >= threshold && uniqueSources >= threshold)
     * - OR official exchange/broker mentions token
     */
    private evaluateMemeAlert(event: MarketEvent): boolean {
        // Condition A: Official exchange/broker mentions token (e.g. Coinbase announces PEPE support, Robinhood lists PEPE)
        const isOfficialSource = event.source.tier === 'OFFICIAL';
        const isListing = event.eventType === MarketEventType.EXCHANGE_LISTING || event.eventType === MarketEventType.BROKER_LISTING;
        if (isOfficialSource || isListing || (event.officialSources && event.officialSources.length > 0)) {
            return true;
        }

        // Condition B: High trend score
        if (event.trendScore !== undefined && event.trendScore >= this.memeMinTrendScore) {
            return true;
        }

        // Condition C: High velocity AND multiple unique sources
        if (event.memeMetrics) {
            const { velocity = 0, uniqueSources = 0 } = event.memeMetrics;
            if (velocity >= this.memeMinVelocity && uniqueSources >= this.memeMinUniqueSources) {
                return true;
            }
        }

        // Routine social mention -> REJECT
        return false;
    }

    setMinImpactScore(score: number): void {
        this.minImpactScore = score;
    }

    getMinImpactScore(): number {
        return this.minImpactScore;
    }
}
