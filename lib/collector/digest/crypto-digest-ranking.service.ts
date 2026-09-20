import { SourceTier, VerificationStatus } from '../types';
import { MarketEventType } from '../notifications/types';
import type { AggregatedMarketEvent, DigestRankingBreakdown, DigestRankingWeights } from './types';

export class CryptoDigestRankingService {
    private defaultWeights: DigestRankingWeights = {
        credibility: 0.15,
        impact: 0.25,
        verification: 0.15,
        recency: 0.05,
        crossSource: 0.05,
        marketRelevance: 0.15,
        aiInformationValue: 0.20,
        aiMarketRelevance: 0.15,
    };

    /**
     * Calculates the comprehensive digestRankingScore (0 - 100) and stores breakdown
     */
    calculateRankingScore(
        event: AggregatedMarketEvent,
        lookbackHours = 6,
        weights: DigestRankingWeights = this.defaultWeights
    ): DigestRankingBreakdown {
        const credibilityScore = this.calculateCredibilityScore(event);
        const informationImpact = Math.min(100, Math.max(0, event.impactScore));
        const verificationScore = this.calculateVerificationScore(event);
        const recencyScore = this.calculateRecencyScore(event.publishedAt, lookbackHours);
        const crossSourceScore = this.calculateCrossSourceScore(event);
        const marketRelevance = this.calculateMarketRelevanceScore(event);

        const aiInformationValue = event.aiAnalysis?.informationValueScore;
        const aiMarketRelevance = event.aiAnalysis?.marketRelevanceScore;
        const hasAi =
            aiInformationValue !== undefined &&
            aiMarketRelevance !== undefined &&
            (weights.aiInformationValue ?? 0) > 0;

        let rawScore: number;
        let weightSum: number;

        if (hasAi) {
            const wAiInfo = weights.aiInformationValue ?? 0.20;
            const wAiRel = weights.aiMarketRelevance ?? 0.15;

            weightSum =
                weights.credibility +
                weights.impact +
                weights.verification +
                weights.recency +
                weights.crossSource +
                wAiInfo +
                wAiRel || 1;

            rawScore =
                credibilityScore * weights.credibility +
                informationImpact * weights.impact +
                verificationScore * weights.verification +
                recencyScore * weights.recency +
                crossSourceScore * weights.crossSource +
                aiInformationValue * wAiInfo +
                aiMarketRelevance * wAiRel;
        } else {
            const wRelevance = weights.marketRelevance ?? 0.15;
            weightSum =
                weights.credibility +
                weights.impact +
                weights.verification +
                weights.recency +
                weights.crossSource +
                wRelevance || 1;

            rawScore =
                credibilityScore * weights.credibility +
                informationImpact * weights.impact +
                verificationScore * weights.verification +
                recencyScore * weights.recency +
                crossSourceScore * weights.crossSource +
                marketRelevance * wRelevance;
        }

        const totalRankingScore = Math.min(100, Math.max(0, Math.round((rawScore / weightSum) * 10) / 10));

        return {
            credibilityScore,
            informationImpact,
            verificationScore,
            recencyScore,
            crossSourceScore,
            marketRelevance,
            aiInformationValue,
            aiMarketRelevance,
            totalRankingScore,
        };
    }

    /**
     * Source Credibility scoring based on Section 5
     */
    calculateCredibilityScore(event: AggregatedMarketEvent): number {
        // Take the maximum credibility among all confirming sources
        if (event.sources && event.sources.length > 0) {
            const maxCred = Math.max(...event.sources.map((s) => this.scoreSingleSourceCredibility(s.name, s.tier, s.credibilityScore)));
            return maxCred;
        }
        return this.scoreSingleSourceCredibility(event.primaryEvent.source.name, event.primaryEvent.source.tier, event.primaryEvent.source.credibilityScore);
    }

