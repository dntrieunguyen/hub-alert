import logger from '@/utils/logger';

import { NotificationConfigService } from './config/notification-config.service';
import { CryptoDigestConfigService } from '../digest/crypto-digest-config.service';
import type { CryptoDigestScheduler } from '../digest/crypto-digest-scheduler';
import type { CryptoDigestService } from '../digest/crypto-digest.service';
import { GoogleChatMessageFormatter } from './google-chat/google-chat-message.formatter';
import { GoogleChatNotificationService } from './google-chat/google-chat-notification.service';
import { NotificationPolicyService } from './policy/notification-policy.service';
import { InMemoryNotificationDeliveryRepository } from './storage/in-memory-notification-delivery.repository';
import type { INotificationDeliveryRepository } from './storage/notification-delivery.interface';
import { type MarketEvent, NotificationChannel, NotificationSeverity } from './types';
import type { HotNewsService } from '../intelligence/hot-news/hot-news.service';

export class NotificationModule {
    readonly configService: NotificationConfigService;
    readonly digestConfigService: CryptoDigestConfigService;
    readonly deliveryRepository: INotificationDeliveryRepository;
    readonly policyService: NotificationPolicyService;
    readonly formatter: GoogleChatMessageFormatter;
    readonly notificationService: GoogleChatNotificationService;

    digestService?: CryptoDigestService;
    digestScheduler?: CryptoDigestScheduler;
    hotNewsService?: HotNewsService;

    constructor(options: {
        configService?: NotificationConfigService;
        digestConfigService?: CryptoDigestConfigService;
        deliveryRepository?: INotificationDeliveryRepository;
        policyService?: NotificationPolicyService;
        formatter?: GoogleChatMessageFormatter;
        notificationService?: GoogleChatNotificationService;
        digestService?: CryptoDigestService;
        digestScheduler?: CryptoDigestScheduler;
        hotNewsService?: HotNewsService;
    } = {}) {
        this.configService = options.configService ?? new NotificationConfigService();
        this.digestConfigService = options.digestConfigService ?? new CryptoDigestConfigService();
        this.deliveryRepository = options.deliveryRepository ?? new InMemoryNotificationDeliveryRepository();
        this.policyService = options.policyService ?? new NotificationPolicyService({
            minImpactScore: this.configService.getMinImpactScore(),
        });
        this.formatter = options.formatter ?? new GoogleChatMessageFormatter();
        this.notificationService = options.notificationService ?? new GoogleChatNotificationService(this.configService);
        this.digestService = options.digestService;
        this.digestScheduler = options.digestScheduler;
        this.hotNewsService = options.hotNewsService;

        // If digestService provided, link notificationService
        if (this.digestService) {
            this.digestService.setNotificationService(this.notificationService);
        }

        // Link hotNewsService dependencies if provided
        if (this.hotNewsService) {
            this.hotNewsService.setNotificationService(this.notificationService);
            this.hotNewsService.setDeliveryRepository(this.deliveryRepository);
        }

        // Safe startup validation
        this.configService.logStartup();
    }

    setHotNewsService(service: HotNewsService): void {
        this.hotNewsService = service;
        this.hotNewsService.setNotificationService(this.notificationService);
        this.hotNewsService.setDeliveryRepository(this.deliveryRepository);
    }

    setDigestServices(digestService: CryptoDigestService, digestScheduler?: CryptoDigestScheduler): void {
        this.digestService = digestService;
        this.digestScheduler = digestScheduler;
        this.digestService.setNotificationService(this.notificationService);
    }

    /**
     * Determines notification severity from impact score
     */
    getSeverity(impactScore: number): NotificationSeverity {
        if (impactScore >= 90) {
            return NotificationSeverity.CRITICAL;
        }
        if (impactScore >= 80) {
            return NotificationSeverity.HIGH;
        }
        return NotificationSeverity.MEDIUM;
    }

