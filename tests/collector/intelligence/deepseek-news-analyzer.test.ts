import { describe, expect, it, vi } from 'vitest';
import { DeepSeekNewsAnalyzer } from '../../../lib/collector/intelligence/deepseek/deepseek-news-analyzer.service';
import { InMemoryAiAnalysisCache } from '../../../lib/collector/intelligence/cache/in-memory-ai-analysis-cache';
import { DeepSeekValidator } from '../../../lib/collector/intelligence/deepseek/deepseek-validator';
import { EventPriority, type MarketEvent, MarketEventType, VerificationStatus } from '../../../lib/collector/notifications/types';
import { SourceTier } from '../../../lib/collector/types';

const createSampleEvent = (id: string, overrides: Partial<MarketEvent> = {}): MarketEvent => ({
    id,
    title: 'Coinbase thông báo niêm yết $PEPE',
    summary: 'Sàn giao dịch Coinbase chính thức mở giao dịch cho token PEPE',
    content: 'Coinbase Markets confirms trading support for PEPE starting today.',
    url: 'https://coinbase.com/pepe',
    source: {
        id: 'coinbase',
        name: 'Coinbase Markets',
        tier: SourceTier.OFFICIAL,
        credibilityScore: 95,
    },
    category: 'CRYPTO',
    eventType: MarketEventType.EXCHANGE_LISTING,
    verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
    priority: EventPriority.P0,
    impactScore: 92,
    trendScore: 85,
    tokens: ['PEPE'],
    symbols: ['$PEPE'],
    chains: ['Ethereum'],
    publishedAt: new Date('2026-09-20T10:00:00Z'),
    createdAt: new Date('2026-09-20T10:05:00Z'),
    ...overrides,
});