    private scoreSingleSourceCredibility(sourceName: string, tier: SourceTier, defaultScore: number): number {
        const name = (sourceName || '').toLowerCase();

        // 1. Government / Central Bank / Regulator Tier (100)
        if (
            name.includes('federal reserve') ||
            name.includes('sec') ||
            name.includes('treasury') ||
            name.includes('white house') ||
            name.includes('cftc') ||
            name.includes('ecb') ||
            name.includes('bank of england')
        ) {
            return 100;
        }

        // 2. Top Tier Exchange / Top Broker (95)
        if (
            name.includes('coinbase') ||
            name.includes('binance') ||
            name.includes('robinhood') ||
            name.includes('okx') ||
            name.includes('bybit') ||
            name.includes('kraken')
        ) {
            return 95;
        }

        // 3. Top Tier Global News (95)
        if (name.includes('reuters') || name.includes('bloomberg')) {
            return 95;
        }

        // 4. Crypto Native Tier 1 Media (85)
        if (name.includes('coindesk') || name.includes('the block') || name.includes('blockworks')) {
            return 85;
        }

        // 5. Crypto Native Tier 2 Media (80)
        if (name.includes('decrypt') || name.includes('cointelegraph')) {
            return 80;
        }

        // 6. Known Analyst / Research (60 - 75)
        if (tier === SourceTier.RESEARCH) {
            return Math.max(75, defaultScore);
        }

        if (tier === SourceTier.OFFICIAL) {
            return Math.max(90, defaultScore);
        }

        if (tier === SourceTier.NEWS) {
            return Math.max(75, defaultScore);
        }

        if (tier === SourceTier.COMMUNITY || tier === SourceTier.SOCIAL) {
            return Math.min(50, Math.max(20, defaultScore));
        }

        return Math.min(100, Math.max(20, defaultScore));
    }

    /**
     * Verification Weight scoring based on Section 6
     */
    calculateVerificationScore(event: AggregatedMarketEvent): number {
        switch (event.verificationStatus) {
            case VerificationStatus.CONFIRMED_PRIMARY_SOURCE: {
                return 100;
            }
            case VerificationStatus.CONFIRMED_MULTI_SOURCE: {
                return 95;
            }
            case VerificationStatus.ATTRIBUTED_STATEMENT: {
                return 85;
            }
            case VerificationStatus.OFFICIAL_SOCIAL_ONLY: {
                return 75;
            }
            case VerificationStatus.UNVERIFIED: {
                return 30;
            }
            case VerificationStatus.DISPUTED: {
                return 0;
            }
            default: {
                return 40;
            }
        }
    }

    /**
     * Recency Score (100 down to 40 across the lookback window)
     */
    calculateRecencyScore(publishedAt: Date, lookbackHours: number): number {
        const now = Date.now();
        const ageMs = Math.max(0, now - publishedAt.getTime());
        const ageHours = ageMs / (1000 * 60 * 60);

        if (ageHours <= 0.5) {
            return 100;
        }
        if (ageHours >= lookbackHours) {
            return 40;
        }

        // Smooth linear decay from 100 to 40
        const factor = ageHours / lookbackHours;
        return Math.round(100 - factor * 60);
    }

    /**
     * Cross-source Confirmation Score based on Section 7
     * Prioritize official + trusted news > 10 community reposts
     */
    calculateCrossSourceScore(event: AggregatedMarketEvent): number {
        const official = event.officialSourceCount || 0;
        const news = event.newsSourceCount || 0;
        const social = event.socialSourceCount || 0;

        if (event.sourceCount <= 1) {
            if (official > 0) {
                return 80;
            }
            if (news > 0) {
                return 65;
            }
            return 40;
        }

        // Official counts heavily, trusted news moderately, social adds minor boost
        const score = 50 + official * 25 + news * 15 + Math.min(social, 2) * 5;
        return Math.min(100, score);
    }

    /**
     * Market Relevance based on Section 10
     */
    calculateMarketRelevanceScore(event: AggregatedMarketEvent): number {
        let score = 70;

        switch (event.eventType) {
            case MarketEventType.CENTRAL_BANK_DECISION:
            case MarketEventType.MACRO_DATA:
            case MarketEventType.GOVERNMENT_POLICY:
            case MarketEventType.REGULATION:
            case MarketEventType.ETF: {
                score = 100;
                break;
            }
            case MarketEventType.EXCHANGE_LISTING:
            case MarketEventType.BROKER_LISTING:
            case MarketEventType.SECURITY_INCIDENT:
            case MarketEventType.NETWORK_INCIDENT:
            case MarketEventType.EXCHANGE_DELISTING: {
                score = 95;
                break;
            }
            case MarketEventType.MEME_TREND: {
                score = event.trendScore && event.trendScore >= 90 ? 85 : 75;
                break;
            }
            default: {
                score = 70;
            }
        }

        // Major asset bonus (BTC, ETH, SOL)
        const upperTokens = event.tokens.map((t) => t.toUpperCase());
        if (upperTokens.includes('BTC') || upperTokens.includes('ETH') || upperTokens.includes('SOL')) {
            score = Math.min(100, score + 5);
        }

        return score;
    }
}
