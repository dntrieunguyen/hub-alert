import { Hono } from 'hono';

import { FeedsController } from './feeds.controller';
import { FeedsService, type FeedsModuleDependencies } from './feeds.service';

export const createFeedsRoutes = (dependencies: FeedsModuleDependencies) => {
    const router = new Hono();
    const service = new FeedsService(dependencies);
    const controller = new FeedsController(service);

    router.get('/feeds', controller.search);
    router.get('/feeds/latest', controller.latest);
    router.get('/latest', controller.latest);
    router.get('/feeds/latest/raw', controller.latestRaw);
    router.get('/latest/raw', controller.latestRaw);
    router.post('/feeds/latest/notify', controller.latestNotify);
    router.post('/latest/notify', controller.latestNotify);
    router.get('/feeds/breaking', controller.breaking);
    router.get('/market/events', controller.marketEvents);

    return router;
};
