import { Hono } from 'hono';

import { XController } from './x.controller';
import { XService, type XModuleDependencies } from './x.service';

export const createXRoutes = (dependencies: XModuleDependencies) => {
    const router = new Hono();
    const service = new XService(dependencies.collectorService);
    const controller = new XController(service);

    router.get('/x/sources', controller.sources);
    router.get('/x/aggregations', controller.aggregations);

    return router;
};
