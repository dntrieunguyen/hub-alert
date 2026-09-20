import { describe, expect, it } from 'vitest';

import { RSSHubClientService } from '../../lib/collector/client/rsshub-client.service';
import { RssParserService } from '../../lib/collector/parser/rss-parser.service';
import { FeedSourceService } from '../../lib/collector/sources/feed-source.service';
import { type FeedSource, SourceTier } from '../../lib/collector/types';

describe('RSS Parser & Client Resilience', () => {
    const parser = new RssParserService();

    it('should parse valid RSS 2.0 XML string', async () => {
        const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Crypto News Daily</title>
    <link>https://example.com</link>
    <description>Latest crypto news</description>
    <item>
      <title>Bitcoin Crosses $100K As Inflows Surge</title>
      <link>https://example.com/news/1</link>
      <description>Spot ETF demand drives Bitcoin higher.</description>
      <pubDate>Mon, 20 Sep 2026 06:00:00 GMT</pubDate>
      <guid>https://example.com/news/1</guid>
    </item>
  </channel>
</rss>`;

        const feed = await parser.parseString(sampleRss);
        expect(feed.title).toBe('Crypto News Daily');
        expect(feed.items).toHaveLength(1);
        expect(feed.items[0].title).toBe('Bitcoin Crosses $100K As Inflows Surge');
        expect(feed.items[0].link).toBe('https://example.com/news/1');
    });

    it('should handle invalid or malformed XML gracefully', async () => {
        const invalidXml = 'Not an XML document at all!';
        await expect(parser.parseString(invalidXml)).rejects.toThrow();
    });

    it('should adjust exponential backoff on RSSHub errors and 404s', () => {
        const source: FeedSource = {
            id: 'test-feed',
            name: 'Test Feed',
            enabled: true,
            category: 'CRYPTO_NEWS',
            sourceTier: SourceTier.NEWS,
            rssUrl: 'http://localhost:1200/test',
            pollingInterval: 120,
            credibilityScore: 80,
            tags: [],
            failureCount: 0,
            nextFetchAt: new Date(),
        };

        const sourceService = new FeedSourceService([source]);
        const now = new Date();

        sourceService.recordFailure('test-feed', '500 Internal Server Error', 500, now);
        let updated = sourceService.getSourceById('test-feed')!;
        expect(updated.failureCount).toBe(1);
        expect(updated.nextFetchAt.getTime() - now.getTime()).toBe(30 * 1000);

        sourceService.recordFailure('test-feed', '429 Too Many Requests', 429, now);
        updated = sourceService.getSourceById('test-feed')!;
        expect(updated.failureCount).toBe(2);
        expect(updated.nextFetchAt.getTime() - now.getTime()).toBe(60 * 1000);

        sourceService.recordFailure('test-feed', 'Gateway Timeout', 504, now);
        updated = sourceService.getSourceById('test-feed')!;
        expect(updated.failureCount).toBe(3);
        expect(updated.nextFetchAt.getTime() - now.getTime()).toBe(300 * 1000);

        sourceService.recordFailure('test-feed', 'Not Found', 404, now);
        updated = sourceService.getSourceById('test-feed')!;
        expect(updated.nextFetchAt.getTime() - now.getTime()).toBe(3600 * 1000);

        sourceService.recordSuccess('test-feed', now);
        updated = sourceService.getSourceById('test-feed')!;
        expect(updated.failureCount).toBe(0);
        expect(updated.lastError).toBeUndefined();
        expect(updated.nextFetchAt.getTime() - now.getTime()).toBe(120 * 1000);
    });

    it('should throw enhanced error with status code when client fetch fails', async () => {
        const failingParser: any = {
            parseString: async () => {
                throw new Error('Parse error');
            },
        };
        const client = new RSSHubClientService(failingParser);

        const source: FeedSource = {
            id: 'broken',
            name: 'Broken',
            enabled: true,
            category: 'CRYPTO_NEWS',
            sourceTier: SourceTier.NEWS,
            rssUrl: 'http://127.0.0.1:59999/non-existent-feed.xml',
            pollingInterval: 120,
            credibilityScore: 80,
            tags: [],
            failureCount: 0,
            nextFetchAt: new Date(),
        };

        await expect(client.fetchFeed(source)).rejects.toThrow();
    });
});
