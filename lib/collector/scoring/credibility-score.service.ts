import { type FeedSource, SourceTier } from '../types';

export interface CredibilityConfig {
    tierBaselines: Record<SourceTier, { min: number; max: number }>;
}

export const DEFAULT_CREDIBILITY_CONFIG: CredibilityConfig = {
    tierBaselines: {
        [SourceTier.OFFICIAL]: { min: 95, max: 100 },
        [SourceTier.RESEARCH]: { min: 85, max: 95 },
        [SourceTier.NEWS]: { min: 75, max: 90 },
        [SourceTier.SOCIAL]: { min: 40, max: 80 },
        [SourceTier.COMMUNITY]: { min: 20, max: 60 },
    },
};

export class CredibilityScoreService {
    private config: CredibilityConfig;

    constructor(config?: CredibilityConfig) {
        this.config = config ?? DEFAULT_CREDIBILITY_CONFIG;
    }

    calculateScore(source: FeedSource): number {
        // If source has custom credibilityScore within valid tier range, use it
        const baseline = this.config.tierBaselines[source.sourceTier];
        if (!baseline) {
            return 50;
        }

        if (source.credibilityScore >= baseline.min && source.credibilityScore <= baseline.max) {
            return source.credibilityScore;
        }

        // Clamp to baseline
        return Math.max(baseline.min, Math.min(baseline.max, source.credibilityScore || baseline.min));
    }
}
