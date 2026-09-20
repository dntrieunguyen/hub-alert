import { createCollectorRouter } from './api/collector-router';
import { RSSHubClientService } from './client/rsshub-client.service';
import { CollectorService } from './collector.service';
import { FeedDeduplicationService } from './deduplication/feed-deduplication.service';
import { CryptoDigestScheduler, CryptoDigestService } from './digest';
import { ChainExtractorService } from './extraction/chain-extractor.service';
import { TokenExtractorService } from './extraction/token-extractor.service';
import { TopicExtractorService } from './extraction/topic-extractor.service';
import {
    type AiNewsAnalyzer,
    AiProviderFactory,
    HotNewsPolicyService,
    HotNewsService,
} from './intelligence';
import { FeedNormalizerService } from './normalize/feed-normalizer.service';
import { NotificationModule } from './notifications/notification.module';
import { RssParserService } from './parser/rss-parser.service';
import { FeedSchedulerService } from './scheduler/feed-scheduler.service';
import { BreakingNewsService } from './scoring/breaking-news.service';
import { CredibilityScoreService } from './scoring/credibility-score.service';
import { MarketImpactScoreService } from './scoring/market-impact-score.service';
import { TrendScoreService } from './scoring/trend-score.service';
import { FeedSourceService } from './sources/feed-source.service';
import { buildInitialSources } from './sources/feed-sources.config';
import { InMemoryFeedRepository } from './storage/in-memory-feed.repository';
import { TokenTrendService } from './trends/token-trend.service';

export * from './api/collector-router';
export * from './client/rsshub-client.service';
export * from './collector.service';
export * from './deduplication/feed-deduplication.service';
export * from './digest';
export * from './extraction/chain-extractor.service';
export * from './extraction/token-dictionary';
export * from './extraction/token-extractor.service';
export * from './extraction/topic-extractor.service';
export * from './intelligence';
export * from './normalize/feed-normalizer.service';
export * from './notifications';
export * from './parser/rss-parser.service';
export * from './scheduler/feed-scheduler.service';
export * from './scoring/breaking-news.service';
export * from './scoring/credibility-score.service';
export * from './scoring/market-impact-score.service';
export * from './scoring/trend-score.service';
export * from './sources/feed-source.service';
export * from './sources/feed-sources.config';
export * from './storage/feed-repository.interface';
export * from './storage/in-memory-feed.repository';
export * from './trends/token-trend.service';
export * from './types';

export interface CollectorModule {
    repository: InMemoryFeedRepository;
    sourceService: FeedSourceService;
    collectorService: CollectorService;
    trendService: TokenTrendService;
    scheduler: FeedSchedulerService;
    digestService: CryptoDigestService;
    digestScheduler: CryptoDigestScheduler;
    notificationModule: NotificationModule;
    aiAnalyzer: AiNewsAnalyzer;
    hotNewsService: HotNewsService;
    router: ReturnType<typeof createCollectorRouter>;
}

export const createCollectorModule = (): CollectorModule => {
    const repository = new InMemoryFeedRepository();
    const sourceService = new FeedSourceService(buildInitialSources());
    const parserService = new RssParserService();
    const client = new RSSHubClientService(parserService);
    const normalizer = new FeedNormalizerService();
    const deduplication = new FeedDeduplicationService();
    const tokenExtractor = new TokenExtractorService();
    const topicExtractor = new TopicExtractorService();
    const chainExtractor = new ChainExtractorService();
    const credibilityService = new CredibilityScoreService();
    const impactService = new MarketImpactScoreService();
    const breakingService = new BreakingNewsService();
    const trendScoreService = new TrendScoreService();
    const notificationModule = new NotificationModule();

    // AI Provider & Hot News initialization
    const aiAnalyzer = AiProviderFactory.createAnalyzer();
    const hotNewsPolicyService = new HotNewsPolicyService();
    const hotNewsService = new HotNewsService(aiAnalyzer, {
        policyService: hotNewsPolicyService,
        notificationService: notificationModule.notificationService,
        deliveryRepository: notificationModule.deliveryRepository,
    });
    notificationModule.setHotNewsService(hotNewsService);

    const collectorService = new CollectorService(repository, {
        client,
        normalizer,
        deduplication,
        tokenExtractor,
        topicExtractor,
        chainExtractor,
        credibilityService,
        impactService,
        breakingService,
        notificationModule,
    });

    const trendService = new TokenTrendService(repository, tokenExtractor, trendScoreService);
    const scheduler = new FeedSchedulerService(sourceService, collectorService);

    // Initialize Digest Service and Scheduler
    const digestService = new CryptoDigestService(repository, {
        trendService,
        notificationService: notificationModule.notificationService,
        aiAnalyzer,
    });
    const digestScheduler = new CryptoDigestScheduler(digestService);

    // Link digest service to notification module
    notificationModule.setDigestServices(digestService, digestScheduler);

    const router = createCollectorRouter({
        repository,
        trendService,
        sourceService,
        collectorService,
        scheduler,
        notificationModule,
        digestService,
        digestScheduler,
        aiAnalyzer,
        hotNewsService,
    });

    return {
        repository,
        sourceService,
        collectorService,
        trendService,
        scheduler,
        digestService,
        digestScheduler,
        notificationModule,
        aiAnalyzer,
        hotNewsService,
        router,
    };
};
