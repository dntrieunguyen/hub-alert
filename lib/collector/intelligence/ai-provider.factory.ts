import type { AiNewsAnalyzer } from './ai-news-analyzer.interface';
import { DeepSeekNewsAnalyzer } from './deepseek/deepseek-news-analyzer.service';
import type { AiAnalyzerConfig } from './types';

export class AiProviderFactory {
    static createAnalyzer(options: {
        config?: Partial<AiAnalyzerConfig>;
        fetchFn?: any;
    } = {}): AiNewsAnalyzer {
        const provider = (options.config?.provider || process.env.AI_PROVIDER || 'deepseek').toLowerCase();

        switch (provider) {
            case 'deepseek': {
                return new DeepSeekNewsAnalyzer(options);
            }
            default: {
                // Default to DeepSeek, but easy to wire OpenAI / Gemini / Grok / Local in future
                return new DeepSeekNewsAnalyzer(options);
            }
        }
    }
}
