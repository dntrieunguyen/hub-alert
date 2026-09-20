import logger from '@/utils/logger';
import type { IFeedRepository } from '../../storage/feed-repository.interface';
import type { FeedSourceService } from '../../sources/feed-source.service';
import type { CollectorService } from '../../collector.service';
import type { NotificationModule } from '../../notifications/notification.module';
import type { AiNewsAnalyzer } from '../ai-news-analyzer.interface';
import type {
    LatestMarketIntelligenceItem,
    LatestMarketIntelligenceResponse,
    LatestMarketOverview,
    LatestNewsAnalysis,
} from '../types';
import type { CryptoFeedItem } from '../../types';
import { LatestMarketRelevanceService } from './latest-market-relevance.service';
import { type ClusteredMarketEvent, LatestEventClusteringService } from './latest-event-clustering.service';
import { LatestMarketOverviewService } from './latest-market-overview.service';
import { DeepSeekLatestValidator } from '../deepseek/deepseek-latest-validator';


export interface LatestIntelligenceConfig {
    defaultLimit: number;
    minCredibility: number;
    minImpactScore: number;
    minMarketRelevance: number;
    minInformationValue: number;
    minConfidence: number;
    cacheTtlMs: number;
}

export class LatestMarketIntelligenceService {
    private repository: IFeedRepository;
    private sourceService?: FeedSourceService;
    private collectorService?: CollectorService;
    private notificationModule?: NotificationModule;
    private aiAnalyzer?: AiNewsAnalyzer;

    private relevanceService: LatestMarketRelevanceService;
    private clusteringService: LatestEventClusteringService;
    private overviewService: LatestMarketOverviewService;

    private config: LatestIntelligenceConfig;

    // In-memory cache for the endpoint response
    private cachedResponse: {
        response: LatestMarketIntelligenceResponse;
        cachedAt: number;
        limit: number;
    } | null = null;

    // Cache of individual event analyses keyed by event id + content hash
    private analysisCache = new Map<string, LatestNewsAnalysis>();

    constructor(
        dependencies: {
            repository: IFeedRepository;
            sourceService?: FeedSourceService;
            collectorService?: CollectorService;
            notificationModule?: NotificationModule;
            aiAnalyzer?: AiNewsAnalyzer;
        },
        options: Partial<LatestIntelligenceConfig> = {}
    ) {
        this.repository = dependencies.repository;
        this.sourceService = dependencies.sourceService;
        this.collectorService = dependencies.collectorService;
        this.notificationModule = dependencies.notificationModule;
        this.aiAnalyzer = dependencies.aiAnalyzer;

        const env = process.env;
        this.config = {
            defaultLimit: options.defaultLimit ?? 10,
            minCredibility: options.minCredibility ?? Number.parseInt(env.LATEST_MIN_CREDIBILITY || '60', 10),
            minImpactScore: options.minImpactScore ?? Number.parseInt(env.LATEST_MIN_IMPACT_SCORE || '20', 10),
            minMarketRelevance: options.minMarketRelevance ?? Number.parseInt(env.LATEST_MIN_MARKET_RELEVANCE || '50', 10),
            minInformationValue: options.minInformationValue ?? Number.parseInt(env.LATEST_MIN_INFORMATION_VALUE || '50', 10),
            minConfidence: options.minConfidence ?? Number.parseFloat(env.LATEST_MIN_AI_CONFIDENCE || '0.70'),
            cacheTtlMs: options.cacheTtlMs ?? 120000, // 2 minutes
        };

        this.relevanceService = new LatestMarketRelevanceService(this.config.minMarketRelevance);
        this.clusteringService = new LatestEventClusteringService();
        this.overviewService = new LatestMarketOverviewService();
    }

