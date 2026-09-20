import type { MarketEvent } from '../notifications/types';
import type { AiNewsAnalysis, LatestMarketIntelligenceItem, LatestMarketOverview, LatestNewsAnalysis } from './types';
import type { AggregatedMarketEvent, MarketIntelligenceAnalysis } from '../digest/types';
import type { ClusteredMarketEvent } from './latest/latest-event-clustering.service';

export interface AiNewsAnalyzer {
    readonly providerName: string;
    analyzeEvents(events: MarketEvent[]): Promise<Map<string, AiNewsAnalysis>>;
    analyzeSingleEvent(event: MarketEvent): Promise<AiNewsAnalysis | null>;
    synthesizeMarketIntelligence?(events: AggregatedMarketEvent[]): Promise<MarketIntelligenceAnalysis | null>;
    analyzeLatestNews?(events: ClusteredMarketEvent[]): Promise<Map<string, LatestNewsAnalysis>>;
    synthesizeLatestOverview?(items: LatestMarketIntelligenceItem[]): Promise<LatestMarketOverview | null>;
}