    /**
     * Handles MarketEvents according to Digest Architecture:
     * 1. Normal events: Stored silently for periodic Top 10 Digest (no individual Google Chat message).
     * 2. Critical events (impactScore >= 95 and critical alert enabled): Dispatched immediately as Critical Alert.
     */
    async handleMarketEvent(event: MarketEvent): Promise<boolean> {
        if (!this.configService.isEnabled()) {
            return false;
        }

        // 1. Evaluate with Realtime Hot News Service (AI analysis + backend policy)
        if (this.hotNewsService) {
            try {
                const hotResult = await this.hotNewsService.evaluateAndDispatch(event);
                if (hotResult.alerted) {
                    if (this.digestService) {
                        await this.digestService.deliveryRepository.recordCriticalAlert(event.id);
                    }
                    return true;
                }
            } catch (err: any) {
                logger.warn(`[notification.hot_news.error] ${err.message}`);
            }
        }

        // 2. Check if event qualifies for immediate critical bypass alert
        const isCriticalThreshold =
            this.digestConfigService.isCriticalAlertEnabled() &&
            event.impactScore >= this.digestConfigService.getCriticalAlertThreshold();

        if (!isCriticalThreshold) {
            // Normal event: do NOT send individual message to avoid spamming Google Chat
            logger.debug(
                JSON.stringify({
                    event: 'notification.google_chat.held_for_digest',
                    eventId: event.id,
                    impactScore: event.impactScore,
                })
            );
            return false;
        }

        // --- Critical Immediate Alert Pipeline ---
        const eligible = this.policyService.shouldNotify(event);
        if (!eligible) {
            return false;
        }

        const alreadySent = await this.deliveryRepository.isAlreadySent(event.id, NotificationChannel.GOOGLE_CHAT);
        if (alreadySent) {
            return false;
        }

        await this.deliveryRepository.recordPending(event.id, NotificationChannel.GOOGLE_CHAT);

        const rawText = this.formatter.formatMarketEvent(event);
        const criticalText = `🚨 [CẢNH BÁO KHẨN CẤP | CRITICAL MARKET ALERT]\n\n${rawText}`;
        const severity = NotificationSeverity.CRITICAL;

        try {
            await this.notificationService.sendText(criticalText, {
                eventId: event.id,
                severity,
            });

            await this.deliveryRepository.recordSuccess(event.id, NotificationChannel.GOOGLE_CHAT);

            // Record in digest delivery repo so next digest knows it was critical alerted
            if (this.digestService) {
                await this.digestService.deliveryRepository.recordCriticalAlert(event.id);
            }

            logger.info(
                JSON.stringify({
                    event: 'notification.google_chat.critical_alert_sent',
                    eventId: event.id,
                    impactScore: event.impactScore,
                })
            );
            return true;
        } catch (error: any) {
            await this.deliveryRepository.recordFailure(event.id, NotificationChannel.GOOGLE_CHAT, error.message);
            return false;
        }
    }

    /**
     * Manually triggers digest generation and dispatch
     */
    async triggerDigest(options: { dryRun?: boolean; forceSend?: boolean } = {}) {
        if (!this.digestService) {
            return {
                success: false,
                itemCount: 0,
                error: 'CryptoDigestService is not initialized on NotificationModule',
            };
        }
        return this.digestService.generateAndSendDigest(options);
    }

    /**
     * Sends manual test message (for dev/testing only)
     */
    async sendManualTestMessage(customMessage?: string): Promise<{ success: boolean; message: string }> {
        if (!this.configService.isEnabled()) {
            return {
                success: false,
                message: 'Google Chat notifications are disabled in configuration (GOOGLE_CHAT_ENABLED=false)',
            };
        }

        const text = customMessage ? `✅ Crypto Intelligence\n\n${customMessage}` : this.formatter.formatTestMessage();

        try {
            await this.notificationService.sendText(text, {
                eventId: `test_${Date.now()}`,
                severity: 'TEST',
            });
            return {
                success: true,
                message: 'Google Chat test message delivered successfully',
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Google Chat test message failed: ${error.message}`,
            };
        }
    }

    /**
     * Exposes safe health check info without leaking webhook URL
     */
    getHealthStatus() {
        return {
            googleChat: {
                enabled: this.configService.isEnabled(),
                configured: Boolean(this.configService.getWebhookUrl()),
                minImpactScore: this.configService.getMinImpactScore(),
            },
            digest: {
                enabled: this.digestConfigService.isEnabled(),
                intervalMinutes: this.digestConfigService.getConfig().intervalMinutes,
                lookbackHours: this.digestConfigService.getConfig().lookbackHours,
                maxItems: this.digestConfigService.getConfig().maxItems,
                scheduler: this.digestScheduler?.getStatus(),
            },
            criticalAlerts: {
                enabled: this.digestConfigService.isCriticalAlertEnabled(),
                threshold: this.digestConfigService.getCriticalAlertThreshold(),
            },
        };
    }
}
