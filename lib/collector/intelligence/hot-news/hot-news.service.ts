import logger from '@/utils/logger';
import type { GoogleChatNotificationService } from '../../notifications/google-chat/google-chat-notification.service';
import type { INotificationDeliveryRepository } from '../../notifications/storage/notification-delivery.interface';
import { type MarketEvent, NotificationChannel, NotificationSeverity } from '../../notifications/types';
import type { AiNewsAnalyzer } from '../ai-news-analyzer.interface';
import type { AiNewsAnalysis } from '../types';
import { HotNewsFormatter } from './hot-news-formatter';
import { HotNewsPolicyService } from './hot-news-policy.service';

export class HotNewsService {
    private analyzer: AiNewsAnalyzer;
    private policyService: HotNewsPolicyService;
    private notificationService?: GoogleChatNotificationService;
    private deliveryRepository?: INotificationDeliveryRepository;
    private alertedKeys = new Set<string>();

    constructor(
        analyzer: AiNewsAnalyzer,
        options: {
            policyService?: HotNewsPolicyService;
            notificationService?: GoogleChatNotificationService;
            deliveryRepository?: INotificationDeliveryRepository;
        } = {}
    ) {
        this.analyzer = analyzer;
        this.policyService = options.policyService ?? new HotNewsPolicyService();
        this.notificationService = options.notificationService;
        this.deliveryRepository = options.deliveryRepository;
    }

    setNotificationService(service: GoogleChatNotificationService): void {
        this.notificationService = service;
    }

    setDeliveryRepository(repo: INotificationDeliveryRepository): void {
        this.deliveryRepository = repo;
    }

    /**
     * Evaluates a newly collected event for immediate Hot News dispatch.
     * Uses preliminary deterministic gate before calling AI to minimize token usage.
     */
    async evaluateAndDispatch(event: MarketEvent): Promise<{
        alerted: boolean;
        analysis?: AiNewsAnalysis | null;
        reason?: string;
    }> {
        // Step 1: Pre-filter before calling AI (Cost control: Section 6 & 26)
        // Only evaluate if credibility and impact are close to hot thresholds
        const credScore = event.source.credibilityScore ?? 0;
        if (credScore < 85 || event.impactScore < 85) {
            return { alerted: false, reason: 'below_hot_thresholds' };
        }

        if (!this.policyService.isAllowedVerificationStatus(event)) {
            return { alerted: false, reason: 'unverified_status' };
        }

        // Step 2: Call AI analyzer for single event
        let analysis: AiNewsAnalysis | null = null;
        try {
            analysis = await this.analyzer.analyzeSingleEvent(event);
        } catch (err: any) {
            logger.warn(`[hot_news.ai_error] Failed AI analysis for event ${event.id}: ${err.message}`);
            return { alerted: false, reason: 'ai_failed' };
        }

        if (!analysis) {
            return { alerted: false, reason: 'no_analysis' };
        }

        // Step 3: Check backend policy (Section 11)
        const qualifies = this.policyService.shouldPushHotNews(event, analysis);
        if (!qualifies) {
            logger.debug(
                JSON.stringify({
                    event: 'hot_news.skipped',
                    eventId: event.id,
                    isHotNews: analysis.isHotNews,
                    confidence: analysis.aiConfidence,
                })
            );
            return { alerted: false, analysis, reason: 'policy_rejected' };
        }

        logger.info(
            JSON.stringify({
                event: 'hot_news.detected',
                eventId: event.id,
                title: event.title,
                impactScore: event.impactScore,
                confidence: analysis.aiConfidence,
            })
        );

        // Step 4: Check deduplication (Section 29)
        const version = String(event.metadata?.version || '1');
        const alertKey = `${event.id}:${version}:${NotificationChannel.GOOGLE_CHAT}`;

        if (this.alertedKeys.has(alertKey)) {
            return { alerted: false, analysis, reason: 'already_alerted' };
        }

        if (this.deliveryRepository) {
            const alreadySent = await this.deliveryRepository.isAlreadySent(event.id, NotificationChannel.GOOGLE_CHAT);
            if (alreadySent && version === '1') {
                return { alerted: false, analysis, reason: 'already_sent' };
            }
        }

        // Step 5: Format and Dispatch
        if (!this.notificationService) {
            logger.warn('[hot_news.no_notification_service] GoogleChatNotificationService not linked, skipping push');
            return { alerted: false, analysis, reason: 'no_notification_service' };
        }

        const messageText = HotNewsFormatter.formatAlert(event, analysis);

        try {
            if (this.deliveryRepository) {
                await this.deliveryRepository.recordPending(event.id, NotificationChannel.GOOGLE_CHAT);
            }

            await this.notificationService.sendText(messageText, {
                eventId: event.id,
                severity: NotificationSeverity.CRITICAL,
            });

            this.alertedKeys.add(alertKey);

            if (this.deliveryRepository) {
                await this.deliveryRepository.recordSuccess(event.id, NotificationChannel.GOOGLE_CHAT);
            }

            logger.info(
                JSON.stringify({
                    event: 'hot_news.sent',
                    eventId: event.id,
                    version,
                })
            );

            return { alerted: true, analysis };
        } catch (err: any) {
            logger.error(`[hot_news.dispatch_error] ${err.message}`);
            if (this.deliveryRepository) {
                await this.deliveryRepository.recordFailure(event.id, NotificationChannel.GOOGLE_CHAT, err.message);
            }
            return { alerted: false, analysis, reason: err.message };
        }
    }
}
