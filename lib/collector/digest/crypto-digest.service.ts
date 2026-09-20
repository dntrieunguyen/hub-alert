import logger from '@/utils/logger';
import type { IFeedRepository } from '../storage/feed-repository.interface';
import { MarketEventService } from '../notifications/events/market-event.service';
import type { GoogleChatNotificationService } from '../notifications/google-chat/google-chat-notification.service';
import { MarketEventType } from '../notifications/types';
import type { TokenTrendService } from '../trends/token-trend.service';
import { CryptoDigestConfigService } from './crypto-digest-config.service';
import { CryptoDigestFormatterService } from './crypto-digest-formatter.service';
import { CryptoDigestRankingService } from './crypto-digest-ranking.service';
import { CryptoDigestScheduler } from './crypto-digest-scheduler';
import { CryptoDigestSelectionService } from './crypto-digest-selection.service';
import { CryptoDigestSummaryService } from './crypto-digest-summary.service';
import { InMemoryDigestDeliveryRepository } from './storage/in-memory-digest-delivery.repository';
import type { AiNewsAnalyzer } from '../intelligence/ai-news-analyzer.interface';
import {
    type AggregatedMarketEvent,
    type DigestConfig,
    DigestDeliveryStatus,
    type DigestPayload,
    type DigestTrendingToken,
    type MarketSnapshotSection,
} from './types';

import { isCryptoMarketRelevant, isValidTitle } from './crypto-digest-relevance.service';
import { detectGenericFiller, validateVietnameseOutput } from './crypto-digest-vietnamese-validator';

export class CryptoDigestService {
    readonly configService: CryptoDigestConfigService;
    readonly rankingService: CryptoDigestRankingService;
    readonly selectionService: CryptoDigestSelectionService;
    readonly summaryService: CryptoDigestSummaryService;
    readonly formatterService: CryptoDigestFormatterService;
    readonly deliveryRepository: InMemoryDigestDeliveryRepository;

    private feedRepository: IFeedRepository;
    private marketEventService: MarketEventService;
    private notificationService?: GoogleChatNotificationService;
    private trendService?: TokenTrendService;
    private aiAnalyzer?: AiNewsAnalyzer;

    constructor(
        feedRepository: IFeedRepository,
        options: {
            configService?: CryptoDigestConfigService;
            rankingService?: CryptoDigestRankingService;
            selectionService?: CryptoDigestSelectionService;
            summaryService?: CryptoDigestSummaryService;
            formatterService?: CryptoDigestFormatterService;
            deliveryRepository?: InMemoryDigestDeliveryRepository;
            marketEventService?: MarketEventService;
            notificationService?: GoogleChatNotificationService;
            trendService?: TokenTrendService;
            aiAnalyzer?: AiNewsAnalyzer;
        } = {}
    ) {
        this.feedRepository = feedRepository;
        this.configService = options.configService ?? new CryptoDigestConfigService();
        this.rankingService = options.rankingService ?? new CryptoDigestRankingService();
        this.selectionService = options.selectionService ?? new CryptoDigestSelectionService(this.rankingService);
        this.summaryService = options.summaryService ?? new CryptoDigestSummaryService();
        this.formatterService = options.formatterService ?? new CryptoDigestFormatterService();
        this.deliveryRepository = options.deliveryRepository ?? new InMemoryDigestDeliveryRepository();
        this.marketEventService = options.marketEventService ?? new MarketEventService();
        this.notificationService = options.notificationService;
        this.trendService = options.trendService;
        this.aiAnalyzer = options.aiAnalyzer;

        this.configService.logStartup();
    }

    setNotificationService(service: GoogleChatNotificationService): void {
        this.notificationService = service;
    }

    setTrendService(service: TokenTrendService): void {
        this.trendService = service;
    }

    setAiAnalyzer(analyzer: AiNewsAnalyzer): void {
        this.aiAnalyzer = analyzer;
    }

