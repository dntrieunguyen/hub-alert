import type { CryptoDigestScheduler, CryptoDigestService } from '../../digest';
import type { NotificationModule } from '../../notifications/notification.module';

export interface NotificationsModuleDependencies {
    notificationModule?: NotificationModule;
    digestService?: CryptoDigestService;
    digestScheduler?: CryptoDigestScheduler;
}

export class NotificationsHttpService {
    constructor(private readonly dependencies: NotificationsModuleDependencies) {}

    private getActiveDigest() {
        return this.dependencies.digestService || this.dependencies.notificationModule?.digestService;
    }

    private getActiveDigestScheduler() {
        return this.dependencies.digestScheduler || this.dependencies.notificationModule?.digestScheduler;
    }

    async sendTestMessage(message?: string) {
        if (!this.dependencies.notificationModule) {
            return { ok: false as const, status: 503 as const, error: 'Notification module not configured' };
        }
        const result = await this.dependencies.notificationModule.sendManualTestMessage(message);
        if (!result.success) {
            return { ok: false as const, status: 400 as const, result };
        }
        return { ok: true as const, result };
    }

    getHealth() {
        if (!this.dependencies.notificationModule) {
            return { googleChat: { enabled: false, configured: false } };
        }
        return this.dependencies.notificationModule.getHealthStatus();
    }

    async triggerDigest(options: { dryRun: boolean; forceSend: boolean }) {
        const activeDigest = this.getActiveDigest();
        if (!activeDigest) {
            return { ok: false as const, status: 503 as const, error: 'Crypto digest service not available' };
        }
        const result = await activeDigest.generateAndSendDigest(options);
        if (!result.success && result.error) {
            return { ok: false as const, status: 500 as const, result };
        }
        return { ok: true as const, result };
    }

    async previewDigest() {
        const activeDigest = this.getActiveDigest();
        if (!activeDigest) {
            return { ok: false as const, status: 503 as const, error: 'Crypto digest service not available' };
        }
        const result = await activeDigest.generateAndSendDigest({ dryRun: true });
        return { ok: true as const, result };
    }

    async getDigestHistory(limit: number) {
        const activeDigest = this.getActiveDigest();
        if (!activeDigest) {
            return { ok: false as const, status: 503 as const, error: 'Crypto digest service not available' };
        }
        const history = await activeDigest.deliveryRepository.getDeliveryHistory(limit);
        return { ok: true as const, history };
    }

    getDigestStatus() {
        const activeDigest = this.getActiveDigest();
        const activeScheduler = this.getActiveDigestScheduler();
        return {
            config: activeDigest?.configService.getConfig(),
            scheduler: activeScheduler?.getStatus(),
        };
    }
}
