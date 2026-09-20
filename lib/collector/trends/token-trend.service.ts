import { TokenExtractorService } from '../extraction/token-extractor.service';
import { TrendScoreService } from '../scoring/trend-score.service';
import type { IFeedRepository } from '../storage/feed-repository.interface';
import { type MemeTrend, SourceTier, type TokenTrend } from '../types';

export class TokenTrendService {
    private repository: IFeedRepository;
    private tokenExtractor: TokenExtractorService;
    private trendScoreService: TrendScoreService;

    constructor(
        repository: IFeedRepository,
        tokenExtractor?: TokenExtractorService,
        trendScoreService?: TrendScoreService
    ) {
        this.repository = repository;
        this.tokenExtractor = tokenExtractor ?? new TokenExtractorService();
        this.trendScoreService = trendScoreService ?? new TrendScoreService();
    }

    private getWindowDurationMs(window: '1h' | '6h' | '24h'): number {
        switch (window) {
            case '1h': {
                return 60 * 60 * 1000;
            }
            case '6h': {
                return 6 * 60 * 60 * 1000;
            }
            case '24h': {
                return 24 * 60 * 60 * 1000;
            }
            default: {
                return 60 * 60 * 1000;
            }
        }
    }

    /**
     * Aggregates meme trends for a given time window
     */
    async getMemeTrends(window: '1h' | '6h' | '24h' = '1h'): Promise<MemeTrend[]> {
        const windowMs = this.getWindowDurationMs(window);
        const hoursInWindow = windowMs / (60 * 60 * 1000);
        const recentItems = await this.repository.findRecentItemsForWindow(windowMs);

        // Map token symbol -> dictionary entry
        const dictMap = new Map(this.tokenExtractor.getDictionary().map((d) => [d.symbol, d]));

        // Group mentions by token symbol
        const groups = new Map<
            string,
            {
                token: string;
                symbol: string;
                chain?: string;
                items: typeof recentItems;
                sources: Set<string>;
                officialCount: number;
                newsCount: number;
                socialCount: number;
                credibilitySum: number;
                latestPublishedAt: Date;
            }
        >();

        for (const item of recentItems) {
            for (const tokenSymbol of item.tokens) {
                const dictEntry = dictMap.get(tokenSymbol);
                if (!dictEntry || !dictEntry.isMeme) {
                    continue; // Only process memecoins here
                }

                let group = groups.get(tokenSymbol);
                if (!group) {
                    group = {
                        token: dictEntry.name,
                        symbol: tokenSymbol,
                        chain: dictEntry.chain || item.chains[0],
                        items: [],
                        sources: new Set(),
                        officialCount: 0,
                        newsCount: 0,
                        socialCount: 0,
                        credibilitySum: 0,
                        latestPublishedAt: item.publishedAt,
                    };
                    groups.set(tokenSymbol, group);
                }

                group.items.push(item);
                group.sources.add(item.sourceId);
                group.credibilitySum += item.credibilityScore;
                if (item.publishedAt > group.latestPublishedAt) {
                    group.latestPublishedAt = item.publishedAt;
                }

                if (item.sourceTier === SourceTier.OFFICIAL) {
                    group.officialCount++;
                } else if (item.sourceTier === SourceTier.NEWS || item.sourceTier === SourceTier.RESEARCH) {
                    group.newsCount++;
                } else {
                    group.socialCount++;
                }
            }
        }

        const results: MemeTrend[] = [];
        const now = Date.now();

        for (const group of groups.values()) {
            const mentionCount = group.items.length;
            const uniqueSources = group.sources.size;
            const mentionVelocity = Number((mentionCount / hoursInWindow).toFixed(2));
            const avgCredibility = Math.round(group.credibilitySum / mentionCount);
            const latestMentionAgeMinutes = Math.max(0, Math.round((now - group.latestPublishedAt.getTime()) / 60000));

            const trendingScore = this.trendScoreService.calculateTrendScore({
                mentionVelocity,
                uniqueSources,
                avgCredibility,
                latestMentionAgeMinutes,
            });

            results.push({
                token: group.symbol,
                symbol: group.symbol,
                chain: group.chain,
                window,
                mentionCount,
                uniqueSources,
                officialMentions: group.officialCount,
                newsMentions: group.newsCount,
                socialMentions: group.socialCount,
                mentionVelocity,
                trendingScore,
                updatedAt: new Date(),
            });
        }

        // Sort by trendingScore descending
        return results.sort((a, b) => b.trendingScore - a.trendingScore);
    }

    /**
     * Aggregates all token trends for general crypto monitoring
     */
    async getTokenTrends(window: '1h' | '6h' | '24h' = '1h'): Promise<TokenTrend[]> {
        const windowMs = this.getWindowDurationMs(window);
        const hoursInWindow = windowMs / (60 * 60 * 1000);
        const currentItems = await this.repository.findRecentItemsForWindow(windowMs);

        // Previous window for change calculation
        const previousItems = await this.repository.findRecentItemsForWindow(windowMs * 2);
        const priorWindowItems = previousItems.filter((i) => i.publishedAt.getTime() < Date.now() - windowMs);

        const dictMap = new Map(this.tokenExtractor.getDictionary().map((d) => [d.symbol, d]));

        // Group counts in prior window
        const priorCounts = new Map<string, number>();
        for (const item of priorWindowItems) {
            for (const sym of item.tokens) {
                priorCounts.set(sym, (priorCounts.get(sym) || 0) + 1);
            }
        }

        // Group current window
        const groups = new Map<
            string,
            {
                symbol: string;
                name: string;
                isMeme: boolean;
                chain?: string;
                count: number;
                sources: Set<string>;
                credibilitySum: number;
                latestPublishedAt: Date;
            }
        >();

        for (const item of currentItems) {
            for (const sym of item.tokens) {
                const dictEntry = dictMap.get(sym);
                let group = groups.get(sym);
                if (!group) {
                    group = {
                        symbol: sym,
                        name: dictEntry?.name || sym,
                        isMeme: dictEntry?.isMeme || false,
                        chain: dictEntry?.chain || item.chains[0],
                        count: 0,
                        sources: new Set(),
                        credibilitySum: 0,
                        latestPublishedAt: item.publishedAt,
                    };
                    groups.set(sym, group);
                }

                group.count++;
                group.sources.add(item.sourceId);
                group.credibilitySum += item.credibilityScore;
                if (item.publishedAt > group.latestPublishedAt) {
                    group.latestPublishedAt = item.publishedAt;
                }
            }
        }

        const now = Date.now();
        const results: TokenTrend[] = [];

        for (const group of groups.values()) {
            const priorCount = priorCounts.get(group.symbol) || 0;
            const change1h = priorCount === 0 ? group.count * 100 : Math.round(((group.count - priorCount) / priorCount) * 100);
            const mentionVelocity = Number((group.count / hoursInWindow).toFixed(2));
            const avgCredibility = Math.round(group.credibilitySum / group.count);
            const latestMentionAgeMinutes = Math.max(0, Math.round((now - group.latestPublishedAt.getTime()) / 60000));

            const trendScore = this.trendScoreService.calculateTrendScore({
                mentionVelocity,
                uniqueSources: group.sources.size,
                avgCredibility,
                latestMentionAgeMinutes,
            });

            results.push({
                symbol: group.symbol,
                token: group.name,
                isMeme: group.isMeme,
                chain: group.chain,
                window,
                mentions1h: group.count,
                change1h,
                uniqueSources: group.sources.size,
                trendScore,
                updatedAt: new Date(),
            });
        }

        return results.sort((a, b) => b.trendScore - a.trendScore);
    }
}
