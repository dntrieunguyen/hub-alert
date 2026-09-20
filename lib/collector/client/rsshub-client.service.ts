import logger from '@/utils/logger';
import ofetch from '@/utils/ofetch';

import { type RawRssFeed, RssParserService } from '../parser/rss-parser.service';
import type { FeedSource } from '../types';

export interface FetchResult {
    sourceId: string;
    feed: RawRssFeed;
    durationMs: number;
}

export class RSSHubClientService {
    private parserService: RssParserService;

    constructor(parserService?: RssParserService) {
        this.parserService = parserService ?? new RssParserService();
    }

    async fetchFeed(source: FeedSource): Promise<FetchResult> {
        const start = Date.now();
        logger.info(`[feed.collect.started] Fetching feed for source: ${source.id} (${source.rssUrl})`);

        try {
            // First fetch raw XML via ofetch to get accurate HTTP status codes and headers
            const xmlContent = await ofetch<string>(source.rssUrl, {
                responseType: 'text',
                headers: {
                    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
                },
                timeout: 20000,
                retry: 1, // Let high level scheduler control backoff
            });

            if (!xmlContent || typeof xmlContent !== 'string') {
                throw new Error(`Empty response received from ${source.rssUrl}`);
            }

            const feed = await this.parserService.parseString(xmlContent);
            const durationMs = Date.now() - start;

            logger.info(`[feed.collect.completed] Source ${source.id}: received ${feed.items.length} items in ${durationMs}ms`);

            return {
                sourceId: source.id,
                feed,
                durationMs,
            };
        } catch (error: any) {
            const durationMs = Date.now() - start;
            const statusCode = error.response?.status || error.statusCode || error.status;

            logger.error(`[feed.collect.failed] Source ${source.id} failed after ${durationMs}ms: ${error.message} (status: ${statusCode || 'unknown'})`);

            const enhancedError: any = new Error(`Failed to fetch feed ${source.id}: ${error.message}`);
            enhancedError.statusCode = statusCode;
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }
}
