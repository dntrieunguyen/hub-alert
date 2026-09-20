import type { FeedCategory, SourceTier, VerificationStatus } from '../types';
import type { MarketEvent, MarketEventType } from '../notifications/types';
import type { AiNewsAnalysis } from '../intelligence/types';

export interface DigestRankingWeights {
    credibility: number;
    impact: number;
    verification: number;
    recency: number;
    crossSource: number;
    marketRelevance: number;
    aiInformationValue?: number;
    aiMarketRelevance?: number;
}

export interface DigestConfig {
    enabled: boolean;
    intervalMinutes: number;
    lookbackHours: number;
    maxItems: number;
    minCredibility: number;
    minRankingScore: number;
    minImpactScore: number;
    minInformationValue: number;
    minMarketRelevance: number;
    candidateBatchSize: number;
    maxScanItems: number;
    criticalAlertEnabled: boolean;
    criticalAlertThreshold: number;
    timezone: string;
    morningCron?: string;
    noonCron?: string;
    eveningCron?: string;
    fallbackLookbackHours: number;
    aiEnabled: boolean;
    aiMaxCandidates: number;
    weights: DigestRankingWeights;
    diversity: {
        maxPerToken: number;
        maxPerSource: number;
        maxPerTopic: number;
        maxPerEvent: number;
    };
}

export interface AggregatedSourceInfo {
    id: string;
    name: string;
    tier: SourceTier;
    credibilityScore: number;
    url: string;
    publishedAt: Date;
}

export interface AggregatedMarketEvent {
    id: string;
    canonicalFingerprint: string;
    primaryEvent: MarketEvent;
    title: string;
    vietnameseTitle?: string;
    summary?: string;
    vietnameseSummary?: string;
    whyItMattersVi?: string;
    aiAnalysis?: AiNewsAnalysis;
    canonicalUrl: string;
    category: FeedCategory;
    eventType: MarketEventType;
    verificationStatus: VerificationStatus;
    tokens: string[];
    symbols: string[];
    chains: string[];
    topics: string[];
    impactScore: number;
    trendScore?: number;
    publishedAt: Date;
    createdAt: Date;
    sources: AggregatedSourceInfo[];
    sourceCount: number;
    officialSourceCount: number;
    newsSourceCount: number;
    socialSourceCount: number;
    wasCriticalAlerted?: boolean;
    rankingBreakdown?: DigestRankingBreakdown;
    digestRankingScore?: number;
}

export interface DigestRankingBreakdown {
    credibilityScore: number;
    informationImpact: number;
    verificationScore: number;
    recencyScore: number;
    crossSourceScore: number;
    marketRelevance: number;
    aiInformationValue?: number;
    aiMarketRelevance?: number;
    totalRankingScore: number;
}

export interface DigestTrendingToken {
    symbol: string;
    name?: string;
    trendScore: number;
    mentions1h?: number;
    mentionChangePercent?: number;
    topSources: string[];
}

export interface MarketSnapshotSection {
    btcContext?: string;
    ethContext?: string;
    solContext?: string;
    memeContext?: string;
    macroContext?: string;
}

export type MarketNarrativeStrength = 'HIGH' | 'MEDIUM' | 'LOW';

export interface MarketNarrative {
    titleVi: string;
    summaryVi: string;
    strength: MarketNarrativeStrength;
    supportingEventIds: string[];
}

export interface AssetAnalysisItem {
    asset: string;
    outlook: string;
    summaryVi: string;
    signalsVi: string[];
}

export interface IgnoredEventItem {
    eventId: string;
    reasonVi: string;
}

export interface MarketStateOutlook {
    overall: string;
    btc?: string;
    eth?: string;
    altcoin?: string;
    meme?: string;
}

export interface MarketIntelligenceAnalysis {
    summaryVi: string;
    overallImpactScore: number;
    analysisConfidence: number;
    marketState: MarketStateOutlook;
    narratives: MarketNarrative[];
    assetAnalysis: AssetAnalysisItem[];
    institutionalFlowVi?: string;
    regulationVi?: string;
    catalystsVi: string[];
    risksVi: string[];
    watchNextVi: string[];
    usedEventIds: string[];
    ignoredEventIds: IgnoredEventItem[];
}

export interface DigestPayload {
    id: string;
    title: string;
    periodHours: number;
    generatedAt: Date;
    items: AggregatedMarketEvent[];
    marketIntelligence?: MarketIntelligenceAnalysis;
    snapshot?: MarketSnapshotSection;
    trendingTokens?: DigestTrendingToken[];
    macroHighlights?: string[];
    signalsToWatch?: string[];
    overallImpactScore?: number;
    overallImpactLabel?: string;
}

export enum DigestDeliveryStatus {
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    SKIPPED_EMPTY = 'SKIPPED_EMPTY',
}

export interface DigestDeliveryRecord {
    id: string;
    slotKey?: string;
    startedAt: Date;
    windowFrom: Date;
    windowTo: Date;
    itemCount: number;
    eventIds: string[];
    eventFingerprints: string[];
    status: DigestDeliveryStatus;
    sentAt?: Date;
    failedAt?: Date;
    lastError?: string;
    previewText?: string;
}
