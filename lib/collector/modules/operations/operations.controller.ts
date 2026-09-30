import type { Context } from 'hono';

import type { OperationsService } from './operations.service';

export class OperationsController {
    constructor(private readonly operationsService: OperationsService) {}

    listSources = (c: Context) => {
        return c.json(this.operationsService.listSources());
    };

    collectSource = async (c: Context) => {
        const sourceId = c.req.param('id');
        const result = await this.operationsService.collectSource(sourceId);
        if (!result.ok) {
            return c.json({ error: result.error }, result.status);
        }
        return c.json(result.result);
    };

    schedulerStatus = (c: Context) => {
        const result = this.operationsService.getSchedulerStatus();
        if (!result.ok) {
            return c.json({ error: result.error }, result.status);
        }
        return c.json(result.status);
    };

    startScheduler = (c: Context) => {
        const result = this.operationsService.startScheduler();
        if (!result.ok) {
            return c.json({ error: result.error }, result.status);
        }
        return c.json({ message: result.message, status: result.status });
    };

    stopScheduler = (c: Context) => {
        const result = this.operationsService.stopScheduler();
        if (!result.ok) {
            return c.json({ error: result.error }, result.status);
        }
        return c.json({ message: result.message, status: result.status });
    };
}
