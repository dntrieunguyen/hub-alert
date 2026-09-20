import type { MarketEvent } from '../../notifications/types';
import type { AiNewsAnalysis, AiNewsCategory } from '../types';
import { isValidTitle } from '../../digest/crypto-digest-relevance.service';
import { validateVietnameseOutput } from '../../digest/crypto-digest-vietnamese-validator';

const VALID_CATEGORIES: Set<AiNewsCategory> = new Set([
    'MACRO',
    'REGULATION',
    'ETF',
    'EXCHANGE',
    'SECURITY',
    'CRYPTO_MARKET',
    'MEME',
    'PROJECT',
    'OTHER',
]);

export class DeepSeekValidator {
    /**
     * Validates and sanitizes a parsed JSON output from DeepSeek against ground truth MarketEvents
     */
    static validateAnalyses(
        rawOutput: unknown,
        eventMap: Map<string, MarketEvent>
    ): Map<string, AiNewsAnalysis> {
        const resultMap = new Map<string, AiNewsAnalysis>();

        if (!rawOutput || typeof rawOutput !== 'object') {
            return resultMap;
        }

        const rawList = Array.isArray(rawOutput)
            ? rawOutput
            : Array.isArray((rawOutput as any).analyses)
              ? (rawOutput as any).analyses
              : null;

        if (!rawList) {
            return resultMap;
        }

        for (const rawItem of rawList) {
            if (!rawItem || typeof rawItem !== 'object') {
                continue;
            }

            const eventId = String(rawItem.eventId || '');
            const groundTruthEvent = eventMap.get(eventId);
            if (!groundTruthEvent) {
                // Ignore unknown eventId
                continue;
            }

            const validated = this.validateSingleItem(rawItem, groundTruthEvent);
            if (validated) {
                resultMap.set(eventId, validated);
            }
        }

        return resultMap;
    }

    private static validateSingleItem(
        raw: any,
        event: MarketEvent
    ): AiNewsAnalysis | null {
        const titleVi = typeof raw.titleVi === 'string' ? raw.titleVi.trim() : '';
        const summaryVi = typeof raw.summaryVi === 'string' ? raw.summaryVi.trim() : '';
        const whyItMattersVi = typeof raw.whyItMattersVi === 'string' ? raw.whyItMattersVi.trim() : '';

        // If core Vietnamese content is missing or too short, reject
        if (!titleVi || !summaryVi) {
            return null;
        }

        // Must be a valid title (not Untitled, not placeholder, not empty)
        if (!isValidTitle(titleVi, 8)) {
            return null;
        }

        // Must pass Vietnamese language validation (reject raw Chinese/Japanese/Korean)
        if (!validateVietnameseOutput(titleVi) || !validateVietnameseOutput(summaryVi)) {
            return null;
        }
        if (whyItMattersVi && !validateVietnameseOutput(whyItMattersVi)) {
            return null;
        }

        // Validate Category
        const categoryStr = String(raw.category || '').toUpperCase() as AiNewsCategory;
        const category: AiNewsCategory = VALID_CATEGORIES.has(categoryStr) ? categoryStr : 'CRYPTO_MARKET';

        // Clamp scores
        const rawInfoScore = Number(raw.informationValueScore);
        const informationValueScore = Number.isFinite(rawInfoScore)
            ? Math.min(100, Math.max(0, Math.round(rawInfoScore)))
            : 50;

        const rawMarketScore = Number(raw.marketRelevanceScore);
        const marketRelevanceScore = Number.isFinite(rawMarketScore)
            ? Math.min(100, Math.max(0, Math.round(rawMarketScore)))
            : 50;

        const rawImpactScore = Number(raw.marketImpactScore ?? raw.impactScore ?? event.impactScore);
        const marketImpactScore = Number.isFinite(rawImpactScore)
            ? Math.min(100, Math.max(0, Math.round(rawImpactScore)))
            : event.impactScore;

        const rawConf = Number(raw.aiConfidence ?? raw.confidence);
        const aiConfidence = Number.isFinite(rawConf)
            ? Math.min(1, Math.max(0, Math.round(rawConf * 100) / 100))
            : 0.5;

        // Structured digestion & rejection fields
        const includeInDigest = raw.includeInDigest !== undefined
            ? Boolean(raw.includeInDigest)
            : Boolean(raw.isValuable !== false);
        const rejectionReason = typeof raw.rejectionReason === 'string' && raw.rejectionReason.trim()
            ? raw.rejectionReason.trim()
            : undefined;

        const duplicateOfEventId =
            typeof raw.duplicateOfEventId === 'string' && raw.duplicateOfEventId.trim()
                ? raw.duplicateOfEventId.trim()
                : typeof raw.duplicateOf === 'string' && raw.duplicateOf.trim()
                  ? raw.duplicateOf.trim()
                  : null;
        const isDuplicate = Boolean(raw.isDuplicate === true || duplicateOfEventId !== null);

        // Anti-hallucination for affected assets:
        // Only keep assets that are either in event tokens/symbols or mentioned in title/summary/content
        const candidateAssets = Array.isArray(raw.affectedAssets) ? raw.affectedAssets.map((a: unknown) => String(a).toUpperCase().replace(/^\$/, '').trim()).filter(Boolean) : [];
        const fullSourceText = `${event.title} ${event.summary || ''} ${event.content || ''}`.toUpperCase();
        const validAssets = candidateAssets.filter((asset: string) => {
            if (event.tokens.some((t) => t.toUpperCase() === asset)) {
                return true;
            }
            if (event.symbols.some((s) => s.toUpperCase().replace(/^\$/, '') === asset)) {
                return true;
            }
            // Check if string appears in text as word boundary
            return fullSourceText.includes(asset);
        });

        // Narratives
        const affectedNarratives = Array.isArray(raw.affectedNarratives)
            ? raw.affectedNarratives.map((n: unknown) => String(n).trim()).filter(Boolean)
            : [];

        // Key facts
        const keyFacts = Array.isArray(raw.keyFacts)
            ? raw.keyFacts.map((k: unknown) => String(k).trim()).filter(Boolean)
            : [];

        // Risks
        const risks = Array.isArray(raw.risks)
            ? raw.risks.map((r: unknown) => String(r).trim()).filter(Boolean)
            : [];

        return {
            eventId: event.id,
            includeInDigest,
            rejectionReason,
            isDuplicate,
            duplicateOf: duplicateOfEventId,
            duplicateOfEventId,
            isValuable: includeInDigest && Boolean(raw.isValuable !== false),
            isNewInformation: !isDuplicate && Boolean(raw.isNewInformation !== false),
            category,
            informationValueScore,
            marketRelevanceScore,
            marketImpactScore,
            aiConfidence,
            confidence: aiConfidence,
            isHotNews: Boolean(raw.isHotNews === true),
            titleVi,
            summaryVi,
            whyItMattersVi: whyItMattersVi || summaryVi,
            affectedAssets: validAssets,
            affectedNarratives,
            keyFacts,
            risks,
            uncertainty: typeof raw.uncertainty === 'string' && raw.uncertainty.trim() ? raw.uncertainty.trim() : undefined,
        };
    }
}
