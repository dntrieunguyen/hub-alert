import type { Context } from 'hono';

import type { XService } from './x.service';

export class XController {
    constructor(private readonly xService: XService) {}

    sources = (c: Context) => {
        const query = c.req.query();
        const result = this.xService.getSources({
            type: query.type,
            priority: query.priority,
        });
        return c.json(result);
    };

    aggregations = (c: Context) => {
        const symbol = c.req.query('symbol');
        const result = this.xService.getAggregations(symbol);
        return c.json(result);
    };
}
