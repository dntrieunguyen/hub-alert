import logger from '@/utils/logger';

import { RSSHubClientService } from './client/rsshub-client.service';
import { FeedDeduplicationService } from './deduplication/feed-deduplication.service';
import { ChainExtractorService } from './extraction/chain-extractor.service';
import { TokenExtractorService } from './extraction/token-extractor.service';
import { TopicExtractorService } from './extraction/topic-extractor.service';
import { FeedNormalizerService } from './normalize/feed-normalizer.service';
import { BreakingNewsService } from './scoring/breaking-news.service';
import { CredibilityScoreService } from './scoring/credibility-score.service';
import { MarketImpactScoreService } from './scoring/market-impact-score.service';
import { MarketEventService } from './notifications/events/market-event.service';
import type { NotificationModule } from './notifications/notification.module';
import type { IFeedRepository } from './storage/feed-repository.interface';
import type { CryptoFeedItem, FeedSource } from './types';
import {
    XEventAggregatorService,
    XEventDetectorService,
    XPostNormalizerService,
    XVerificationService,
    type XSource,
} from './x';

export interface ProcessFeedResult {
    sourceId: string;
    received: number;
    created: number;
    duplicates: number;
    durationMs: number;
    items: CryptoFeedItem[];
}

export class CollectorService {
    private client: RSSHubClientService;
    private normalizer: FeedNormalizerService;
    private deduplication: FeedDeduplicationService;
    private tokenExtractor: TokenExtractorService;
    private topicExtractor: TopicExtractorService;
    private chainExtractor: ChainExtractorService;
    private credibilityService: CredibilityScoreService;
    private impactService: MarketImpactScoreService;
    private breakingService: BreakingNewsService;
    private repository: IFeedRepository;
    private notificationModule?: NotificationModule;
    private marketEventService: MarketEventService;
    private xNormalizer: XPostNormalizerService;
    private xVerification: XVerificationService;
    private xEventDetector: XEventDetectorService;
    private xEventAggregator: XEventAggregatorService;

    constructor(
        repository: IFeedRepository,
        options: {
            client?: RSSHubClientService;
            normalizer?: FeedNormalizerService;
            deduplication?: FeedDeduplicationService;
            tokenExtractor?: TokenExtractorService;
            topicExtractor?: TopicExtractorService;
            chainExtractor?: ChainExtractorService;
            credibilityService?: CredibilityScoreService;
            impactService?: MarketImpactScoreService;
            breakingService?: BreakingNewsService;
            notificationModule?: NotificationModule;
            marketEventService?: MarketEventService;
            xNormalizer?: XPostNormalizerService;
            xVerification?: XVerificationService;
            xEventDetector?: XEventDetectorService;
            xEventAggregator?: XEventAggregatorService;
        } = {}
    ) {
        this.repository = repository;
        this.client = options.client ?? new RSSHubClientService();
        this.normalizer = options.normalizer ?? new FeedNormalizerService();
        this.deduplication = options.deduplication ?? new FeedDeduplicationService();
        this.tokenExtractor = options.tokenExtractor ?? new TokenExtractorService();
        this.topicExtractor = options.topicExtractor ?? new TopicExtractorService();
        this.chainExtractor = options.chainExtractor ?? new ChainExtractorService();
        this.credibilityService = options.credibilityService ?? new CredibilityScoreService();
        this.impactService = options.impactService ?? new MarketImpactScoreService();
        this.breakingService = options.breakingService ?? new BreakingNewsService();
        this.notificationModule = options.notificationModule;
        this.marketEventService = options.marketEventService ?? new MarketEventService();
        this.xNormalizer = options.xNormalizer ?? new XPostNormalizerService();
        this.xVerification = options.xVerification ?? new XVerificationService();
        this.xEventDetector = options.xEventDetector ?? new XEventDetectorService();
        this.xEventAggregator = options.xEventAggregator ?? new XEventAggregatorService();
    }

    public getXEventAggregator(): XEventAggregatorService {
        return this.xEventAggregator;
    }

