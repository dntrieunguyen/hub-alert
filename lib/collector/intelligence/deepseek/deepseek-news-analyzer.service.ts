import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';
import type { MarketEvent } from '../../notifications/types';
import type { AiNewsAnalyzer } from '../ai-news-analyzer.interface';
import { InMemoryAiAnalysisCache } from '../cache/in-memory-ai-analysis-cache';
import type { AiAnalyzerConfig, AiInputEvent, AiNewsAnalysis } from '../types';
import { buildDeepSeekUserPrompt, DEEPSEEK_SYSTEM_PROMPT } from './deepseek-prompt';
import { DeepSeekValidator } from './deepseek-validator';

export class DeepSeekNewsAnalyzer implements AiNewsAnalyzer {
    readonly providerName = 'deepseek';

    private config: AiAnalyzerConfig;
    private cache: InMemoryAiAnalysisCache;
    private fetchFn: any;

    constructor(
        options: {
            config?: Partial<AiAnalyzerConfig>;
            cache?: InMemoryAiAnalysisCache;
            fetchFn?: any;
        } = {}
    ) {
        this.cache = options.cache ?? new InMemoryAiAnalysisCache();
        this.fetchFn = options.fetchFn ?? ofetch;

        const env = process.env;
        const rawEnabled = env.AI_NEWS_ENABLED?.trim().toLowerCase();
        const enabled = rawEnabled === undefined ? true : rawEnabled === 'true' || rawEnabled === '1';

        this.config = {
            enabled: options.config?.enabled ?? enabled,
            provider: options.config?.provider ?? (env.AI_PROVIDER || 'deepseek'),
            apiKey: options.config?.apiKey ?? env.DEEPSEEK_API_KEY,
            model: options.config?.model ?? (env.DEEPSEEK_MODEL || 'deepseek-chat'),
            language: options.config?.language ?? (env.AI_NEWS_LANGUAGE || 'vi'),
            maxCandidates: options.config?.maxCandidates ?? Number.parseInt(env.AI_NEWS_MAX_CANDIDATES || '30', 10),
            maxDigestItems: options.config?.maxDigestItems ?? Number.parseInt(env.AI_NEWS_MAX_DIGEST_ITEMS || '10', 10),
            minCredibility: options.config?.minCredibility ?? Number.parseInt(env.AI_NEWS_MIN_CREDIBILITY || '70', 10),
            minImpactScore: options.config?.minImpactScore ?? Number.parseInt(env.AI_NEWS_MIN_IMPACT_SCORE || '60', 10),
            hotNewsEnabled: options.config?.hotNewsEnabled ?? (env.AI_HOT_NEWS_ENABLED !== 'false'),
            hotNewsMinCredibility: options.config?.hotNewsMinCredibility ?? Number.parseInt(env.AI_HOT_NEWS_MIN_CREDIBILITY || '90', 10),
            hotNewsMinImpactScore: options.config?.hotNewsMinImpactScore ?? Number.parseInt(env.AI_HOT_NEWS_MIN_IMPACT_SCORE || '90', 10),
            hotNewsMinConfidence: options.config?.hotNewsMinConfidence ?? Number.parseFloat(env.AI_HOT_NEWS_MIN_CONFIDENCE || '0.90'),
            timeoutMs: options.config?.timeoutMs ?? 25000,
            maxRetries: options.config?.maxRetries ?? 3,
        };
    }

