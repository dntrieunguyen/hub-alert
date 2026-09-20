import type { MarketEvent } from '../notifications/types';
import type { AiNewsAnalysis } from './types';
import type { AggregatedMarketEvent, MarketIntelligenceAnalysis } from '../digest/types';

export interface AiNewsAnalyzer {
    readonly providerName: string;
    analyzeEvents(events: MarketEvent[]): Promise<Map<string, AiNewsAnalysis>>;
    analyzeSingleEvent(event: MarketEvent): Promise<AiNewsAnalysis | null>;
    synthesizeMarketIntelligence?(events: AggregatedMarketEvent[]): Promise<MarketIntelligenceAnalysis | null>;
}
