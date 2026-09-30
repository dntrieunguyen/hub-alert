import type { Context } from 'hono';

import type { FeedCategory, FeedFilterOptions, SourceTier, VerificationStatus, XEventType, XSourceType } from '../../types';
import type { FeedsService } from './feeds.service';

export class FeedsController {
    constructor(private readonly feedsService: FeedsService) {}

    search = async (c: Context) => {
        const query = c.req.query();
        const category = query.category as FeedCategory | undefined;
        const sourceId = query.source;
        const sourceTier = query.sourceTier as SourceTier | undefined;
        const token = query.token;
        const topic = query.topic;
        const breaking = query.breaking !== undefined ? query.breaking === 'true' : undefined;
        const minCredibility = query.minCredibility ? Number.parseInt(query.minCredibility, 10) : undefined;
        const from = query.from ? new Date(query.from) : undefined;
        const to = query.to ? new Date(query.to) : undefined;
        const limit = Math.min(100, Number.parseInt(query.limit || '20', 10));
        const offset = Number.parseInt(query.offset || '0', 10);
        const platform = query.platform as 'RSS' | 'X' | undefined;
        const xSourceType = (query.sourceType || query.xSourceType) as XSourceType | undefined;
        const handle = query.handle;
        const verificationStatus = query.verification as VerificationStatus | undefined;
        const eventType = query.type as XEventType | undefined;

        const filterOptions: FeedFilterOptions = {
            category,
            sourceId,
            sourceTier,
            token,
            topic,
            breaking,
            minCredibility,
            from,
            to,
            limit,
            offset,
            platform,
            xSourceType,
            handle,
            verificationStatus,
            eventType,
        };

        const result = await this.feedsService.searchFeeds(filterOptions);
        return c.json(result);
    };

    latest = async (c: Context) => {
        const limitStr = c.req.query('limit');
        const limit = limitStr ? Number.parseInt(limitStr, 10) : 10;
        const raw = c.req.query('raw') === 'true' || c.req.query('raw') === '1';
        const forceRefresh = c.req.query('refresh') === 'true' || c.req.query('refresh') === '1';
        const notifyQuery = c.req.query('notify');
        const shouldNotify = notifyQuery !== 'false' && notifyQuery !== '0';

        const result = await this.feedsService.getLatestIntelligence({
            limit,
            raw,
            forceRefresh,
            shouldNotify,
        });
        return c.json(result);
    };

    latestRaw = async (c: Context) => {
        const limitStr = c.req.query('limit');
        const limit = limitStr ? Math.min(100, Number.parseInt(limitStr, 10)) : 20;
        const result = await this.feedsService.getLatestRaw(limit);
        return c.json(result);
    };

    latestNotify = async (c: Context) => {
        const limitStr = c.req.query('limit');
        const limit = limitStr ? Number.parseInt(limitStr, 10) : 10;
        const result = await this.feedsService.sendLatestNotification(limit);
        if (!result.sent && result.error) {
            return c.json(result, 500);
        }
        return c.json(result);
    };

    breaking = async (c: Context) => {
        const limit = Math.min(100, Number.parseInt(c.req.query('limit') || '20', 10));
        const result = await this.feedsService.getBreaking(limit);
        return c.json(result);
    };

    marketEvents = async (c: Context) => {
        const query = c.req.query();
        const limit = Math.min(100, Number.parseInt(query.limit || '20', 10));
        const verificationStatus = query.verification as VerificationStatus | undefined;
        const eventType = query.type as XEventType | undefined;

        const result = await this.feedsService.getMarketEvents({
            limit,
            verificationStatus,
            eventType,
        });
        return c.json(result);
    };
}
