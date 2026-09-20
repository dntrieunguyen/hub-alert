import { describe, expect, it, vi } from 'vitest';
import { HotNewsFormatter } from '../../../lib/collector/intelligence/hot-news/hot-news-formatter';
import { HotNewsPolicyService } from '../../../lib/collector/intelligence/hot-news/hot-news-policy.service';
import { HotNewsService } from '../../../lib/collector/intelligence/hot-news/hot-news.service';
import type { AiNewsAnalysis } from '../../../lib/collector/intelligence/types';
import type { GoogleChatNotificationService } from '../../../lib/collector/notifications/google-chat/google-chat-notification.service';
import { InMemoryNotificationDeliveryRepository } from '../../../lib/collector/notifications/storage/in-memory-notification-delivery.repository';
import { EventPriority, type MarketEvent, MarketEventType, NotificationChannel, VerificationStatus } from '../../../lib/collector/notifications/types';
import { SourceTier } from '../../../lib/collector/types';

const createSampleEvent = (id: string, overrides: Partial<MarketEvent> = {}): MarketEvent => ({
    id,
    title: 'Federal Reserve bất ngờ cắt giảm lãi suất 50 điểm cơ bản',
    summary: 'Fed công bố quyết định khẩn cấp về lãi suất',
    content: 'The Federal Reserve announced an emergency 50 basis point rate cut.',
    url: 'https://federalreserve.gov/press',
    source: {
        id: 'fed',
        name: 'Federal Reserve',
        tier: SourceTier.OFFICIAL,
        credibilityScore: 100,
    },
    category: 'MACRO',
    eventType: MarketEventType.CENTRAL_BANK_DECISION,
    verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
    priority: EventPriority.P0,
    impactScore: 98,
    tokens: ['BTC', 'ETH'],
    symbols: ['$BTC', '$ETH'],
    chains: [],
    publishedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
});

const createSampleAnalysis = (overrides: Partial<AiNewsAnalysis> = {}): AiNewsAnalysis => ({
    eventId: 'evt_hot_1',
    isValuable: true,
    isNewInformation: true,
    category: 'MACRO',
    informationValueScore: 98,
    marketRelevanceScore: 99,
    aiConfidence: 0.98,
    isHotNews: true,
    titleVi: 'Fed bất ngờ cắt giảm lãi suất 50 điểm cơ bản',
    summaryVi: 'Cục Dự trữ Liên bang Mỹ vừa thông báo cắt giảm lãi suất khẩn cấp.',
    whyItMattersVi: 'Ảnh hưởng trực tiếp tới thanh khoản toàn cầu và các tài sản rủi ro như BTC và ETH.',
    affectedAssets: ['BTC', 'ETH'],
    affectedNarratives: ['Macro Liquidity', 'Interest Rates'],
    keyFacts: ['Cắt giảm 50 điểm cơ bản', 'Họp khẩn cấp'],
    risks: ['Biến động tỷ giá USD'],
    ...overrides,
});