    /**
     * Main endpoint processing pipeline for GET /api/collector/latest
     */
    async getLatestIntelligence(options: {
        limit?: number;
        raw?: boolean;
        forceRefresh?: boolean;
    } = {}): Promise<LatestMarketIntelligenceResponse | { raw: true; items: CryptoFeedItem[] }> {
        const limit = Math.min(50, Math.max(1, options.limit ?? this.config.defaultLimit));

        // 1. Raw debug mode (development / admin use only)
        if (options.raw) {
            const rawItems = await this.repository.findLatest(limit);
            return { raw: true, items: rawItems };
        }

        // 2. Check response cache
        const now = Date.now();
        if (
            !options.forceRefresh &&
            this.cachedResponse &&
            this.cachedResponse.limit === limit &&
            now - this.cachedResponse.cachedAt < this.config.cacheTtlMs
        ) {
            return this.cachedResponse.response;
        }

        // 3. Candidate Pool Loading (Section 16: candidateLimit = max(limit * 5, 50))
        const candidateLimit = Math.max(limit * 5, 50);
        let candidates = await this.repository.findLatest(Math.max(candidateLimit, 100));

        // If repository has no items yet, return clean empty intelligence response without blocking
        if (candidates.length === 0) {
            return {
                generatedAt: new Date().toISOString(),
                summary: {
                    title: 'Tổng quan thị trường mới nhất',
                    marketOverview: 'Hiện chưa có dữ liệu tin tức mới trong hệ thống. Vui lòng quay lại sau khi hệ thống thu thập thêm dữ liệu.',
                    overallImpactScore: 50,
                    marketState: 'TRUNG_LẬP',
                    mainNarratives: [],
                    risks: [],
                    watchNext: [],
                },
                items: [],
            };
        }


        // 4. Pre-filtering Noise & Irrelevant Market Flashes (Section 4, 5, 15)
        const relevantCandidates: CryptoFeedItem[] = [];
        for (const item of candidates) {
            const evalResult = this.relevanceService.isMarketRelevantToCrypto(item);
            if (evalResult.isRelevant) {
                relevantCandidates.push(item);
            }
        }

        // 5. Cluster Related Events (Section 13, 14: Jin10 flashes within 30-min window)
        const clusters = this.clusteringService.clusterEvents(relevantCandidates);

        // 6. AI Analysis with Caching & Fallback (Section 8, 9, 25, 27, 28)
        const analysesMap = new Map<string, LatestNewsAnalysis>();
        const clustersToAnalyze: ClusteredMarketEvent[] = [];

        for (const cluster of clusters) {
            const cacheKey = `${cluster.id}_${cluster.primaryItem.fingerprint}`;
            const cached = this.analysisCache.get(cacheKey);
            if (cached) {
                analysesMap.set(cluster.id, cached);
            } else {
                clustersToAnalyze.push(cluster);
            }
        }

        if (clustersToAnalyze.length > 0 && this.aiAnalyzer?.analyzeLatestNews) {
            try {
                const newAnalyses = await this.aiAnalyzer.analyzeLatestNews(clustersToAnalyze);
                for (const [id, analysis] of newAnalyses.entries()) {
                    analysesMap.set(id, analysis);
                    const cluster = clusters.find((c) => c.id === id);
                    if (cluster) {
                        const cacheKey = `${cluster.id}_${cluster.primaryItem.fingerprint}`;
                        this.analysisCache.set(cacheKey, analysis);
                        this.persistAiFieldsToItem(cluster.primaryItem, analysis);
                    }
                }
            } catch (err: any) {
                logger.error(`[latest.ai.error] Failed to analyze news with AI: ${err.message}`);
            }
        }

        // Ensure every cluster has an analysis (using deterministic fallback if unanalyzed)
        for (const cluster of clusters) {
            if (!analysesMap.has(cluster.id)) {
                const fallback = this.createFallbackAnalysis(cluster);
                if (fallback) {
                    analysesMap.set(cluster.id, fallback);
                }
            }
        }

        // 7. Apply Quality Gates (Section 18)
        const qualifiedClusters: { cluster: ClusteredMarketEvent; analysis: LatestNewsAnalysis; finalScore: number }[] = [];

        for (const cluster of clusters) {
            const analysis = analysesMap.get(cluster.id);
            if (!analysis) {
                continue;
            }

            // Exclude noise or explicit AI exclusion
            if (!analysis.include || analysis.signalStrength === 'NOISE') {
                continue;
            }

            // Quality gates
            if (analysis.marketRelevanceScore < this.config.minMarketRelevance) {
                continue;
            }
            if (analysis.informationValueScore < this.config.minInformationValue) {
                continue;
            }
            if (cluster.credibilityScore < this.config.minCredibility) {
                continue;
            }
            if (cluster.impactScore < this.config.minImpactScore) {
                continue;
            }
            if (analysis.confidence < this.config.minConfidence) {
                continue;
            }

            // 8. Multi-factor Ranking (Section 17)
            const finalScore = this.calculateFinalRankingScore(cluster, analysis);
            qualifiedClusters.push({ cluster, analysis, finalScore });
        }

        // Sort by finalScore descending
        qualifiedClusters.sort((a, b) => b.finalScore - a.finalScore);

        // Slice Top N
        const selected = qualifiedClusters.slice(0, limit);

        // 9. Format Mapped Intelligence Items (100% natural Vietnamese)
        const items: LatestMarketIntelligenceItem[] = selected.map(({ cluster, analysis }) => ({
            id: cluster.primaryItem.id,
            title: analysis.titleVi,
            summary: analysis.summaryVi,
            analysis: analysis.analysisVi,
            whyItMatters: analysis.whyItMattersVi,
            marketImpact: analysis.marketImpactVi,
            source: {
                id: cluster.primaryItem.sourceId,
                name: cluster.primaryItem.sourceName,
                tier: cluster.primaryItem.sourceTier,
                credibilityScore: cluster.credibilityScore,
            },
            marketRelevanceScore: analysis.marketRelevanceScore,
            impactScore: Math.round((cluster.impactScore + analysis.aiImpactScore) / 2),
            signalStrength: analysis.signalStrength,
            affectedAssets: analysis.affectedAssets,
            affectedNarratives: analysis.affectedNarratives,
            publishedAt: cluster.publishedAt.toISOString(),
            url: cluster.primaryItem.url,
            originalTitle: cluster.primaryItem.originalTitle || cluster.primaryItem.title,
            originalSummary: cluster.primaryItem.originalSummary || cluster.primaryItem.summary,
            originalLanguage: cluster.primaryItem.originalLanguage,
        }));

        // 10. Synthesize Overall Market Overview (Section 20, 21, 22)
        const summary = this.overviewService.synthesizeOverview(items);

        const response: LatestMarketIntelligenceResponse = {
            generatedAt: new Date().toISOString(),
            summary,
            items,
        };

        // Cache the response
        this.cachedResponse = {
            response,
            cachedAt: now,
            limit,
        };

        return response;
    }

