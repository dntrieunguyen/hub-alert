import type { AiNewsAnalyzer } from '../../intelligence/ai-news-analyzer.interface';

export interface IntelligenceModuleDependencies {
    aiAnalyzer?: AiNewsAnalyzer;
}

export class IntelligenceService {
    constructor(private readonly aiAnalyzer?: AiNewsAnalyzer) {}

    getAiStatus() {
        const analyzerConfig = (this.aiAnalyzer as any)?.getConfig?.();
        return {
            ai: {
                provider: this.aiAnalyzer?.providerName || 'none',
                enabled: analyzerConfig?.enabled ?? false,
                model: analyzerConfig?.model,
                language: analyzerConfig?.language,
                maxCandidates: analyzerConfig?.maxCandidates,
                hotNewsEnabled: analyzerConfig?.hotNewsEnabled,
                hotNewsMinCredibility: analyzerConfig?.hotNewsMinCredibility,
                hotNewsMinImpactScore: analyzerConfig?.hotNewsMinImpactScore,
                hotNewsMinConfidence: analyzerConfig?.hotNewsMinConfidence,
            },
        };
    }
}
