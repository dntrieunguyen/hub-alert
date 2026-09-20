import { type CryptoFeedItem, SourceTier } from '../types';

export interface ImpactKeywordWeight {
    keyword: string;
    weight: number;
}

export const DEFAULT_IMPACT_KEYWORDS: ImpactKeywordWeight[] = [
    // Extreme market movers (30-40)
    { keyword: 'insolvency', weight: 40 },
    { keyword: 'bankrupt', weight: 40 },
    { keyword: 'rate cut', weight: 35 },
    { keyword: 'rate hike', weight: 35 },
    { keyword: 'interest rate', weight: 30 },
    { keyword: 'fomc', weight: 30 },
    { keyword: 'federal reserve', weight: 30 },
    { keyword: 'cpi', weight: 30 },
    { keyword: 'inflation', weight: 25 },
    { keyword: 'jobs report', weight: 25 },
    { keyword: 'non-farm payroll', weight: 30 },
    { keyword: 'etf approval', weight: 35 },
    { keyword: 'etf approved', weight: 35 },
    { keyword: 'etf rejected', weight: 35 },
    { keyword: 'hack', weight: 30 },
    { keyword: 'exploit', weight: 25 },
    { keyword: 'stolen', weight: 25 },
    { keyword: 'sec lawsuit', weight: 30 },
    { keyword: 'sanctions', weight: 25 },
    { keyword: 'war', weight: 25 },
    { keyword: 'liquidity crisis', weight: 35 },
    { keyword: 'delist', weight: 25 },
];

export class MarketImpactScoreService {
    private keywordWeights: ImpactKeywordWeight[];

    constructor(customKeywords?: ImpactKeywordWeight[]) {
        this.keywordWeights = customKeywords ?? DEFAULT_IMPACT_KEYWORDS;
    }

    calculateImpactScore(item: Partial<CryptoFeedItem>): number {
        let score = 0;
        const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();

        // 1. Keyword impact (up to 50 points)
        let keywordScore = 0;
        for (const { keyword, weight } of this.keywordWeights) {
            if (text.includes(keyword.toLowerCase())) {
                keywordScore = Math.max(keywordScore, weight);
            }
        }
        score += keywordScore;

        // 2. Source Tier weight (up to 30 points)
        if (item.sourceTier === SourceTier.OFFICIAL) {
            score += 30;
        } else if (item.sourceTier === SourceTier.RESEARCH) {
            score += 20;
        } else if (item.sourceTier === SourceTier.NEWS) {
            score += 15;
        } else {
            score += 5;
        }

        // 3. Topic weight (up to 20 points)
        const criticalTopics = ['FED', 'INFLATION', 'ETF', 'HACK_EXPLOIT', 'REGULATION', 'DELISTING', 'LIQUIDITY'];
        const hasCriticalTopic = (item.topics || []).some((t) => criticalTopics.includes(t));
        if (hasCriticalTopic) {
            score += 20;
        }

        // Clamp between 0 and 100
        return Math.min(100, Math.max(0, Math.round(score)));
    }
}
