import { describe, expect, it, vi } from 'vitest';

import { NotificationConfigService } from '../../lib/collector/notifications/config/notification-config.service';
import { GoogleChatMessageFormatter } from '../../lib/collector/notifications/google-chat/google-chat-message.formatter';
import { GoogleChatNotificationService } from '../../lib/collector/notifications/google-chat/google-chat-notification.service';
import { NotificationModule } from '../../lib/collector/notifications/notification.module';
import { NotificationPolicyService } from '../../lib/collector/notifications/policy/notification-policy.service';
import { InMemoryNotificationDeliveryRepository } from '../../lib/collector/notifications/storage/in-memory-notification-delivery.repository';
import logger from '../../lib/utils/logger';
import { EventPriority, type MarketEvent, MarketEventType, NotificationChannel, VerificationStatus } from '../../lib/collector/notifications/types';
import { SourceTier } from '../../lib/collector/types';

describe('GoogleChatNotificationService & NotificationModule Integration', () => {
    const SECRET_WEBHOOK_URL = 'https://chat.googleapis.com/v1/spaces/SPACE123/messages?key=AIzaSySecretKey123&token=SecretToken456';

    const createBaseEvent = (id = 'evt_test_1'): MarketEvent => ({
        id,
        title: 'Bitcoin breaks new high on ETF inflow',
        url: 'https://coindesk.com/markets/btc-high',
        source: {
            id: 'coindesk',
            name: 'CoinDesk',
            tier: SourceTier.NEWS,
            credibilityScore: 90,
        },
        category: 'CRYPTO_NEWS',
        eventType: MarketEventType.ETF,
        verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
        priority: EventPriority.P0,
        impactScore: 95,
        tokens: ['BTC'],
        symbols: ['$BTC'],
        chains: ['Bitcoin'],
        publishedAt: new Date(),
        createdAt: new Date(),
    });

    it('should skip sending when notifications are disabled', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'false',
        });
        const mockFetch = vi.fn();
        const notificationService = new GoogleChatNotificationService(configService, { fetchFn: mockFetch });

        await notificationService.sendText('Test message');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should successfully deliver message and track delivery in repository', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
            GOOGLE_CHAT_MIN_IMPACT_SCORE: '80',
        });

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ name: 'spaces/SPACE123/messages/msg456' }),
        });

        const deliveryRepo = new InMemoryNotificationDeliveryRepository();
        const notificationService = new GoogleChatNotificationService(configService, {
            fetchFn: mockFetch,
            retryBackoffMs: [10, 20],
        });

        const module = new NotificationModule({
            configService,
            deliveryRepository: deliveryRepo,
            notificationService,
        });

        const event = createBaseEvent('evt_success_1');
        const result = await module.handleMarketEvent(event);

        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Verify request payload
        const [url, requestOptions] = mockFetch.mock.calls[0];
        expect(url).toBe(SECRET_WEBHOOK_URL);
        expect(requestOptions.method).toBe('POST');
        const body = JSON.parse(requestOptions.body);
        expect(body.text).toContain('🚨 CRYPTO ALERT');
        expect(body.text).toContain('BTC');

        // Verify delivery tracking
        const isSent = await deliveryRepo.isAlreadySent('evt_success_1', NotificationChannel.GOOGLE_CHAT);
        expect(isSent).toBe(true);
    });

    it('should prevent duplicate notifications for the same event', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
        });

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
        });

        const deliveryRepo = new InMemoryNotificationDeliveryRepository();
        const module = new NotificationModule({
            configService,
            deliveryRepository: deliveryRepo,
            notificationService: new GoogleChatNotificationService(configService, {
                fetchFn: mockFetch,
                retryBackoffMs: [10, 20],
            }),
        });

        const event = createBaseEvent('evt_duplicate_test');

        // First attempt -> Sent
        const firstResult = await module.handleMarketEvent(event);
        expect(firstResult).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second attempt -> Skipped due to duplicate check
        const secondResult = await module.handleMarketEvent(event);
        expect(secondResult).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(1); // No new HTTP call
    });

    it('should retry on 429 and 500 errors with backoff and succeed on subsequent attempt', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
        });

        const mockFetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 429 })
            .mockResolvedValueOnce({ ok: false, status: 503 })
            .mockResolvedValueOnce({ ok: true, status: 200 });

        const notificationService = new GoogleChatNotificationService(configService, {
            fetchFn: mockFetch,
            retryBackoffMs: [10, 20],
            maxRetries: 3,
        });

        await notificationService.sendText('Test retry message');
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should NOT retry on 400 Bad Request and fail immediately', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
        });

        const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });

        const notificationService = new GoogleChatNotificationService(configService, {
            fetchFn: mockFetch,
            retryBackoffMs: [10, 20],
            maxRetries: 3,
        });

        await expect(notificationService.sendText('Bad request text')).rejects.toThrow('status: 400');
        expect(mockFetch).toHaveBeenCalledTimes(1); // Exactly 1 attempt, no retries
    });

    it('should handle timeout without crashing', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
        });

        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';

        const mockFetch = vi.fn().mockRejectedValue(abortError);

        const notificationService = new GoogleChatNotificationService(configService, {
            fetchFn: mockFetch,
            retryBackoffMs: [5, 5],
            maxRetries: 2,
        });

        await expect(notificationService.sendText('Timeout test')).rejects.toThrow('timed out');
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('CRITICAL: Webhook URL and secret credentials must NEVER appear in logger output', async () => {
        const infoSpy = vi.spyOn(logger, 'info');
        const warnSpy = vi.spyOn(logger, 'warn');
        const errorSpy = vi.spyOn(logger, 'error');

        try {
            const configService = new NotificationConfigService({
                GOOGLE_CHAT_ENABLED: 'true',
                GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
            });

            configService.logStartup();

            const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));
            const notificationService = new GoogleChatNotificationService(configService, {
                fetchFn: mockFetch,
                retryBackoffMs: [5],
                maxRetries: 1,
            });

            try {
                await notificationService.sendText('Secret test message', { eventId: 'evt_sec_1' });
            } catch {
                // Expected failure
            }

            const allLoggedStrings = [
                ...infoSpy.mock.calls.flat(),
                ...warnSpy.mock.calls.flat(),
                ...errorSpy.mock.calls.flat(),
            ].join('\n');

            // Verification: Secret tokens and key MUST NOT appear anywhere in log strings
            expect(allLoggedStrings).not.toContain('AIzaSySecretKey123');
            expect(allLoggedStrings).not.toContain('SecretToken456');
            expect(allLoggedStrings).not.toContain('https://chat.googleapis.com/');
            expect(allLoggedStrings).toContain('Google Chat notifications: enabled');
        } finally {
            infoSpy.mockRestore();
            warnSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });

    it('should isolate notification errors so they never throw in handleMarketEvent', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
        });

        const mockFetch = vi.fn().mockRejectedValue(new Error('Total outage'));

        const deliveryRepo = new InMemoryNotificationDeliveryRepository();
        const module = new NotificationModule({
            configService,
            deliveryRepository: deliveryRepo,
            notificationService: new GoogleChatNotificationService(configService, {
                fetchFn: mockFetch,
                retryBackoffMs: [5],
                maxRetries: 1,
            }),
        });

        const event = createBaseEvent('evt_failure_isolation');
        // Must NOT throw
        const result = await module.handleMarketEvent(event);
        expect(result).toBe(false);

        const delivery = await deliveryRepo.findDelivery('evt_failure_isolation', NotificationChannel.GOOGLE_CHAT);
        expect(delivery?.status).toBe('FAILED');
    });

    it('should process manual test endpoint message correctly', async () => {
        const configService = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: SECRET_WEBHOOK_URL,
        });

        const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

        const module = new NotificationModule({
            configService,
            notificationService: new GoogleChatNotificationService(configService, {
                fetchFn: mockFetch,
            }),
        });

        const res = await module.sendManualTestMessage();
        expect(res.success).toBe(true);
        expect(res.message).toContain('delivered successfully');

        const [_, requestOptions] = mockFetch.mock.calls[0];
        const body = JSON.parse(requestOptions.body);
        expect(body.text).toContain('✅ Crypto Intelligence');
        expect(body.text).toContain('Google Chat notification integration is working.');
    });
});
