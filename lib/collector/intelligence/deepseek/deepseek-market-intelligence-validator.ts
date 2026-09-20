import type {
    AssetAnalysisItem,
    IgnoredEventItem,
    MarketIntelligenceAnalysis,
    MarketNarrative,
    MarketNarrativeStrength,
} from '../../digest/types';
import { validateVietnameseOutput } from '../../digest/crypto-digest-vietnamese-validator';

export class DeepSeekMarketIntelligenceValidator {
    /**
     * Validates and sanitizes raw JSON returned by DeepSeek for MarketIntelligenceAnalysis
     */
    static validateAnalysis(raw: any, eventIds: string[]): MarketIntelligenceAnalysis | null {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const validEventIdsSet = new Set(eventIds);

        // 1. summaryVi
        let summaryVi = typeof raw.summaryVi === 'string' ? raw.summaryVi.trim() : '';
        if (!summaryVi || !validateVietnameseOutput(summaryVi)) {
            return null;
        }

        // 2. Scores
        let overallImpactScore = typeof raw.overallImpactScore === 'number' ? Math.round(raw.overallImpactScore) : 60;
        overallImpactScore = Math.max(0, Math.min(100, overallImpactScore));

        let analysisConfidence = typeof raw.analysisConfidence === 'number' ? Math.round(raw.analysisConfidence) : 80;
        analysisConfidence = Math.max(0, Math.min(100, analysisConfidence));

        // 3. marketState
        const rawState = raw.marketState && typeof raw.marketState === 'object' ? raw.marketState : {};
        const marketState = {
            overall: typeof rawState.overall === 'string' && rawState.overall ? rawState.overall.trim() : 'TRUNG LẬP',
            btc: typeof rawState.btc === 'string' && rawState.btc ? rawState.btc.trim() : undefined,
            eth: typeof rawState.eth === 'string' && rawState.eth ? rawState.eth.trim() : undefined,
            altcoin: typeof rawState.altcoin === 'string' && rawState.altcoin ? rawState.altcoin.trim() : undefined,
            meme: typeof rawState.meme === 'string' && rawState.meme ? rawState.meme.trim() : undefined,
        };

        // 4. narratives
        const narratives: MarketNarrative[] = [];
        if (Array.isArray(raw.narratives)) {
            for (const n of raw.narratives) {
                if (n && typeof n.titleVi === 'string' && typeof n.summaryVi === 'string') {
                    const titleVi = n.titleVi.trim();
                    const nSummaryVi = n.summaryVi.trim();
                    if (!titleVi || !nSummaryVi) {
                        continue;
                    }

                    const strength: MarketNarrativeStrength = ['HIGH', 'MEDIUM', 'LOW'].includes(n.strength)
                        ? n.strength
                        : 'MEDIUM';

                    const supportingEventIds = Array.isArray(n.supportingEventIds)
                        ? n.supportingEventIds.filter((id: any) => typeof id === 'string')
                        : [];

                    narratives.push({
                        titleVi,
                        summaryVi: nSummaryVi,
                        strength,
                        supportingEventIds,
                    });
                }
            }
        }

        if (narratives.length === 0) {
            return null;
        }

        // 5. assetAnalysis
        const assetAnalysis: AssetAnalysisItem[] = [];
        if (Array.isArray(raw.assetAnalysis)) {
            for (const a of raw.assetAnalysis) {
                if (a && typeof a.asset === 'string' && typeof a.summaryVi === 'string') {
                    const asset = a.asset.trim().toUpperCase();
                    const outlook = typeof a.outlook === 'string' ? a.outlook.trim().toUpperCase() : 'TRUNG LẬP';
                    const aSummaryVi = a.summaryVi.trim();
                    const signalsVi = Array.isArray(a.signalsVi)
                        ? a.signalsVi.filter((s: any) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim())
                        : [];

                    if (asset && aSummaryVi) {
                        assetAnalysis.push({
                            asset,
                            outlook,
                            summaryVi: aSummaryVi,
                            signalsVi,
                        });
                    }
                }
            }
        }

        // 6. Optional sections: institutionalFlowVi, regulationVi
        const institutionalFlowVi =
            typeof raw.institutionalFlowVi === 'string' && raw.institutionalFlowVi.trim().length > 0
                ? raw.institutionalFlowVi.trim()
                : undefined;

        const regulationVi =
            typeof raw.regulationVi === 'string' && raw.regulationVi.trim().length > 0
                ? raw.regulationVi.trim()
                : undefined;

        // 7. Lists: catalystsVi, risksVi, watchNextVi
        const catalystsVi = Array.isArray(raw.catalystsVi)
            ? raw.catalystsVi
                  .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
                  .map((c: string) => c.trim())
                  .slice(0, 3)
            : [];

        const risksVi = Array.isArray(raw.risksVi)
            ? raw.risksVi
                  .filter((r: any) => typeof r === 'string' && r.trim().length > 0)
                  .map((r: string) => r.trim())
            : [];

        const watchNextVi = Array.isArray(raw.watchNextVi)
            ? raw.watchNextVi
                  .filter((w: any) => typeof w === 'string' && w.trim().length > 0)
                  .map((w: string) => w.trim())
            : [];

        // 8. usedEventIds & ignoredEventIds
        const usedEventIds = Array.isArray(raw.usedEventIds)
            ? raw.usedEventIds.filter((id: any) => typeof id === 'string')
            : eventIds;

        const ignoredEventIds: IgnoredEventItem[] = [];
        if (Array.isArray(raw.ignoredEventIds)) {
            for (const ign of raw.ignoredEventIds) {
                if (ign && typeof ign.eventId === 'string') {
                    ignoredEventIds.push({
                        eventId: ign.eventId,
                        reasonVi: typeof ign.reasonVi === 'string' ? ign.reasonVi.trim() : 'Tin nhiễu không liên quan',
                    });
                }
            }
        }

        return {
            summaryVi,
            overallImpactScore,
            analysisConfidence,
            marketState,
            narratives: narratives.slice(0, 5),
            assetAnalysis,
            institutionalFlowVi,
            regulationVi,
            catalystsVi,
            risksVi,
            watchNextVi,
            usedEventIds,
            ignoredEventIds,
        };
    }
}
