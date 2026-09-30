import { Hono } from 'hono';

import { TrendsController } from './trends.controller';
import { TrendsService, type TrendsModuleDependencies } from './trends.service';

export const createTrendsRoutes = (dependencies: TrendsModuleDependencies) => {
    const router = new Hono();
    const service = new TrendsService(dependencies.trendService);
    const controller = new TrendsController(service);

    router.get('/trends/tokens', controller.tokens);
    router.get('/trends/memes', controller.memes);

    return router;
};
