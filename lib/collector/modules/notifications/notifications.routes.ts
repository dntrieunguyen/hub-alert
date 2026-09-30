import { Hono } from 'hono';

import { NotificationsController } from './notifications.controller';
import { NotificationsHttpService, type NotificationsModuleDependencies } from './notifications.service';

export const createNotificationsRoutes = (dependencies: NotificationsModuleDependencies) => {
    const router = new Hono();
    const service = new NotificationsHttpService(dependencies);
    const controller = new NotificationsController(service);

    router.post('/notifications/google-chat/test', controller.testGoogleChat);
    router.get('/notifications/health', controller.health);
    router.post('/digest/trigger', controller.triggerDigest);
    router.get('/digest/preview', controller.previewDigest);
    router.get('/digest/history', controller.digestHistory);
    router.get('/digest/status', controller.digestStatus);

    return router;
};
