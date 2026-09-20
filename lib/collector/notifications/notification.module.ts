import logger from '@/utils/logger';

import { NotificationConfigService } from './config/notification-config.service';
import { GoogleChatMessageFormatter } from './google-chat/google-chat-message.formatter';
import { GoogleChatNotificationService } from './google-chat/google-chat-notification.service';
import { NotificationPolicyService } from './policy/notification-policy.service';
import { InMemoryNotificationDeliveryRepository } from './storage/in-memory-notification-delivery.repository';
import type { INotificationDeliveryRepository } from './storage/notification-delivery.interface';
import { type MarketEvent, NotificationChannel, NotificationSeverity } from './types';

export class NotificationModule {
    readonly configService: NotificationConfigService;
    readonly deliveryRepository: INotificationDeliveryRepository;
    readonly policyService: NotificationPolicyService;
    readonly formatter: GoogleChatMessageFormatter;
    readonly notificationService: GoogleChatNotificationService;

    constructor(options: {
        configService?: NotificationConfigService;
        deliveryRepository?: INotificationDeliveryRepository;
        policyService?: NotificationPolicyService;
        formatter?: GoogleChatMessageFormatter;
        notificationService?: GoogleChatNotificationService;
    } = {}) {
        this.configService = options.configService ?? new NotificationConfigService();
        this.deliveryRepository = options.deliveryRepository ?? new InMemoryNotificationDeliveryRepository();
        this.policyService = options.policyService ?? new NotificationPolicyService({
            minImpactScore: this.configService.getMinImpactScore(),
        });
        this.formatter = options.formatter ?? new GoogleChatMessageFormatter();
        this.notificationService = options.notificationService ?? new GoogleChatNotificationService(this.configService);

        // Safe startup validation
        this.configService.logStartup();
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
     * Processes a MarketEvent through policy, deduplication, formatting, and delivery.
     * Guaranteed to never throw and never break the collector.
     */
    async handleMarketEvent(event: MarketEvent): Promise<boolean> {
        if (!this.configService.isEnabled()) {
            return false;
        }

        // 1. Policy check
        const eligible = this.policyService.shouldNotify(event);
        if (!eligible) {
            return false;
        }

        // 2. Duplicate check
        const alreadySent = await this.deliveryRepository.isAlreadySent(event.id, NotificationChannel.GOOGLE_CHAT);
        if (alreadySent) {
            logger.info(
                JSON.stringify({
                    event: 'notification.google_chat.duplicate',
                    eventId: event.id,
                    channel: NotificationChannel.GOOGLE_CHAT,
                })
            );
            return false;
        }

        // 3. Record pending delivery
        await this.deliveryRepository.recordPending(event.id, NotificationChannel.GOOGLE_CHAT);

        // 4. Format message
        const text = this.formatter.formatMarketEvent(event);
        const severity = this.getSeverity(event.impactScore);

        // 5. Send with error isolation
        try {
            await this.notificationService.sendText(text, {
                eventId: event.id,
                severity,
            });

            await this.deliveryRepository.recordSuccess(event.id, NotificationChannel.GOOGLE_CHAT);
            return true;
        } catch (error: any) {
            await this.deliveryRepository.recordFailure(event.id, NotificationChannel.GOOGLE_CHAT, error.message);
            // Non-breaking: notification failures must never disrupt core collection
            return false;
        }
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
            },
        };
    }
}
