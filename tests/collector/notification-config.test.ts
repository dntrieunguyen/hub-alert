import { describe, expect, it } from 'vitest';

import { NotificationConfigService } from '../../lib/collector/notifications/config/notification-config.service';

describe('NotificationConfigService', () => {
    it('should default to disabled when environment variables are empty', () => {
        const configService = new NotificationConfigService({});
        expect(configService.isEnabled()).toBe(false);
        expect(configService.getWebhookUrl()).toBe('');
        expect(configService.getMinImpactScore()).toBe(80);
    });

    it('should accept valid configuration when enabled', () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN',
            GOOGLE_CHAT_MIN_IMPACT_SCORE: '85',
        });

        expect(configService.isEnabled()).toBe(true);
        expect(configService.getWebhookUrl()).toBe('https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN');
        expect(configService.getMinImpactScore()).toBe(85);
    });

    it('should throw error when enabled but webhook URL is missing', () => {
        expect(() => {
            new NotificationConfigService({
                GOOGLE_CHAT_ENABLED: 'true',
                GOOGLE_CHAT_WEBHOOK_URL: '',
            });
        }).toThrow('GOOGLE_CHAT_WEBHOOK_URL is required when GOOGLE_CHAT_ENABLED is true');
    });

    it('should throw error when webhook URL does not start with https://chat.googleapis.com/', () => {
        expect(() => {
            new NotificationConfigService({
                GOOGLE_CHAT_ENABLED: 'true',
                GOOGLE_CHAT_WEBHOOK_URL: 'https://malicious-webhook.com/api',
            });
        }).toThrow('Must start with "https://chat.googleapis.com/"');
    });

    it('should throw error for invalid GOOGLE_CHAT_MIN_IMPACT_SCORE', () => {
        expect(() => {
            new NotificationConfigService({
                GOOGLE_CHAT_MIN_IMPACT_SCORE: '150',
            });
        }).toThrow('Must be an integer between 0 and 100');

        expect(() => {
            new NotificationConfigService({
                GOOGLE_CHAT_MIN_IMPACT_SCORE: 'invalid',
            });
        }).toThrow('Must be an integer between 0 and 100');
    });
});
