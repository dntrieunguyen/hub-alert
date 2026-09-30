import { Hono } from 'hono';

import { OperationsController } from './operations.controller';
import { OperationsService, type OperationsModuleDependencies } from './operations.service';

export const createOperationsRoutes = (dependencies: OperationsModuleDependencies) => {
    const router = new Hono();
    const service = new OperationsService(dependencies);
    const controller = new OperationsController(service);

    router.get('/sources', controller.listSources);
    router.post('/sources/:id/collect', controller.collectSource);
    router.get('/scheduler/status', controller.schedulerStatus);
    router.post('/scheduler/start', controller.startScheduler);
    router.post('/scheduler/stop', controller.stopScheduler);

    return router;
};