    /**
     * Executes the complete Top 10 digest workflow:
     * Idempotency Check -> Collect -> Aggregate -> Rank -> Select Top 10 -> Summarize -> Quality Validate -> Send
     */
    async generateAndSendDigest(options: { dryRun?: boolean; forceSend?: boolean } = {}): Promise<{
        success: boolean;
        itemCount: number;
        previewText?: string;
        message?: string;
        error?: string;
    }> {
        const config = this.configService.getConfig();

        if (!config.enabled && !options.forceSend) {
            logger.info('[crypto-digest.skipped] Digest is disabled in configuration');
            return { success: false, itemCount: 0, message: 'Digest disabled' };
        }

        const windowTo = new Date();
        const latestDelivery = await this.deliveryRepository.getLatestSuccessfulDelivery();
        const windowFrom = CryptoDigestScheduler.computeWindowFrom(
            windowTo,
            config.timezone,
            config.fallbackLookbackHours,
            latestDelivery?.sentAt
        );
        const periodHours = Math.max(1, Math.round((windowTo.getTime() - windowFrom.getTime()) / (1000 * 60 * 60)));

        // Compute Slot Key for Idempotency Locking (Section 16: digest:{date}:{slot})
        const timeParts = CryptoDigestScheduler.getVietnamTimeParts(windowTo, config.timezone);
        const slotHour = timeParts.hour;
        let slotName = '17:00';
        if (slotHour >= 5 && slotHour < 11) {
            slotName = '05:00';
        } else if (slotHour >= 11 && slotHour < 17) {
            slotName = '11:00';
        }
        const dateStr = `${timeParts.year}-${String(timeParts.month).padStart(2, '0')}-${String(timeParts.day).padStart(2, '0')}`;
        const slotKey = `digest:${dateStr}:${slotName}`;

        // If not dry run and not force send, prevent duplicate sends for the same slot
        if (!options.dryRun && !options.forceSend) {
            const existingSlotDelivery = await this.deliveryRepository.getDeliveryForSlot(slotKey);
            if (existingSlotDelivery) {
                logger.warn(`[crypto-digest.slot_locked] Digest for slot ${slotKey} was already sent. Skipping duplicate dispatch.`);
                return {
                    success: true,
                    itemCount: existingSlotDelivery.itemCount,
                    previewText: existingSlotDelivery.previewText,
                    message: `Digest for slot ${slotKey} was already delivered`,
                };
            }
        }

        logger.info(
            `[crypto-digest.started] Building digest for lookback window ${windowFrom.toISOString()} -> ${windowTo.toISOString()} (${periodHours}h in ${config.timezone}, slot: ${slotKey})`
        );

        // 1. Query candidate items from repository up to maxScanItems for candidate replenishment
        const maxScan = config.maxScanItems || 300;
        const { items: rawFeedItems } = await this.feedRepository.findItems({
            from: windowFrom,
            to: windowTo,
            minCredibility: Math.min(config.minCredibility, 60), // Query broader so cross-source aggregator has context
            limit: maxScan,
        });

        // 2. Convert to MarketEvents
        const marketEvents = rawFeedItems.map((item) => this.marketEventService.createFromFeedItem(item));

        // 3. Retrieve previously delivered fingerprints to prevent duplicates
        const deliveredFingerprints = await this.deliveryRepository.getDeliveredFingerprints();

        // 4. Run selection pipeline (Pre-filter, Deduplicate, Replenish candidates, AI analysis, Diversity, Limit <= 10)
        const topItems = await this.selectionService.selectDigestEvents(
            marketEvents,
            config,
            deliveredFingerprints,
            this.aiAnalyzer
        );

        // 5. Check if quality threshold met
        if (topItems.length === 0) {
            logger.info('[crypto-digest.empty] No high quality items met the threshold in the current window. Skipping digest dispatch.');
            await this.deliveryRepository.recordDelivery({
                slotKey,
                windowFrom,
                windowTo,
                itemCount: 0,
                eventIds: [],
                eventFingerprints: [],
                status: DigestDeliveryStatus.SKIPPED_EMPTY,
            });
            return { success: true, itemCount: 0, message: 'No items met the quality threshold in current window' };
        }

        // 6. Generate Vietnamese summaries and mark critical alert status
        for (const item of topItems) {
            const { title, summary, whyItMatters } = this.summaryService.generateVietnameseSummary(item);
            item.vietnameseTitle = title;
            item.vietnameseSummary = summary;
            item.whyItMattersVi = whyItMatters;

            // Check if this event was previously delivered via critical alert
            item.wasCriticalAlerted = await this.deliveryRepository.wasCriticalAlerted(item.primaryEvent.id);
        }

        // 7. Assemble Sections (Snapshot, Trending, Macro, Signals)
        const snapshot = this.buildMarketSnapshot(topItems);
        const trendingTokens = await this.buildTrendingTokens();
        const macroHighlights = this.buildMacroHighlights(topItems);
        const signalsToWatch = this.buildSignalsToWatch(topItems);

        // 8. Overall Impact calculation
        const overallImpactScore = this.formatterService.calculateOverallImpactScore(topItems);
        const overallImpactLabel = this.formatterService.formatOverallImpactLabel(overallImpactScore);

        // 9. Build Payload and Format
        const payload: DigestPayload = {
            id: `digest_${Date.now()}`,
            title: `Top ${topItems.length} Crypto Intelligence Digest`,
            periodHours,
            generatedAt: windowTo,
            items: topItems,
            snapshot,
            trendingTokens,
            macroHighlights,
            signalsToWatch,
            overallImpactScore,
            overallImpactLabel,
        };

        // 10. Quality Validation before Dispatch (Section 30)
        const qualityResult = this.validateDigestQuality(payload, config);
        if (!qualityResult.isValid) {
            const errMsg = `Digest quality validation failed: ${qualityResult.errors.join('; ')}`;
            logger.error(`[crypto-digest.quality_rejected] ${errMsg}`);
            return {
                success: false,
                itemCount: topItems.length,
                error: errMsg,
            };
        }

        const digestText = this.formatterService.formatDigest(payload);

        if (options.dryRun) {
            logger.info('[crypto-digest.dry_run] Dry run completed without dispatching message');
            return {
                success: true,
                itemCount: topItems.length,
                previewText: digestText,
                message: 'Dry run completed',
            };
        }

        // 11. Dispatch to Google Chat
        if (!this.notificationService) {
            const errMsg = 'GoogleChatNotificationService is not configured';
            logger.error(`[crypto-digest.error] ${errMsg}`);
            await this.deliveryRepository.recordDelivery({
                slotKey,
                windowFrom,
                windowTo,
                itemCount: topItems.length,
                eventIds: topItems.map((i) => i.primaryEvent.id),
                eventFingerprints: topItems.map((i) => i.canonicalFingerprint),
                status: DigestDeliveryStatus.FAILED,
                failedAt: new Date(),
                lastError: errMsg,
                previewText: digestText,
            });
            return { success: false, itemCount: topItems.length, error: errMsg };
        }

        try {
            await this.notificationService.sendText(digestText, {
                eventId: payload.id,
                severity: 'DIGEST',
            });

            await this.deliveryRepository.recordDelivery({
                slotKey,
                windowFrom,
                windowTo,
                itemCount: topItems.length,
                eventIds: topItems.map((i) => i.primaryEvent.id),
                eventFingerprints: topItems.map((i) => i.canonicalFingerprint),
                status: DigestDeliveryStatus.SUCCESS,
                sentAt: new Date(),
                previewText: digestText,
            });

            logger.info(`[crypto-digest.dispatched] Successfully delivered Top ${topItems.length} digest for slot ${slotKey} to Google Chat`);
            return {
                success: true,
                itemCount: topItems.length,
                previewText: digestText,
                message: `Successfully sent Top ${topItems.length} digest`,
            };
        } catch (error: any) {
            logger.error(`[crypto-digest.send_failed] ${error.message}`);
            await this.deliveryRepository.recordDelivery({
                slotKey,
                windowFrom,
                windowTo,
                itemCount: topItems.length,
                eventIds: topItems.map((i) => i.primaryEvent.id),
                eventFingerprints: topItems.map((i) => i.canonicalFingerprint),
                status: DigestDeliveryStatus.FAILED,
                failedAt: new Date(),
                lastError: error.message,
                previewText: digestText,
            });
            return { success: false, itemCount: topItems.length, error: error.message };
        }
    }

