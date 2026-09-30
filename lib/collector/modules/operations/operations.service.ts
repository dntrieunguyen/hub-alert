import type { CollectorService } from '../../collector.service';
import type { FeedSchedulerService } from '../../scheduler/feed-scheduler.service';
import type { FeedSourceService } from '../../sources/feed-source.service';

export interface OperationsModuleDependencies {
    sourceService: FeedSourceService;
    collectorService: CollectorService;
    scheduler?: FeedSchedulerService;
}

export class OperationsService {
    constructor(private readonly dependencies: OperationsModuleDependencies) {}

    listSources() {
        const sources = this.dependencies.sourceService.getAllSources();
        return {
            count: sources.length,
            sources,
        };
    }

    async collectSource(sourceId: string) {
        const source = this.dependencies.sourceService.getSourceById(sourceId);
        if (!source) {
            return { ok: false as const, status: 404 as const, error: `Source not found: ${sourceId}` };
        }

        try {
            const result = await this.dependencies.collectorService.collectAndProcessSource(source);
            this.dependencies.sourceService.recordSuccess(sourceId);
            return { ok: true as const, result };
        } catch (error: any) {
            this.dependencies.sourceService.recordFailure(sourceId, error.message, error.statusCode);
            return { ok: false as const, status: 500 as const, error: error.message };
        }
    }

    getSchedulerStatus() {
        if (!this.dependencies.scheduler) {
            return { ok: false as const, status: 503 as const, error: 'Scheduler service not configured' };
        }
        return { ok: true as const, status: this.dependencies.scheduler.getStatus() };
    }

    startScheduler() {
        if (!this.dependencies.scheduler) {
            return { ok: false as const, status: 503 as const, error: 'Scheduler service not configured' };
        }
        this.dependencies.scheduler.start();
        return {
            ok: true as const,
            message: 'Scheduler started',
            status: this.dependencies.scheduler.getStatus(),
        };
    }

    stopScheduler() {
        if (!this.dependencies.scheduler) {
            return { ok: false as const, status: 503 as const, error: 'Scheduler service not configured' };
        }
        this.dependencies.scheduler.stop();
        return {
            ok: true as const,
            message: 'Scheduler stopped',
            status: this.dependencies.scheduler.getStatus(),
        };
    }
}
