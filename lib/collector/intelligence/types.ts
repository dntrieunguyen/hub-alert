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
    includeInDigest?: boolean;
    rejectionReason?: string;
    isDuplicate?: boolean;
    duplicateOf?: string | null;
    isValuable: boolean;
    isNewInformation: boolean;
    category: AiNewsCategory;
    informationValueScore: number; // 0 -> 100
    marketRelevanceScore: number; // 0 -> 100
    marketImpactScore?: number; // 0 -> 100
    aiConfidence: number; // 0 -> 1
    confidence?: number;
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

export interface LatestNewsAnalysis {
    eventId: string;
    include: boolean;
    titleVi: string;
    summaryVi: string;
    analysisVi: string;
    whyItMattersVi: string;
    marketImpactVi: string;
    category: string;
    affectedAssets: string[];
    affectedNarratives: string[];
    informationValueScore: number;
    marketRelevanceScore: number;
    aiImpactScore: number;
    confidence: number;
    signalStrength: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
}

export interface LatestMarketOverview {
    title?: string;
    marketOverview: string;
    overallImpactScore: number;
    marketState: string;
    mainNarratives: string[];
    risks: string[];
    watchNext: string[];
}

export interface LatestMarketIntelligenceItem {
    id: string;
    title: string;
    summary: string;
    analysis: string;
    whyItMatters: string;
    marketImpact?: string;
    source: {
        id?: string;
        name: string;
        tier: string;
        credibilityScore: number;
    };
    marketRelevanceScore: number;
    impactScore: number;
    signalStrength: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
    affectedAssets: string[];
    affectedNarratives: string[];
    publishedAt: string;
    url: string;
    originalTitle?: string;
    originalSummary?: string;
    originalLanguage?: string;
}

export interface LatestMarketIntelligenceResponse {
    generatedAt: string;
    summary: LatestMarketOverview;
    items: LatestMarketIntelligenceItem[];
}