    /**
     * Explicit trigger to send formatted Latest Market Intelligence to Google Chat (POST /latest/notify)
     */
    async sendLatestNotification(limit = 10): Promise<{ sent: boolean; message?: string; error?: string }> {
        if (!this.notificationModule) {
            return { sent: false, error: 'Notification module not configured' };
        }
        if (!this.notificationModule.configService.isEnabled()) {
            return { sent: false, message: 'Google Chat notification is disabled in configuration' };
        }

        try {
            const data = await this.getLatestIntelligence({ limit, forceRefresh: true });
            if ('raw' in data) {
                return { sent: false, error: 'Cannot format raw feeds for notification' };
            }

            const formattedMessage = this.formatGoogleChatMessage(data);
            await this.notificationModule.notificationService.sendText(formattedMessage, {
                eventId: `manual_latest_${Date.now()}`,
                severity: 'INFO',
            });

            return { sent: true, message: 'Latest Market Intelligence sent to Google Chat successfully' };
        } catch (err: any) {
            return { sent: false, error: err.message };
        }
    }

    /**
     * Ranking Formula according to Section 17:
     * finalScore = credibility * 0.15 + impact * 0.20 + marketRelevance * 0.25 + infoValue * 0.20 + aiImpact * 0.10 + recency * 0.10
     */
    private calculateFinalRankingScore(cluster: ClusteredMarketEvent, analysis: LatestNewsAnalysis): number {
        const credibility = cluster.credibilityScore;
        const impact = cluster.impactScore;
        const marketRelevance = analysis.marketRelevanceScore;
        const informationValue = analysis.informationValueScore;
        const aiImpact = analysis.aiImpactScore;

        const ageInHours = Math.max(0, (Date.now() - cluster.publishedAt.getTime()) / (1000 * 60 * 60));
        const recencyScore = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-ageInHours / 24))));

        const finalScore =
            credibility * 0.15 +
            impact * 0.20 +
            marketRelevance * 0.25 +
            informationValue * 0.20 +
            aiImpact * 0.10 +
            recencyScore * 0.10;

        return Math.round(finalScore * 100) / 100;
    }

    private persistAiFieldsToItem(item: CryptoFeedItem, analysis: LatestNewsAnalysis): void {
        if (!item.originalTitle) {
            item.originalTitle = item.title;
        }
        if (!item.originalSummary) {
            item.originalSummary = item.summary;
        }
        if (!item.originalContent) {
            item.originalContent = item.content;
        }

        item.aiTitleVi = analysis.titleVi;
        item.aiSummaryVi = analysis.summaryVi;
        item.aiAnalysisVi = analysis.analysisVi;
        item.aiWhyItMattersVi = analysis.whyItMattersVi;
        item.aiMarketImpactVi = analysis.marketImpactVi;
        item.aiInformationValueScore = analysis.informationValueScore;
        item.aiMarketRelevanceScore = analysis.marketRelevanceScore;
        item.aiImpactScore = analysis.aiImpactScore;
        item.aiConfidence = analysis.confidence;
        item.aiSignalStrength = analysis.signalStrength;
        item.aiAnalyzedAt = new Date();
        item.aiProvider = this.aiAnalyzer?.providerName || 'deepseek';
        item.aiAnalysisVersion = 1;
    }

    private createFallbackAnalysis(cluster: ClusteredMarketEvent): LatestNewsAnalysis | null {
        return DeepSeekLatestValidator.createDeterministicFallback(cluster);
    }


    private formatGoogleChatMessage(data: LatestMarketIntelligenceResponse): string {
        const formatter = this.notificationModule?.formatter;
        const nowVietnam = formatter ? formatter.formatVietnamTime(new Date()) : new Date().toISOString();

        const lines: string[] = [
            `⚡ [HUB ALERT] MARKET INTELLIGENCE LATEST`,
            `🕒 Cập nhật: ${nowVietnam}`,
            `📊 Trạng thái: ${data.summary.marketState} | Điểm tác động: ${data.summary.overallImpactScore}/100`,
            '',
            `🌐 **${data.summary.title}**:`,
            `> ${data.summary.marketOverview}`,
            '',
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ];

        data.items.forEach((item, index) => {
            const time = formatter ? formatter.formatVietnamTime(new Date(item.publishedAt)) : '';
            lines.push(`${index + 1}. <${item.url}|${item.title}>`);
            lines.push(`> 📝 ${item.summary}`);
            lines.push(`> 💡 *Phân tích*: ${item.analysis}`);
            lines.push(`> 🎯 *Tác động*: ${item.whyItMatters}`);
            lines.push(`🏷️ Nguồn: ${item.source.name} | Relevancy: ${item.marketRelevanceScore}/100 | Tác động: ${item.impactScore}/100${time ? ` | 🕒 ${time}` : ''}`);
            lines.push('');
        });

        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('Dữ liệu Market Intelligence tự động xử lý bởi Hub Alert AI.');

        return lines.join('\n').trim();
    }
}
