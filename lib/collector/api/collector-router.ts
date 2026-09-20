import { Hono } from 'hono';

import type { CollectorService } from '../collector.service';
import type { CryptoDigestScheduler, CryptoDigestService } from '../digest';
import type { AiNewsAnalyzer } from '../intelligence/ai-news-analyzer.interface';
import type { HotNewsService } from '../intelligence/hot-news/hot-news.service';
import type { NotificationModule } from '../notifications/notification.module';
import type { FeedSchedulerService } from '../scheduler/feed-scheduler.service';
import type { FeedSourceService } from '../sources/feed-source.service';
import type { IFeedRepository } from '../storage/feed-repository.interface';
import type { TokenTrendService } from '../trends/token-trend.service';
import type { CryptoFeedItem, FeedCategory, FeedFilterOptions, SourceTier, VerificationStatus, XEventType, XSourceType } from '../types';
import { INITIAL_X_SOURCES } from '../x';

export const createCollectorRouter = (dependencies: {
    repository: IFeedRepository;
    trendService: TokenTrendService;
    sourceService: FeedSourceService;
    collectorService: CollectorService;
    scheduler?: FeedSchedulerService;
    notificationModule?: NotificationModule;
    digestService?: CryptoDigestService;
    digestScheduler?: CryptoDigestScheduler;
    aiAnalyzer?: AiNewsAnalyzer;
    hotNewsService?: HotNewsService;
}) => {
    const { repository, trendService, sourceService, collectorService, scheduler, notificationModule, digestService, digestScheduler, aiAnalyzer, hotNewsService } = dependencies;
    const router = new Hono();

    // Helper to format item to requested response shape
    const formatFeedItem = (item: CryptoFeedItem) => ({
        id: item.id,
        externalId: item.externalId,
        title: item.title,
        summary: item.summary,
        url: item.url,
        author: item.author,
        source: {
            id: item.sourceId,
            name: item.sourceName,
            tier: item.sourceTier,
            credibilityScore: item.credibilityScore,
        },
        category: item.category,
        tokens: item.tokens,
        symbols: item.symbols,
        chains: item.chains,
        topics: item.topics,
        publishedAt: item.publishedAt.toISOString(),
        collectedAt: item.collectedAt.toISOString(),
        breaking: item.breaking,
        impactScore: item.impactScore,
        platform: item.platform,
        handle: item.handle,
        xSourceType: item.xSourceType,
        xMetadata: item.xMetadata,
        metadata: item.metadata,
    });

    /**
     * GET /feeds
     * Comprehensive feed search with multi-parameter filtering
     */
    router.get('/feeds', async (c) => {
        const query = c.req.query();
        const category = query.category as FeedCategory | undefined;
        const sourceId = query.source;
        const sourceTier = query.sourceTier as SourceTier | undefined;
        const token = query.token;
        const topic = query.topic;
        const breaking = query.breaking !== undefined ? query.breaking === 'true' : undefined;
        const minCredibility = query.minCredibility ? Number.parseInt(query.minCredibility, 10) : undefined;
        const from = query.from ? new Date(query.from) : undefined;
        const to = query.to ? new Date(query.to) : undefined;
        const limit = Math.min(100, Number.parseInt(query.limit || '20', 10));
        const offset = Number.parseInt(query.offset || '0', 10);
        const platform = query.platform as 'RSS' | 'X' | undefined;
        const xSourceType = (query.sourceType || query.xSourceType) as XSourceType | undefined;
        const handle = query.handle;
        const verificationStatus = query.verification as VerificationStatus | undefined;
        const eventType = query.type as XEventType | undefined;

        const filterOptions: FeedFilterOptions = {
            category,
            sourceId,
            sourceTier,
            token,
            topic,
            breaking,
            minCredibility,
            from,
            to,
            limit,
            offset,
            platform,
            xSourceType,
            handle,
            verificationStatus,
            eventType,
        };

        const { items, total } = await repository.findItems(filterOptions);

        return c.json({
            items: items.map(formatFeedItem),
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + items.length < total,
            },
        });
    });

    /**
     * GET /feeds/latest
     */
    router.get('/feeds/latest', async (c) => {
        const limit = Math.min(100, Number.parseInt(c.req.query('limit') || '20', 10));
        const items = await repository.findLatest(limit);
        return c.json({
            items: items.map(formatFeedItem),
        });
    });

    /**
     * GET /feeds/breaking
     */
    router.get('/feeds/breaking', async (c) => {
        const limit = Math.min(100, Number.parseInt(c.req.query('limit') || '20', 10));
        const items = await repository.findBreaking(limit);
        return c.json({
            items: items.map(formatFeedItem),
        });
    });

    /**
     * GET /trends/tokens
     */
    router.get('/trends/tokens', async (c) => {
        const window = (c.req.query('window') as '1h' | '6h' | '24h') || '1h';
        const trends = await trendService.getTokenTrends(window);
        return c.json(trends);
    });

    /**
     * GET /trends/memes
     */
    router.get('/trends/memes', async (c) => {
        const window = (c.req.query('window') as '1h' | '6h' | '24h') || '1h';
        const trends = await trendService.getMemeTrends(window);
        return c.json(trends);
    });

    /**
     * GET /market/events
     */
    router.get('/market/events', async (c) => {
        const query = c.req.query();
        const limit = Math.min(100, Number.parseInt(query.limit || '20', 10));
        const verificationStatus = query.verification as VerificationStatus | undefined;
        const eventType = query.type as XEventType | undefined;

        let { items } = await repository.findItems({
            category: 'MARKET',
            verificationStatus,
            eventType,
            limit,
        });

        if (items.length === 0 && (verificationStatus || eventType)) {
            const fallback = await repository.findItems({
                verificationStatus,
                eventType,
                limit,
            });
            items = fallback.items;
        }

        return c.json({
            items: items.map(formatFeedItem),
        });
    });

    /**
     * GET /x/sources
     */
    router.get('/x/sources', (c) => {
        const query = c.req.query();
        let sources = INITIAL_X_SOURCES;
        if (query.type) {
            sources = sources.filter((s) => s.sourceType === query.type);
        }
        if (query.priority) {
            sources = sources.filter((s) => s.priority === query.priority);
        }
        return c.json({
            count: sources.length,
            sources,
        });
    });

    /**
     * GET /x/aggregations
     */
    router.get('/x/aggregations', (c) => {
        const symbol = c.req.query('symbol');
        const aggregator = collectorService.getXEventAggregator();
        if (symbol) {
            const agg = aggregator.getAggregation(symbol);
            return c.json({ aggregation: agg });
        }
        const aggregations = aggregator.getAllAggregations();
        return c.json({ count: aggregations.length, aggregations });
    });

    /**
     * GET /sources
     */
    router.get('/sources', (c) => {
        const sources = sourceService.getAllSources();
        return c.json({
            count: sources.length,
            sources,
        });
    });

    /**
     * POST /sources/:id/collect (Manual trigger)
     */
    router.post('/sources/:id/collect', async (c) => {
        const sourceId = c.req.param('id');
        const source = sourceService.getSourceById(sourceId);
        if (!source) {
            return c.json({ error: `Source not found: ${sourceId}` }, 404);
        }

        try {
            const result = await collectorService.collectAndProcessSource(source);
            sourceService.recordSuccess(sourceId);
            return c.json(result);
        } catch (error: any) {
            sourceService.recordFailure(sourceId, error.message, error.statusCode);
            return c.json({ error: error.message }, 500);
        }
    });

    /**
     * GET /scheduler/status
     */
    router.get('/scheduler/status', (c) => {
        if (!scheduler) {
            return c.json({ error: 'Scheduler service not configured' }, 503);
        }
        return c.json(scheduler.getStatus());
    });

    /**
     * POST /scheduler/start
     */
    router.post('/scheduler/start', (c) => {
        if (!scheduler) {
            return c.json({ error: 'Scheduler service not configured' }, 503);
        }
        scheduler.start();
        return c.json({ message: 'Scheduler started', status: scheduler.getStatus() });
    });

    /**
     * POST /scheduler/stop
     */
    router.post('/scheduler/stop', (c) => {
        if (!scheduler) {
            return c.json({ error: 'Scheduler service not configured' }, 503);
        }
        scheduler.stop();
        return c.json({ message: 'Scheduler stopped', status: scheduler.getStatus() });
    });

    /**
     * POST /notifications/google-chat/test
     * Safe development/manual test endpoint
     */
    router.post('/notifications/google-chat/test', async (c) => {
        if (!notificationModule) {
            return c.json({ error: 'Notification module not configured' }, 503);
        }
        let body: any = {};
        try {
            body = await c.req.json();
        } catch {
            // Body is optional
        }
        const result = await notificationModule.sendManualTestMessage(body?.message);
        if (!result.success) {
            return c.json(result, 400);
        }
        return c.json(result);
    });

    /**
     * GET /notifications/health
     */
    router.get('/notifications/health', (c) => {
        if (!notificationModule) {
            return c.json({ googleChat: { enabled: false, configured: false } });
        }
        return c.json(notificationModule.getHealthStatus());
    });

    /**
     * POST /digest/trigger
     * Manually triggers Top 10 digest generation & send
     * Supports ?dryRun=true or JSON body { dryRun: boolean, forceSend: boolean }
     */
    router.post('/digest/trigger', async (c) => {
        const activeDigest = digestService || notificationModule?.digestService;
        if (!activeDigest) {
            return c.json({ error: 'Crypto digest service not available' }, 503);
        }

        const dryRunQuery = c.req.query('dryRun');
        let body: any = {};
        try {
            body = await c.req.json();
        } catch {
            // Optional body
        }

        const dryRun = dryRunQuery === 'true' || dryRunQuery === '1' || Boolean(body.dryRun);
        const forceSend = Boolean(body.forceSend);

        const result = await activeDigest.generateAndSendDigest({ dryRun, forceSend });
        if (!result.success && result.error) {
            return c.json(result, 500);
        }
        return c.json(result);
    });

    /**
     * GET /digest/preview
     * Preview current Top 10 digest without dispatching to Google Chat
     */
    router.get('/digest/preview', async (c) => {
        const activeDigest = digestService || notificationModule?.digestService;
        if (!activeDigest) {
            return c.json({ error: 'Crypto digest service not available' }, 503);
        }

        const result = await activeDigest.generateAndSendDigest({ dryRun: true });
        return c.json(result);
    });

    /**
     * GET /digest/history
     * Returns history of digest deliveries
     */
    router.get('/digest/history', async (c) => {
        const activeDigest = digestService || notificationModule?.digestService;
        if (!activeDigest) {
            return c.json({ error: 'Crypto digest service not available' }, 503);
        }

        const limitStr = c.req.query('limit');
        const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;
        const history = await activeDigest.deliveryRepository.getDeliveryHistory(limit);
        return c.json({ history });
    });

    /**
     * GET /digest/status
     * Returns current digest scheduler status and configuration
     */
    router.get('/digest/status', (c) => {
        const activeDigest = digestService || notificationModule?.digestService;
        const activeScheduler = digestScheduler || notificationModule?.digestScheduler;

        return c.json({
            config: activeDigest?.configService.getConfig(),
            scheduler: activeScheduler?.getStatus(),
        });
    });

    /**
     * GET /ai/status
     * Returns AI Analyzer & Hot News configuration status (sanitized)
     */
    router.get('/ai/status', (c) => {
        const analyzerConfig = (aiAnalyzer as any)?.getConfig?.();
        return c.json({
            ai: {
                provider: aiAnalyzer?.providerName || 'none',
                enabled: analyzerConfig?.enabled ?? false,
                model: analyzerConfig?.model,
                language: analyzerConfig?.language,
                maxCandidates: analyzerConfig?.maxCandidates,
                hotNewsEnabled: analyzerConfig?.hotNewsEnabled,
                hotNewsMinCredibility: analyzerConfig?.hotNewsMinCredibility,
                hotNewsMinImpactScore: analyzerConfig?.hotNewsMinImpactScore,
                hotNewsMinConfidence: analyzerConfig?.hotNewsMinConfidence,
            },
        });
    });

    return router;
};
