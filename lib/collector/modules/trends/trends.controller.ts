import type { Context } from 'hono';

import type { TrendsService, TrendWindow } from './trends.service';

export class TrendsController {
    constructor(private readonly trendsService: TrendsService) {}

    tokens = async (c: Context) => {
        const window = (c.req.query('window') as TrendWindow) || '1h';
        const trends = await this.trendsService.getTokenTrends(window);
        return c.json(trends);
    };

    memes = async (c: Context) => {
        const window = (c.req.query('window') as TrendWindow) || '1h';
        const trends = await this.trendsService.getMemeTrends(window);
        return c.json(trends);
    };
}
