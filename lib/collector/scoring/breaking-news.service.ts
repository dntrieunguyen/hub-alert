import { type CryptoFeedItem, SourceTier } from '../types';

export class BreakingNewsService {
    private maxRecentAgeMs: number;
    private crossConfirmWindowMs: number;

    constructor(maxRecentAgeMinutes = 120, crossConfirmMinutes = 15) {
        this.maxRecentAgeMs = maxRecentAgeMinutes * 60 * 1000;
        this.crossConfirmWindowMs = crossConfirmMinutes * 60 * 1000;
    }

    /**
     * Evaluates if a feed item is breaking news
     */
    evaluateBreaking(item: CryptoFeedItem, recentItems: CryptoFeedItem[] = []): boolean {
        const itemAgeMs = Date.now() - item.publishedAt.getTime();

        // 1. Direct breaking from Official high-credibility sources for major events
        if (item.sourceTier === SourceTier.OFFICIAL && item.credibilityScore >= 95 && itemAgeMs <= this.maxRecentAgeMs) {
            const hasHighImpactTopic = item.topics.some((t) => ['LISTING', 'DELISTING', 'HACK_EXPLOIT', 'ETF', 'FED', 'REGULATION', 'MAINNET'].includes(t));
            if (hasHighImpactTopic || item.impactScore >= 70) {
                return true;
            }
        }

        // 2. High market impact score (> 80) from Tier 1 / Tier 2 sources published recently
        if (item.impactScore >= 80 && item.credibilityScore >= 80 && itemAgeMs <= this.maxRecentAgeMs) {
            return true;
        }

        // 3. Cross-source confirmation: same token/topics detected from 3+ distinct sources within 15 minutes
        if (recentItems.length > 0 && (item.tokens.length > 0 || item.topics.length > 0)) {
            const itemTime = item.publishedAt.getTime();
            const matchingSources = new Set<string>([item.sourceId]);

            for (const other of recentItems) {
                if (other.id === item.id || other.sourceId === item.sourceId) {
                    continue;
                }

                // Check time window
                const timeDiff = Math.abs(itemTime - other.publishedAt.getTime());
                if (timeDiff > this.crossConfirmWindowMs) {
                    continue;
                }

                // Check common tokens
                const commonTokens = item.tokens.filter((t) => other.tokens.includes(t));
                // Check common topics
                const commonTopics = item.topics.filter((t) => other.topics.includes(t));

                if (commonTokens.length > 0 && commonTopics.length > 0) {
                    matchingSources.add(other.sourceId);
                }
            }

            if (matchingSources.size >= 3) {
                return true;
            }
        }

        return false;
    }
}
