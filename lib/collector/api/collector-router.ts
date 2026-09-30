import { Hono } from 'hono';

import type { CollectorService } from '../collector.service';
import type { CryptoDigestScheduler, CryptoDigestService } from '../digest';
import type { AiNewsAnalyzer } from '../intelligence/ai-news-analyzer.interface';
import type { HotNewsService } from '../intelligence/hot-news/hot-news.service';
import type { LatestMarketIntelligenceService } from '../intelligence/latest/latest-market-intelligence.service';
import {
    createFeedsRoutes,
    createIntelligenceRoutes,
    createNotificationsRoutes,
    createOperationsRoutes,
    createTrendsRoutes,
    createXRoutes,
} from '../modules';
import type { NotificationModule } from '../notifications/notification.module';
import type { FeedSchedulerService } from '../scheduler/feed-scheduler.service';
import type { FeedSourceService } from '../sources/feed-source.service';
import type { IFeedRepository } from '../storage/feed-repository.interface';
import type { TokenTrendService } from '../trends/token-trend.service';

export interface CollectorRouterDependencies {
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
    latestIntelligenceService?: LatestMarketIntelligenceService;
}

export const createCollectorRouter = (dependencies: CollectorRouterDependencies) => {
    const router = new Hono();

    router.route('/', createFeedsRoutes(dependencies));
    router.route('/', createTrendsRoutes(dependencies));
    router.route('/', createXRoutes(dependencies));
    router.route('/', createOperationsRoutes(dependencies));
    router.route('/', createNotificationsRoutes(dependencies));
    router.route('/', createIntelligenceRoutes(dependencies));

    return router;
};
