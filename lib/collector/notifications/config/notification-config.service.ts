import logger from '@/utils/logger';

import type { NotificationConfig } from '../types';

export class NotificationConfigService {
    private config: NotificationConfig;

    constructor(env: Record<string, string | undefined> = process.env) {
        this.config = this.parseAndValidate(env);
    }

    private parseAndValidate(env: Record<string, string | undefined>): NotificationConfig {
        const rawEnabled = env.GOOGLE_CHAT_ENABLED?.trim().toLowerCase();
        const enabled = rawEnabled === 'true' || rawEnabled === '1';

        const rawWebhook = env.GOOGLE_CHAT_WEBHOOK_URL?.trim() || '';

        // Validate min impact score
        let minImpactScore = 80;
        if (env.GOOGLE_CHAT_MIN_IMPACT_SCORE !== undefined && env.GOOGLE_CHAT_MIN_IMPACT_SCORE.trim() !== '') {
            const parsed = Number.parseInt(env.GOOGLE_CHAT_MIN_IMPACT_SCORE.trim(), 10);
            if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
                throw new Error(`Invalid GOOGLE_CHAT_MIN_IMPACT_SCORE: ${env.GOOGLE_CHAT_MIN_IMPACT_SCORE}. Must be an integer between 0 and 100.`);
            }
            minImpactScore = parsed;
        }

        // Validate webhook url if enabled
        if (enabled) {
            if (!rawWebhook) {
                throw new Error('GOOGLE_CHAT_WEBHOOK_URL is required when GOOGLE_CHAT_ENABLED is true.');
            }
            if (!rawWebhook.startsWith('https://chat.googleapis.com/')) {
                throw new Error('Invalid GOOGLE_CHAT_WEBHOOK_URL. Must start with "https://chat.googleapis.com/".');
            }
        }

        return {
            enabled,
            webhookUrl: rawWebhook,
            minImpactScore,
        };
    }

    /**
     * Safe startup logging: Never logs webhook URL or credentials
     */
    logStartup(): void {
        if (this.config.enabled) {
            logger.info('Google Chat notifications: enabled');
        } else {
            logger.info('Google Chat notifications: disabled');
        }
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    getWebhookUrl(): string {
        return this.config.webhookUrl;
    }

    getMinImpactScore(): number {
        return this.config.minImpactScore;
    }

    getConfig(): Readonly<NotificationConfig> {
        return { ...this.config };
    }
}