describe('DeepSeekNewsAnalyzer', () => {
    it('should successfully analyze events and return structured AiNewsAnalysis', async () => {
        const sampleEvent = createSampleEvent('evt_1');
        const mockResponse = {
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            analyses: [
                                {
                                    eventId: 'evt_1',
                                    isValuable: true,
                                    isNewInformation: true,
                                    category: 'EXCHANGE',
                                    informationValueScore: 92,
                                    marketRelevanceScore: 90,
                                    aiConfidence: 0.95,
                                    isHotNews: true,
                                    titleVi: 'Coinbase chính thức niêm yết $PEPE',
                                    summaryVi: 'Sàn Coinbase vừa công bố hỗ trợ giao dịch $PEPE trên toàn hệ thống.',
                                    whyItMattersVi: 'Tăng mạnh thanh khoản và khả năng tiếp cận của retail investors.',
                                    affectedAssets: ['PEPE'],
                                    affectedNarratives: ['Exchange Listing', 'Memecoin'],
                                    keyFacts: ['Giao dịch bắt đầu hôm nay', 'Niêm yết spot'],
                                    risks: ['Biến động giá ngắn hạn cao'],
                                },
                            ],
                        }),
                    },
                },
            ],
        };

        const mockFetch = vi.fn().mockResolvedValue(mockResponse);
        const analyzer = new DeepSeekNewsAnalyzer({
            config: {
                enabled: true,
                apiKey: 'test-key',
                model: 'deepseek-chat',
            },
            fetchFn: mockFetch,
        });

        const results = await analyzer.analyzeEvents([sampleEvent]);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        const analysis = results.get('evt_1');
        expect(analysis).toBeDefined();
        expect(analysis?.isHotNews).toBe(true);
        expect(analysis?.titleVi).toBe('Coinbase chính thức niêm yết $PEPE');
        expect(analysis?.informationValueScore).toBe(92);
        expect(analysis?.affectedAssets).toContain('PEPE');
    });

    it('should retry on 429 rate limit with backoff and succeed', async () => {
        const sampleEvent = createSampleEvent('evt_retry');
        const error429 = new Error('Rate limit exceeded');
        (error429 as any).status = 429;

        const successResponse = {
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            analyses: [
                                {
                                    eventId: 'evt_retry',
                                    isValuable: true,
                                    category: 'EXCHANGE',
                                    informationValueScore: 85,
                                    marketRelevanceScore: 80,
                                    aiConfidence: 0.9,
                                    isHotNews: false,
                                    titleVi: 'Coinbase niêm yết PEPE',
                                    summaryVi: 'Coinbase mở giao dịch token PEPE.',
                                    whyItMattersVi: 'Tăng thanh khoản.',
                                    affectedAssets: ['PEPE'],
                                },
                            ],
                        }),
                    },
                },
            ],
        };

        const mockFetch = vi
            .fn()
            .mockRejectedValueOnce(error429)
            .mockResolvedValueOnce(successResponse);

        const analyzer = new DeepSeekNewsAnalyzer({
            config: {
                enabled: true,
                apiKey: 'test-key',
                maxRetries: 3,
            },
            fetchFn: mockFetch,
        });

        const results = await analyzer.analyzeEvents([sampleEvent]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(results.get('evt_retry')?.titleVi).toBe('Coinbase niêm yết PEPE');
    });

    it('should safely handle timeout without crashing or throwing', async () => {
        const sampleEvent = createSampleEvent('evt_timeout');
        const timeoutError = new Error('Request timed out');
        timeoutError.name = 'TimeoutError';

        const mockFetch = vi.fn().mockRejectedValue(timeoutError);
        const analyzer = new DeepSeekNewsAnalyzer({
            config: {
                enabled: true,
                apiKey: 'test-key',
                maxRetries: 1,
            },
            fetchFn: mockFetch,
        });

        const results = await analyzer.analyzeEvents([sampleEvent]);
        expect(results.size).toBe(0);
    });

    it('should safely handle invalid JSON response', async () => {
        const sampleEvent = createSampleEvent('evt_invalid_json');
        const invalidResponse = {
            choices: [
                {
                    message: {
                        content: 'Invalid not json string at all',
                    },
                },
            ],
        };

        const mockFetch = vi.fn().mockResolvedValue(invalidResponse);
        const analyzer = new DeepSeekNewsAnalyzer({
            config: {
                enabled: true,
                apiKey: 'test-key',
                maxRetries: 1,
            },
            fetchFn: mockFetch,
        });

        const results = await analyzer.analyzeEvents([sampleEvent]);
        expect(results.size).toBe(0);
    });

    it('should reject hallucinated assets that do not exist in source event', () => {
        const sampleEvent = createSampleEvent('evt_anti_hallucinate', {
            title: 'SEC thông báo điều tra một sàn giao dịch',
            summary: 'SEC bắt đầu thanh tra sàn giao dịch tài sản số.',
            tokens: ['SEC'],
            symbols: [],
            content: 'Cơ quan chứng khoán Hoa Kỳ SEC bắt đầu quy trình thanh tra sàn crypto.',
        });

        const rawAiItem = {
            eventId: 'evt_anti_hallucinate',
            isValuable: true,
            titleVi: 'SEC điều tra sàn giao dịch',
            summaryVi: 'SEC bắt đầu thanh tra sàn.',
            whyItMattersVi: 'Ảnh hưởng pháp lý.',
            affectedAssets: ['PEPE', 'SHIB', 'DOGE', 'SEC'], // PEPE, SHIB, DOGE are hallucinated!
            informationValueScore: 80,
            marketRelevanceScore: 80,
            aiConfidence: 0.9,
        };

        const eventMap = new Map([['evt_anti_hallucinate', sampleEvent]]);
        const validated = DeepSeekValidator.validateAnalyses([rawAiItem], eventMap);
        const item = validated.get('evt_anti_hallucinate');

        expect(item).toBeDefined();
        // Hallucinated assets must be discarded
        expect(item?.affectedAssets).toEqual(['SEC']);
        expect(item?.affectedAssets).not.toContain('PEPE');
        expect(item?.affectedAssets).not.toContain('SHIB');
    });

    it('should reuse cached analysis when inputHash is unchanged', async () => {
        const sampleEvent = createSampleEvent('evt_cache');
        const mockResponse = {
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            analyses: [
                                {
                                    eventId: 'evt_cache',
                                    isValuable: true,
                                    titleVi: 'Tin đầu tiên',
                                    summaryVi: 'Tóm tắt tin đầu tiên.',
                                    whyItMattersVi: 'Lý do quan trọng.',
                                    affectedAssets: ['PEPE'],
                                    informationValueScore: 85,
                                    marketRelevanceScore: 85,
                                    aiConfidence: 0.9,
                                },
                            ],
                        }),
                    },
                },
            ],
        };

        const mockFetch = vi.fn().mockResolvedValue(mockResponse);
        const cache = new InMemoryAiAnalysisCache();
        const analyzer = new DeepSeekNewsAnalyzer({
            config: { enabled: true, apiKey: 'test-key' },
            cache,
            fetchFn: mockFetch,
        });

        // First call: hits API
        await analyzer.analyzeEvents([sampleEvent]);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Second call: should hit cache, 0 new API calls!
        const cachedResults = await analyzer.analyzeEvents([sampleEvent]);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(cachedResults.get('evt_cache')?.titleVi).toBe('Tin đầu tiên');
    });

    it('should reanalyze when event undergoes a material update', async () => {
        const sampleEvent = createSampleEvent('evt_material', { impactScore: 70, verificationStatus: VerificationStatus.UNVERIFIED });
        const mockFetch = vi.fn().mockResolvedValue({
            choices: [
                {
                    message: {
                        content: JSON.stringify({
                            analyses: [
                                {
                                    eventId: 'evt_material',
                                    isValuable: true,
                                    titleVi: 'Tin cập nhật',
                                    summaryVi: 'Tóm tắt cập nhật.',
                                    whyItMattersVi: 'Lý do.',
                                    affectedAssets: ['PEPE'],
                                    informationValueScore: 90,
                                    marketRelevanceScore: 90,
                                    aiConfidence: 0.9,
                                },
                            ],
                        }),
                    },
                },
            ],
        });

        const cache = new InMemoryAiAnalysisCache();
        const analyzer = new DeepSeekNewsAnalyzer({
            config: { enabled: true, apiKey: 'test-key' },
            cache,
            fetchFn: mockFetch,
        });

        await analyzer.analyzeEvents([sampleEvent]);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Material update: impactScore changes to 95 and verification becomes primary source
        const updatedEvent = createSampleEvent('evt_material', { impactScore: 95, verificationStatus: VerificationStatus.CONFIRMED_PRIMARY_SOURCE });
        await analyzer.analyzeEvents([updatedEvent]);
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should skip API call and return empty map when AI is disabled', async () => {
        const sampleEvent = createSampleEvent('evt_disabled');
        const mockFetch = vi.fn();
        const analyzer = new DeepSeekNewsAnalyzer({
            config: { enabled: false, apiKey: 'test-key' },
            fetchFn: mockFetch,
        });

        const results = await analyzer.analyzeEvents([sampleEvent]);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(results.size).toBe(0);
    });
});