    /**
     * Analyzes candidate MarketEvents in batch using DeepSeek LLM
     */
    async analyzeEvents(events: MarketEvent[]): Promise<Map<string, AiNewsAnalysis>> {
        const resultMap = new Map<string, AiNewsAnalysis>();

        if (!this.config.enabled) {
            logger.debug('[ai.news.disabled] AI news analysis is disabled in configuration');
            return resultMap;
        }

        if (!this.config.apiKey) {
            logger.warn('[ai.news.no_api_key] DEEPSEEK_API_KEY is not configured, skipping AI analysis');
            return resultMap;
        }

        if (!events || events.length === 0) {
            return resultMap;
        }

        // 1. Separate cached items from items that need LLM analysis
        const toAnalyze: MarketEvent[] = [];
        const eventMap = new Map<string, MarketEvent>();

        for (const event of events) {
            eventMap.set(event.id, event);
            const inputHash = this.cache.computeInputHash(event);
            const cached = this.cache.get(event.id, inputHash);

            if (cached) {
                resultMap.set(event.id, cached);
                logger.debug(
                    JSON.stringify({
                        event: 'ai.news.analysis.cached',
                        eventId: event.id,
                    })
                );
            } else {
                toAnalyze.push(event);
            }
        }

        if (toAnalyze.length === 0) {
            return resultMap;
        }

        // Cap batch size to maxCandidates
        const candidates = toAnalyze.slice(0, this.config.maxCandidates);

        logger.info(
            JSON.stringify({
                event: 'ai.news.analysis.started',
                provider: this.providerName,
                model: this.config.model,
                candidateCount: candidates.length,
            })
        );

        // 2. Prepare structured sanitized input
        const aiInputs: AiInputEvent[] = candidates.map((e) => ({
            eventId: e.id,
            title: e.title,
            summary: e.summary,
            content: e.content ? e.content.replace(/<[^>]*>?/gm, '').slice(0, 400) : undefined,
            eventType: e.eventType,
            source: {
                name: e.source.name,
                tier: e.source.tier,
                credibilityScore: e.source.credibilityScore,
            },
            verificationStatus: e.verificationStatus,
            impactScore: e.impactScore,
            trendScore: e.trendScore,
            publishedAt: e.publishedAt.toISOString(),
            assets: e.tokens || [],
            topics: (e.metadata?.topics as string[]) || [],
            sourceUrl: e.url,
        }));

        // 3. Call DeepSeek with retries
        try {
            const rawResponse = await this.executeCallWithRetry(aiInputs);
            const validatedMap = DeepSeekValidator.validateAnalyses(rawResponse, eventMap);

            for (const [id, analysis] of validatedMap.entries()) {
                resultMap.set(id, analysis);
                const ev = eventMap.get(id);
                if (ev) {
                    const inputHash = this.cache.computeInputHash(ev);
                    this.cache.set(id, inputHash, analysis, this.providerName, this.config.model);
                }
            }

            logger.info(
                JSON.stringify({
                    event: 'ai.news.analysis.completed',
                    analyzedCount: validatedMap.size,
                    valuableCount: Array.from(validatedMap.values()).filter((a) => a.isValuable).length,
                })
            );
        } catch (error: any) {
            // NEVER log secret tokens or headers!
            logger.error(
                JSON.stringify({
                    event: 'ai.news.analysis.failed',
                    error: error.message || 'DeepSeek call failed',
                })
            );
            // Non-fatal: returns whatever was successfully cached
        }

        return resultMap;
    }

    /**
     * Single event analysis helper (primarily for Realtime Hot News checks)
     */
    async analyzeSingleEvent(event: MarketEvent): Promise<AiNewsAnalysis | null> {
        const map = await this.analyzeEvents([event]);
        return map.get(event.id) || null;
    }

    private async executeCallWithRetry(inputs: AiInputEvent[]): Promise<any> {
        const url = 'https://api.deepseek.com/chat/completions';
        const maxRetries = this.config.maxRetries || 3;
        const delays = [1000, 3000, 5000];

        let lastError: any = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.fetchFn(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${this.config.apiKey}`,
                    },
                    body: {
                        model: this.config.model,
                        messages: [
                            { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
                            { role: 'user', content: buildDeepSeekUserPrompt(inputs) },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.2,
                    },
                    timeout: this.config.timeoutMs,
                });

                // DeepSeek chat completions format: { choices: [{ message: { content: "..." } }] }
                const content = response?.choices?.[0]?.message?.content;
                if (!content) {
                    throw new Error('Empty response from DeepSeek API');
                }

                const parsed = typeof content === 'string' ? JSON.parse(content) : content;
                return parsed;
            } catch (err: any) {
                lastError = err;
                const status = err?.status || err?.statusCode || err?.response?.status;
                const isRetryable =
                    status === 429 ||
                    (status && status >= 500 && status <= 504) ||
                    err?.name === 'TimeoutError' ||
                    err?.code === 'ETIMEDOUT';

                if (attempt < maxRetries && isRetryable) {
                    const delay = delays[attempt - 1] || 2000;
                    logger.warn(`[ai.deepseek.retry] Attempt ${attempt} failed with status ${status}. Retrying in ${delay}ms...`);
                    await new Promise((res) => setTimeout(res, delay));
                } else if (!isRetryable) {
                    // Non-retryable error (e.g. 401, 400)
                    break;
                }
            }
        }

        throw lastError;
    }

    getConfig(): Readonly<AiAnalyzerConfig> {
        return { ...this.config };
    }
}