describe('HotNewsService & HotNewsPolicyService', () => {
    it('should immediately dispatch high credibility + high impact hot news to Google Chat', async () => {
        const event = createSampleEvent('evt_fed_1');
        const analysis = createSampleAnalysis({ eventId: 'evt_fed_1' });

        const mockAnalyzer = {
            providerName: 'mock',
            analyzeEvents: vi.fn(),
            analyzeSingleEvent: vi.fn().mockResolvedValue(analysis),
        };

        const mockNotificationService = {
            sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'msg_1' }),
        } as unknown as GoogleChatNotificationService;

        const deliveryRepo = new InMemoryNotificationDeliveryRepository();
        const hotService = new HotNewsService(mockAnalyzer, {
            notificationService: mockNotificationService,
            deliveryRepository: deliveryRepo,
        });

        const result = await hotService.evaluateAndDispatch(event);
        expect(result.alerted).toBe(true);
        expect(mockNotificationService.sendText).toHaveBeenCalledTimes(1);

        // Verify sent text formatting
        const callArgs = (mockNotificationService.sendText as any).mock.calls[0][0];
        expect(callArgs).toContain('🚨 TIN NÓNG — CRYPTO INTELLIGENCE');
        expect(callArgs).toContain('Fed bất ngờ cắt giảm lãi suất');
        expect(callArgs).toContain('📌 Tại sao đáng chú ý');
        expect(callArgs).toContain('🎯 Liên quan');
        expect(callArgs).toContain('📊 Mức ảnh hưởng\n98/100');
        expect(callArgs).toContain('✅ Xác minh');
    });

    it('should NOT push normal news (held for scheduled digest)', async () => {
        // Normal news: impact 75, credibility 75
        const event = createSampleEvent('evt_normal', {
            title: 'CoinDesk nhận định xu hướng DeFi tuần này',
            impactScore: 75,
            source: { id: 'cd', name: 'CoinDesk', tier: SourceTier.NEWS, credibilityScore: 75 },
        });

        const mockAnalyzer = {
            providerName: 'mock',
            analyzeEvents: vi.fn(),
            analyzeSingleEvent: vi.fn(),
        };

        const mockNotificationService = {
            sendText: vi.fn(),
        } as unknown as GoogleChatNotificationService;

        const hotService = new HotNewsService(mockAnalyzer, {
            notificationService: mockNotificationService,
        });

        const result = await hotService.evaluateAndDispatch(event);
        expect(result.alerted).toBe(false);
        // Did not even waste an AI call because pre-filter blocked it!
        expect(mockAnalyzer.analyzeSingleEvent).not.toHaveBeenCalled();
        expect(mockNotificationService.sendText).not.toHaveBeenCalled();
    });

    it('should reject unverified rumor from immediate hot news push', async () => {
        const unverifiedEvent = createSampleEvent('evt_rumor', {
            verificationStatus: VerificationStatus.UNVERIFIED,
            impactScore: 92,
            source: { id: 'x', name: 'Random Twitter User', tier: SourceTier.COMMUNITY, credibilityScore: 88 },
        });

        const mockAnalyzer = {
            providerName: 'mock',
            analyzeEvents: vi.fn(),
            analyzeSingleEvent: vi.fn(),
        };

        const mockNotificationService = { sendText: vi.fn() } as unknown as GoogleChatNotificationService;
        const hotService = new HotNewsService(mockAnalyzer, { notificationService: mockNotificationService });

        const result = await hotService.evaluateAndDispatch(unverifiedEvent);
        expect(result.alerted).toBe(false);
        expect(result.reason).toBe('unverified_status');
        expect(mockNotificationService.sendText).not.toHaveBeenCalled();
    });

    it('should deduplicate and prevent sending the same hot alert twice', async () => {
        const event = createSampleEvent('evt_duplicate_test');
        const analysis = createSampleAnalysis({ eventId: 'evt_duplicate_test' });

        const mockAnalyzer = {
            providerName: 'mock',
            analyzeEvents: vi.fn(),
            analyzeSingleEvent: vi.fn().mockResolvedValue(analysis),
        };

        const mockNotificationService = {
            sendText: vi.fn().mockResolvedValue({ success: true }),
        } as unknown as GoogleChatNotificationService;

        const deliveryRepo = new InMemoryNotificationDeliveryRepository();
        const hotService = new HotNewsService(mockAnalyzer, {
            notificationService: mockNotificationService,
            deliveryRepository: deliveryRepo,
        });

        // First attempt: alerted
        const res1 = await hotService.evaluateAndDispatch(event);
        expect(res1.alerted).toBe(true);

        // Second attempt with same event: suppressed!
        const res2 = await hotService.evaluateAndDispatch(event);
        expect(res2.alerted).toBe(false);
        expect(res2.reason).toBe('already_alerted');
        expect(mockNotificationService.sendText).toHaveBeenCalledTimes(1);
    });

    it('should allow re-alerting if event has a material update (newer version)', async () => {
        const event = createSampleEvent('evt_version_test');
        const analysis = createSampleAnalysis({ eventId: 'evt_version_test' });

        const mockAnalyzer = {
            providerName: 'mock',
            analyzeEvents: vi.fn(),
            analyzeSingleEvent: vi.fn().mockResolvedValue(analysis),
        };

        const mockNotificationService = {
            sendText: vi.fn().mockResolvedValue({ success: true }),
        } as unknown as GoogleChatNotificationService;

        const hotService = new HotNewsService(mockAnalyzer, {
            notificationService: mockNotificationService,
        });

        // Attempt 1: version 1
        await hotService.evaluateAndDispatch(event);
        expect(mockNotificationService.sendText).toHaveBeenCalledTimes(1);

        // Attempt 2: material status change with version 2
        const updatedEvent = { ...event, metadata: { version: '2' } };
        const res = await hotService.evaluateAndDispatch(updatedEvent);
        expect(res.alerted).toBe(true);
        expect(mockNotificationService.sendText).toHaveBeenCalledTimes(2);
    });
});
