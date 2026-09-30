import type { CollectorService } from '../../collector.service';
import type { AiNewsAnalyzer } from '../../intelligence/ai-news-analyzer.interface';
import { LatestMarketIntelligenceService } from '../../intelligence/latest/latest-market-intelligence.service';
import type { LatestMarketIntelligenceResponse } from '../../intelligence/types';
import type { NotificationModule } from '../../notifications/notification.module';
import type { FeedSourceService } from '../../sources/feed-source.service';
import type { IFeedRepository } from '../../storage/feed-repository.interface';
import type { FeedFilterOptions, VerificationStatus, XEventType } from '../../types';
import { formatFeedItem } from './feeds.mapper';

export interface FeedsModuleDependencies {
    repository: IFeedRepository;
    sourceService: FeedSourceService;
    collectorService: CollectorService;
    notificationModule?: NotificationModule;
    aiAnalyzer?: AiNewsAnalyzer;
    latestIntelligenceService?: LatestMarketIntelligenceService;
}

export class FeedsService {
    private readonly repository: IFeedRepository;
    private readonly latestService: LatestMarketIntelligenceService;

    constructor(dependencies: FeedsModuleDependencies) {
        this.repository = dependencies.repository;
        this.latestService =
            dependencies.latestIntelligenceService ??
            new LatestMarketIntelligenceService({
                repository: dependencies.repository,
                sourceService: dependencies.sourceService,
                collectorService: dependencies.collectorService,
                notificationModule: dependencies.notificationModule,
                aiAnalyzer: dependencies.aiAnalyzer,
            });
    }

    async searchFeeds(filterOptions: FeedFilterOptions) {
        const { items, total } = await this.repository.findItems(filterOptions);
        const limit = filterOptions.limit ?? 20;
        const offset = filterOptions.offset ?? 0;

        return {
            items: items.map(formatFeedItem),
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + items.length < total,
            },
        };
    }

    async getBreaking(limit: number) {
        const items = await this.repository.findBreaking(limit);
        return {
            items: items.map(formatFeedItem),
        };
    }

    async getLatestIntelligence(options: { limit: number; raw: boolean; forceRefresh: boolean; shouldNotify: boolean }) {
        const result = await this.latestService.getLatestIntelligence({
            limit: options.limit,
            raw: options.raw,
            forceRefresh: options.forceRefresh,
        });

        if (!options.raw && options.shouldNotify && 'items' in result) {
            const notifStatus = await this.latestService.sendLatestNotification(options.limit, result as LatestMarketIntelligenceResponse);
            (result as LatestMarketIntelligenceResponse).notification = notifStatus;
        }

        return result;
    }

    async getLatestRaw(limit: number) {
        const items = await this.repository.findLatest(limit);
        return {
            items: items.map(formatFeedItem),
        };
    }

    async sendLatestNotification(limit: number) {
        return this.latestService.sendLatestNotification(limit);
    }

    async getMarketEvents(options: { limit: number; verificationStatus?: VerificationStatus; eventType?: XEventType }) {
        let { items } = await this.repository.findItems({
            category: 'MARKET',
            verificationStatus: options.verificationStatus,
            eventType: options.eventType,
            limit: options.limit,
        });

        if (items.length === 0 && (options.verificationStatus || options.eventType)) {
            const fallback = await this.repository.findItems({
                verificationStatus: options.verificationStatus,
                eventType: options.eventType,
                limit: options.limit,
            });
            items = fallback.items;
        }

        return {
            items: items.map(formatFeedItem),
        };
    }
}