    /**
     * Quality Validation before sending to Google Chat (Section 30)
     */
    validateDigestQuality(payload: DigestPayload, config: DigestConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (payload.items.length > config.maxItems) {
            errors.push(`Item count exceeds maximum allowed (${payload.items.length} > ${config.maxItems})`);
        }

        const seenFingerprints = new Set<string>();
        const seenTitles = new Set<string>();

        for (const item of payload.items) {
            // Check no duplicate events
            if (seenFingerprints.has(item.canonicalFingerprint)) {
                errors.push(`Duplicate event detected with fingerprint: ${item.canonicalFingerprint}`);
            }
            seenFingerprints.add(item.canonicalFingerprint);

            const title = item.vietnameseTitle || item.title;
            const normalizedTitle = title.toLowerCase().trim();
            if (seenTitles.has(normalizedTitle)) {
                errors.push(`Duplicate title detected: "${title}"`);
            }
            seenTitles.add(normalizedTitle);

            // Check no invalid titles
            if (!isValidTitle(title)) {
                errors.push(`Invalid title detected: "${title}"`);
            }

            // Check Vietnamese language output (no raw Chinese/Japanese/Korean)
            if (!validateVietnameseOutput(title)) {
                errors.push(`Non-Vietnamese characters detected in title: "${title}"`);
            }
            if (item.vietnameseSummary && !validateVietnameseOutput(item.vietnameseSummary)) {
                errors.push(`Non-Vietnamese characters detected in summary for: "${title}"`);
            }

            // Check relevance
            if (!isCryptoMarketRelevant(item.primaryEvent)) {
                errors.push(`Irrelevant event detected: "${title}"`);
            }

            // Check minimum impact score (no impact 15)
            if (item.impactScore < config.minImpactScore) {
                errors.push(`Impact score ${item.impactScore} below minimum ${config.minImpactScore}: "${title}"`);
            }

            // Check generic AI filler
            if (detectGenericFiller(item.vietnameseSummary)) {
                errors.push(`Generic AI filler phrase detected in summary: "${title}"`);
            }
            if (detectGenericFiller(item.whyItMattersVi)) {
                errors.push(`Generic AI filler phrase detected in whyItMatters: "${title}"`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Builds data-backed Market Snapshot section from selected events
     */
    private buildMarketSnapshot(items: AggregatedMarketEvent[]): MarketSnapshotSection | undefined {
        const btcItems = items.filter((i) => i.tokens.includes('BTC'));
        const ethItems = items.filter((i) => i.tokens.includes('ETH'));
        const solItems = items.filter((i) => i.tokens.includes('SOL'));
        const memeItems = items.filter((i) => i.category === 'MEMECOIN' || i.eventType === MarketEventType.MEME_TREND);
        const macroItems = items.filter(
            (i) =>
                i.eventType === MarketEventType.CENTRAL_BANK_DECISION ||
                i.eventType === MarketEventType.MACRO_DATA ||
                i.eventType === MarketEventType.REGULATION
        );

        if (!btcItems.length && !ethItems.length && !solItems.length && !memeItems.length && !macroItems.length) {
            return undefined;
        }

        return {
            btcContext: btcItems.length > 0 ? btcItems[0].vietnameseTitle : undefined,
            ethContext: ethItems.length > 0 ? ethItems[0].vietnameseTitle : undefined,
            solContext: solItems.length > 0 ? solItems[0].vietnameseTitle : undefined,
            memeContext: memeItems.length > 0 ? memeItems[0].vietnameseTitle : undefined,
            macroContext: macroItems.length > 0 ? macroItems[0].vietnameseTitle : undefined,
        };
    }

    /**
     * Builds Trending Tokens section using TokenTrendService
     */
    private async buildTrendingTokens(): Promise<DigestTrendingToken[] | undefined> {
        if (!this.trendService) {
            return undefined;
        }

        try {
            const memeTrends = await this.trendService.getMemeTrends('6h');
            if (!memeTrends || memeTrends.length === 0) {
                return undefined;
            }

            // Filter trends with meaningful score >= 75
            const qualifiedTrends = memeTrends.filter((t) => t.trendingScore >= 75).slice(0, 5);
            if (qualifiedTrends.length === 0) {
                return undefined;
            }

            return qualifiedTrends.map((t) => ({
                symbol: t.symbol,
                name: t.token,
                trendScore: t.trendingScore,
                mentions1h: t.mentionCount,
                mentionChangePercent: Math.round(t.mentionVelocity * 10),
                topSources: t.chain ? [t.chain] : [],
            }));
        } catch (err: any) {
            logger.warn(`[crypto-digest.trending_tokens_error] ${err.message}`);
            return undefined;
        }
    }

    /**
     * Extracts Macro Highlights from items
     */
    private buildMacroHighlights(items: AggregatedMarketEvent[]): string[] | undefined {
        const macroItems = items.filter(
            (i) =>
                i.eventType === MarketEventType.CENTRAL_BANK_DECISION ||
                i.eventType === MarketEventType.MACRO_DATA ||
                i.eventType === MarketEventType.REGULATION ||
                i.eventType === MarketEventType.GOVERNMENT_POLICY
        );

        if (macroItems.length === 0) {
            return undefined;
        }

        return macroItems.slice(0, 3).map((item) => {
            const agency = item.sources[0]?.name || 'Cơ quan quản lý';
            return `${agency}: ${item.vietnameseTitle || item.title}`;
        });
    }

    /**
     * Builds signals to watch without financial advice
     */
    private buildSignalsToWatch(items: AggregatedMarketEvent[]): string[] | undefined {
        const signals: string[] = [];

        // Signal 1: Cross-exchange listings
        const listings = items.filter((i) => i.eventType === MarketEventType.EXCHANGE_LISTING || i.eventType === MarketEventType.BROKER_LISTING);
        for (const l of listings) {
            if (l.tokens.length > 0 && l.sources.length >= 2) {
                signals.push(`Token $${l.tokens[0]} được ghi nhận xuất hiện đồng thời trên nhiều nền tảng (${l.sources.map((s) => s.name).join(', ')}).`);
            }
        }

        // Signal 2: Security warnings
        const security = items.find((i) => i.eventType === MarketEventType.SECURITY_INCIDENT || i.eventType === MarketEventType.NETWORK_INCIDENT);
        if (security) {
            signals.push(`Cảnh báo an toàn: Ghi nhận sự cố kỹ thuật trên ${security.tokens[0] || 'giao thức'}, cần theo dõi sát các thông báo khắc phục.`);
        }

        // Signal 3: Macro decisions
        const macro = items.find((i) => i.eventType === MarketEventType.CENTRAL_BANK_DECISION || i.eventType === MarketEventType.MACRO_DATA);
        if (macro) {
            signals.push('Thị trường đang hấp thụ dữ liệu vĩ mô mới; chú ý biên độ biến động của các cặp BTC và ETH.');
        }

        return signals.length > 0 ? signals.slice(0, 3) : undefined;
    }
}
