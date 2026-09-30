import { Hono } from 'hono';

import { IntelligenceController } from './intelligence.controller';
import { IntelligenceService, type IntelligenceModuleDependencies } from './intelligence.service';

export const createIntelligenceRoutes = (dependencies: IntelligenceModuleDependencies) => {
    const router = new Hono();
    const service = new IntelligenceService(dependencies.aiAnalyzer);
    const controller = new IntelligenceController(service);

    router.get('/ai/status', controller.aiStatus);

    return router;
};
