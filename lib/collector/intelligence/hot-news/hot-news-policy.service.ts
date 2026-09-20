import { VerificationStatus } from '../../types';
import { type MarketEvent, MarketEventType } from '../../notifications/types';
import type { AiNewsAnalysis } from '../types';

export interface HotNewsPolicyConfig {
    enabled: boolean;
    minCredibility: number;
    minImpactScore: number;
    minConfidence: number;
}

export class HotNewsPolicyService {
    private config: HotNewsPolicyConfig;

    constructor(config?: Partial<HotNewsPolicyConfig>) {
        this.config = {
            enabled: config?.enabled ?? (process.env.AI_HOT_NEWS_ENABLED !== 'false'),
            minCredibility: config?.minCredibility ?? Number.parseInt(process.env.AI_HOT_NEWS_MIN_CREDIBILITY || '90', 10),
            minImpactScore: config?.minImpactScore ?? Number.parseInt(process.env.AI_HOT_NEWS_MIN_IMPACT_SCORE || '90', 10),
            minConfidence: config?.minConfidence ?? Number.parseFloat(process.env.AI_HOT_NEWS_MIN_CONFIDENCE || '0.90'),
        };
    }

    /**
     * Determines whether an event qualifies for an immediate Realtime Hot Alert.
     * The backend policy holds final authority over AI recommendation.
     */
    shouldPushHotNews(event: MarketEvent, analysis: AiNewsAnalysis): boolean {
        if (!this.config.enabled) {
            return false;
        }

        // 1. AI recommendation must be positive
        if (!analysis.isHotNews) {
            return false;
        }

        // 2. High AI confidence
        if (analysis.aiConfidence < this.config.minConfidence) {
            return false;
        }

        // 3. High Deterministic Credibility Score
        const credScore = event.source.credibilityScore ?? 0;
        if (credScore < this.config.minCredibility) {
            return false;
        }

        // 4. High Impact Score
        if (event.impactScore < this.config.minImpactScore) {
            return false;
        }

        // 5. Verification Status Gate
        if (!this.isAllowedVerificationStatus(event)) {
            return false;
        }

        // 6. Must belong to priority high-impact event types
        if (!this.isPriorityEventType(event)) {
            return false;
        }

        return true;
    }

    /**
     * Checks if verification status meets strict hot news criteria:
     * - Primary source
     * - Multi-source confirmation
     * - Attributed statement from recognized authority
     */
    isAllowedVerificationStatus(event: MarketEvent): boolean {
        const status = event.verificationStatus;

        if (status === VerificationStatus.CONFIRMED_PRIMARY_SOURCE) {
            return true;
        }

        if (status === VerificationStatus.CONFIRMED_MULTI_SOURCE) {
            return true;
        }

        // Allow official social only for top tier authorities (Central Bank, Fed, SEC, White House)
        if (status === VerificationStatus.OFFICIAL_SOCIAL_ONLY) {
            const src = (event.source.name || '').toLowerCase();
            return (
                src.includes('federal reserve') ||
                src.includes('sec') ||
                src.includes('treasury') ||
                src.includes('white house') ||
                src.includes('cftc')
            );
        }

        // Attributed statement is allowed only if critical impact
        if (status === VerificationStatus.ATTRIBUTED_STATEMENT) {
            return event.impactScore >= 95;
        }

        return false;
    }

    /**
     * Filters event types that warrant immediate interruption
     */
    isPriorityEventType(event: MarketEvent): boolean {
        switch (event.eventType) {
            case MarketEventType.CENTRAL_BANK_DECISION:
            case MarketEventType.ETF:
            case MarketEventType.REGULATION:
            case MarketEventType.GOVERNMENT_POLICY:
            case MarketEventType.EXCHANGE_LISTING:
            case MarketEventType.EXCHANGE_DELISTING:
            case MarketEventType.SECURITY_INCIDENT:
            case MarketEventType.NETWORK_INCIDENT: {
                return true;
            }
            case MarketEventType.MEME_TREND: {
                // Meme trends only alert immediately if extraordinary trend score >= 95
                return (event.trendScore ?? 0) >= 95;
            }
            default: {
                return event.impactScore >= 95;
            }
        }
    }
}
