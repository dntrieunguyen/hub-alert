import type { Context } from 'hono';

import type { NotificationsHttpService } from './notifications.service';

export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsHttpService) {}

    testGoogleChat = async (c: Context) => {
        let body: any = {};
        try {
            body = await c.req.json();
        } catch {
            // Body is optional
        }

        const result = await this.notificationsService.sendTestMessage(body?.message);
        if (!result.ok) {
            if (result.status === 503) {
                return c.json({ error: result.error }, 503);
            }
            return c.json(result.result, 400);
        }
        return c.json(result.result);
    };

    health = (c: Context) => {
        return c.json(this.notificationsService.getHealth());
    };

    triggerDigest = async (c: Context) => {
        const dryRunQuery = c.req.query('dryRun');
        let body: any = {};
        try {
            body = await c.req.json();
        } catch {
            // Optional body
        }

        const dryRun = dryRunQuery === 'true' || dryRunQuery === '1' || Boolean(body.dryRun);
        const forceSend = Boolean(body.forceSend);

        const result = await this.notificationsService.triggerDigest({ dryRun, forceSend });
        if (!result.ok) {
            if (result.status === 503) {
                return c.json({ error: result.error }, 503);
            }
            return c.json(result.result, 500);
        }
        return c.json(result.result);
    };

    previewDigest = async (c: Context) => {
        const result = await this.notificationsService.previewDigest();
        if (!result.ok) {
            return c.json({ error: result.error }, result.status);
        }
        return c.json(result.result);
    };

    digestHistory = async (c: Context) => {
        const limitStr = c.req.query('limit');
        const limit = limitStr ? Number.parseInt(limitStr, 10) : 20;
        const result = await this.notificationsService.getDigestHistory(limit);
        if (!result.ok) {
            return c.json({ error: result.error }, result.status);
        }
        return c.json({ history: result.history });
    };

    digestStatus = (c: Context) => {
        return c.json(this.notificationsService.getDigestStatus());
    };
}
