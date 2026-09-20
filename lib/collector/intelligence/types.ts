export type AiNewsCategory =
    | 'MACRO'
    | 'REGULATION'
    | 'ETF'
    | 'EXCHANGE'
    | 'SECURITY'
    | 'CRYPTO_MARKET'
    | 'MEME'
    | 'PROJECT'
    | 'OTHER';

export interface AiNewsAnalysis {
    eventId: string;
    isValuable: boolean;
    isNewInformation: boolean;
    category: AiNewsCategory;
    informationValueScore: number; // 0 -> 100
    marketRelevanceScore: number; // 0 -> 100
    aiConfidence: number; // 0 -> 1
    isHotNews: boolean;
    titleVi: string;
    summaryVi: string;
    whyItMattersVi: string;
    affectedAssets: string[];
    affectedNarratives: string[];
    keyFacts: string[];
    risks: string[];
    uncertainty?: string;
    duplicateOfEventId?: string | null;
}

export interface AiInputEvent {
    eventId: string;
    title: string;
    summary?: string;
    content?: string;
    eventType: string;
    source: {
        name: string;
        tier: string;
        credibilityScore: number;
    };
    verificationStatus: string;
    impactScore: number;
    trendScore?: number;
    publishedAt: string;
    assets: string[];
    topics: string[];
    sourceUrl: string;
}

export interface AiAnalyzerConfig {
    enabled: boolean;
    provider: string;
    apiKey?: string;
    model: string;
    language: string;
    maxCandidates: number;
    maxDigestItems: number;
    minCredibility: number;
    minImpactScore: number;
    hotNewsEnabled: boolean;
    hotNewsMinCredibility: number;
    hotNewsMinImpactScore: number;
    hotNewsMinConfidence: number;
    timeoutMs?: number;
    maxRetries?: number;
}

export interface AiAnalysisCacheRecord {
    eventId: string;
    inputHash: string;
    analysis: AiNewsAnalysis;
    analyzedAt: Date;
    provider: string;
    model: string;
    version: number;
}