    /**
     * Executes the full collection, normalization, extraction, scoring, deduplication and persistence pipeline for a source.
     */
    async collectAndProcessSource(source: FeedSource): Promise<ProcessFeedResult> {
        const start = Date.now();
        const fetchResult = await this.client.fetchFeed(source);
        const rawItems = fetchResult.feed.items || [];

        // Fetch recent items for cross-source confirmation window
        const recentItems = await this.repository.findRecentItemsForWindow(15 * 60 * 1000);

        let createdCount = 0;
        let duplicateCount = 0;
        const newProcessedItems: CryptoFeedItem[] = [];

        for (const raw of rawItems) {
            const tempTitle = this.normalizer.cleanText(raw.title || '');
            const tempUrl = this.normalizer.normalizeUrl(raw.link || '');
            const fingerprint = this.deduplication.generateFingerprint(tempTitle, tempUrl, raw.guid || raw.id);

            // Step 1: Check deduplication
            if (this.deduplication.isDuplicate(fingerprint) || (await this.repository.hasFingerprint(fingerprint))) {
                duplicateCount++;
                continue;
            }

            // Step 2: Normalize
            const item = this.normalizer.normalizeItem(raw, source, fingerprint);

            // Step 3: Entity, Token, Topic and Chain Extraction
            const fullSearchText = `${item.title} ${item.summary || ''} ${item.content || ''}`;

            const tokenResult = this.tokenExtractor.extract(fullSearchText);
            item.tokens = tokenResult.tokens;
            item.symbols = tokenResult.symbols;

            item.topics = this.topicExtractor.extractTopics(fullSearchText);
            item.chains = this.chainExtractor.extractChains(fullSearchText);

            // Inherit chain from token dictionary if available
            for (const entry of tokenResult.entries) {
                if (entry.chain && !item.chains.includes(entry.chain)) {
                    item.chains.push(entry.chain);
                }
            }

            // Step 3.5: X / Twitter Intelligence Processing
            if (source.platform === 'X') {
                const rawContent = `${raw.content || raw.summary || ''}`;
                const linkAnalysis = this.xNormalizer.extractLinkAnalysis(fullSearchText, source.officialDomain);
                const structure = this.xNormalizer.parsePostStructure(raw.title || '', rawContent, item.url, source.handle || '');

                const xSource = source as unknown as XSource;
                const verification = this.xVerification.verifyPost(xSource, linkAnalysis, item.publishedAt);
                const detectedEvent = this.xEventDetector.detectEvent(fullSearchText, xSource, item.tokens, verification.status);

                item.platform = 'X';
                item.handle = structure.canonicalHandle || source.handle;
                item.xSourceType = source.xSourceType;
                item.xMetadata = {
                    postId: structure.postId,
                    handle: item.handle || '',
                    postUrl: item.url,
                    isReply: structure.isReply,
                    isRepost: structure.isRepost,
                    isQuote: structure.isQuote,
                    quotedPostId: structure.quotedPostId,
                    canonicalHandle: structure.canonicalHandle,
                    linkedDomains: linkAnalysis.linkedDomains,
                    hasPrimarySourceLink: linkAnalysis.hasPrimarySourceLink,
                    verificationStatus: verification.status,
                };

                item.metadata = {
                    ...(item.metadata || {}),
                    eventType: detectedEvent.eventType,
                    eventReason: detectedEvent.reason,
                    verificationStatus: verification.status,
                    speaker: verification.speaker,
                    role: verification.role,
                    isEnactedPolicy: verification.isEnactedPolicy,
                };

                // Record mentions into rolling aggregator
                for (const token of item.tokens) {
                    this.xEventAggregator.recordMention(
                        token,
                        {
                            handle: source.handle || source.id,
                            displayName: source.name,
                            sourceType: (source.xSourceType as any) || 'GENERAL',
                        },
                        item.url,
                        detectedEvent.impactScore,
                        item.publishedAt
                    );
                }
            }

            // Step 4: Scoring
            item.credibilityScore = this.credibilityService.calculateScore(source);
            if (source.platform === 'X' && item.metadata?.eventType) {
                // Keep the domain-specific X impact score
            } else {
                item.impactScore = this.impactService.calculateImpactScore(item);
            }
            item.breaking = this.breakingService.evaluateBreaking(item, recentItems);

            // Step 5: Persist
            const isSaved = await this.repository.saveItem(item);
            if (isSaved) {
                this.deduplication.markSeen(fingerprint);
                createdCount++;
                newProcessedItems.push(item);

                // Step 6: Non-blocking Notification Dispatch
                if (this.notificationModule) {
                    const marketEvent = this.marketEventService.createFromFeedItem(item);
                    this.notificationModule.handleMarketEvent(marketEvent).catch((err) => {
                        logger.warn(`[notification.dispatch.error] ${err?.message}`);
                    });
                }
            } else {
                duplicateCount++;
            }
        }

        const durationMs = Date.now() - start;

        logger.info(
            JSON.stringify({
                event: 'feed.collect.completed',
                source: source.id,
                received: rawItems.length,
                created: createdCount,
                duplicate: duplicateCount,
                durationMs,
            })
        );

        return {
            sourceId: source.id,
            received: rawItems.length,
            created: createdCount,
            duplicates: duplicateCount,
            durationMs,
            items: newProcessedItems,
        };
    }
}
