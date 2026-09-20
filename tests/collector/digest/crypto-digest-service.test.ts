import { describe, expect, it, vi } from 'vitest';
import { CryptoFeedItem, FeedCategory, SourceTier, VerificationStatus } from '../../../lib/collector/types';
import { EventPriority, MarketEventType, NotificationChannel, type MarketEvent } from '../../../lib/collector/notifications/types';
import { InMemoryFeedRepository } from '../../../lib/collector/storage/in-memory-feed.repository';
import { CryptoDigestConfigService } from '../../../lib/collector/digest/crypto-digest-config.service';
import { CryptoDigestService } from '../../../lib/collector/digest/crypto-digest.service';
import { GoogleChatNotificationService } from '../../../lib/collector/notifications/google-chat/google-chat-notification.service';
import { NotificationConfigService } from '../../../lib/collector/notifications/config/notification-config.service';
import { NotificationModule } from '../../../lib/collector/notifications/notification.module';
import { DigestDeliveryStatus } from '../../../lib/collector/digest/types';

describe('CryptoDigestService & Notification Integration', () => {
    const makeFeedItem = (
        id: string,
        title: string,
        sourceName: string,
        sourceTier: SourceTier,
        credibilityScore: number,
        tokens: string[],
        impactScore = 90,
        hoursAgo = 1
    ): CryptoFeedItem => ({
        id,
        externalId: `ext_${id}`,
        title,
        summary: `Summary of ${title}`,
        content: `Full text of ${title}`,
        url: `https://example.com/${id}`,
        sourceId: sourceName.toLowerCase().replace(/\s+/g, '-'),
        sourceName,
        sourceTier,
        credibilityScore,
        category: 'CRYPTO_NEWS' as FeedCategory,
        tokens,
        symbols: tokens.map((t) => `$${t}`),
        chains: ['Ethereum'],
        topics: ['LISTING'],
        publishedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
        collectedAt: new Date(),
        fingerprint: `fp_${id}`,
        breaking: false,
        impactScore,
    });

    it('should generate and send Top 10 digest to Google Chat when quality events exist', async () => {
        const repo = new InMemoryFeedRepository();
        await repo.saveItem(makeFeedItem('item1', 'Coinbase announces PEPE listing', 'Coinbase Markets', SourceTier.OFFICIAL, 95, ['PEPE'], 92, 1));
        await repo.saveItem(makeFeedItem('item2', 'Federal Reserve holds interest rates', 'Federal Reserve', SourceTier.OFFICIAL, 100, ['BTC'], 98, 2));
        await repo.saveItem(makeFeedItem('item3', 'Robinhood adds support for WIF', 'Robinhood', SourceTier.OFFICIAL, 95, ['WIF'], 89, 3));

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ name: 'spaces/test/messages/msg1' }),
        });

        const notifConfig = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/SPACE1/messages?key=KEY&token=TOKEN',
        });
        const notifService = new GoogleChatNotificationService(notifConfig, { fetchFn: mockFetch });

        const digestConfig = new CryptoDigestConfigService({
            CRYPTO_DIGEST_ENABLED: 'true',
            CRYPTO_DIGEST_LOOKBACK_HOURS: '6',
            CRYPTO_DIGEST_MAX_ITEMS: '10',
            CRYPTO_DIGEST_MIN_CREDIBILITY: '70',
            CRYPTO_DIGEST_MIN_RANKING_SCORE: '65',
        });

        const digestService = new CryptoDigestService(repo, {
            configService: digestConfig,
            notificationService: notifService,
        });

        const result = await digestService.generateAndSendDigest();

        expect(result.success).toBe(true);
        expect(result.itemCount).toBe(3);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Check payload body sent to webhook
        const callArgs = mockFetch.mock.calls[0];
        const body = JSON.parse(callArgs[1].body);
        expect(body.text).toContain('🚀 CRYPTO INTELLIGENCE DIGEST');
        expect(body.text).toContain('Coinbase Markets');
        expect(body.text).toContain('Federal Reserve');

        // Verify delivery record stored in repository
        const latestDelivery = await digestService.deliveryRepository.getLatestSuccessfulDelivery();
        expect(latestDelivery).not.toBeNull();
        expect(latestDelivery?.status).toBe(DigestDeliveryStatus.SUCCESS);
        expect(latestDelivery?.itemCount).toBe(3);
    });

    it('should skip sending and not call Google Chat when no events meet quality thresholds', async () => {
        const repo = new InMemoryFeedRepository();
        // Item is older than 6h
        await repo.saveItem(makeFeedItem('item_old', 'Old news', 'Blog', SourceTier.COMMUNITY, 40, ['XYZ'], 50, 10));

        const mockFetch = vi.fn();
        const notifConfig = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/SPACE1/messages?key=KEY&token=TOKEN',
        });
        const notifService = new GoogleChatNotificationService(notifConfig, { fetchFn: mockFetch });

        const digestService = new CryptoDigestService(repo, {
            notificationService: notifService,
        });

        const result = await digestService.generateAndSendDigest();

        expect(result.success).toBe(true);
        expect(result.itemCount).toBe(0);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return previewText in dryRun mode without sending webhook', async () => {
        const repo = new InMemoryFeedRepository();
        await repo.saveItem(makeFeedItem('item1', 'Coinbase announces PEPE listing', 'Coinbase Markets', SourceTier.OFFICIAL, 95, ['PEPE'], 92, 1));

        const mockFetch = vi.fn();
        const notifConfig = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/SPACE1/messages?key=KEY&token=TOKEN',
        });
        const notifService = new GoogleChatNotificationService(notifConfig, { fetchFn: mockFetch });

        const digestService = new CryptoDigestService(repo, {
            notificationService: notifService,
        });

        const result = await digestService.generateAndSendDigest({ dryRun: true });

        expect(result.success).toBe(true);
        expect(result.itemCount).toBe(1);
        expect(result.previewText).toContain('Coinbase');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should support immediate critical alert for impact >= 95 while withholding normal items for digest', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ name: 'msg_critical' }),
        });

        const notifConfig = new NotificationConfigService({
            GOOGLE_CHAT_ENABLED: 'true',
            GOOGLE_CHAT_WEBHOOK_URL: 'https://chat.googleapis.com/v1/spaces/SPACE1/messages?key=KEY&token=TOKEN',
        });
        const notifService = new GoogleChatNotificationService(notifConfig, { fetchFn: mockFetch });

        const notificationModule = new NotificationModule({
            configService: notifConfig,
            notificationService: notifService,
        });

        const normalEvent: MarketEvent = {
            id: 'evt_normal',
            title: 'Minor token update',
            url: 'https://example.com/normal',
            source: { id: 'news', name: 'CryptoNews', tier: SourceTier.NEWS, credibilityScore: 80 },
            category: 'CRYPTO_NEWS',
            eventType: MarketEventType.GENERAL_NEWS,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            priority: EventPriority.P1,
            impactScore: 82, // Below 95 -> Normal event
            tokens: ['ETH'],
            symbols: ['$ETH'],
            chains: ['Ethereum'],
            publishedAt: new Date(),
            createdAt: new Date(),
        };

        const criticalEvent: MarketEvent = {
            id: 'evt_critical',
            title: 'Federal Reserve emergency rate cut announced',
            url: 'https://federalreserve.gov/emergency',
            source: { id: 'fed', name: 'Federal Reserve', tier: SourceTier.OFFICIAL, credibilityScore: 100 },
            category: 'MACRO',
            eventType: MarketEventType.CENTRAL_BANK_DECISION,
            verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
            priority: EventPriority.P0,
            impactScore: 98, // >= 95 -> Critical event
            tokens: ['BTC', 'ETH'],
            symbols: ['$BTC', '$ETH'],
            chains: ['Bitcoin', 'Ethereum'],
            publishedAt: new Date(),
            createdAt: new Date(),
        };

        // 1. Normal event should be held for digest (NOT sent immediately)
        const normalSent = await notificationModule.handleMarketEvent(normalEvent);
        expect(normalSent).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();

        // 2. Critical event should trigger immediate critical alert
        const criticalSent = await notificationModule.handleMarketEvent(criticalEvent);
        expect(criticalSent).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(callBody.text).toContain('🚨 [CẢNH BÁO KHẨN CẤP | CRITICAL MARKET ALERT]');
        expect(callBody.text).toContain('Federal Reserve');
    });
});
