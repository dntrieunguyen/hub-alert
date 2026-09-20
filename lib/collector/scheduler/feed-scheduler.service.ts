import cache from '@/utils/cache';
import logger from '@/utils/logger';

import type { CollectorService } from '../collector.service';
import type { FeedSourceService } from '../sources/feed-source.service';
import type { FeedSource } from '../types';

export interface SchedulerOptions {
    tickIntervalMs?: number;
    concurrency?: number;
    enableLock?: boolean;
}

export class FeedSchedulerService {
    private sourceService: FeedSourceService;
    private collectorService: CollectorService;
    private tickIntervalMs: number;
    private concurrency: number;
    private enableLock: boolean;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private activeLocks: Set<string> = new Set();

    constructor(sourceService: FeedSourceService, collectorService: CollectorService, options: SchedulerOptions = {}) {
        this.sourceService = sourceService;
        this.collectorService = collectorService;
        this.tickIntervalMs = options.tickIntervalMs ?? 30000; // default 30s
        this.concurrency = options.concurrency ?? 5; // 5 concurrent feeds
        this.enableLock = options.enableLock ?? true;
    }

    /**
     * Starts the scheduler loop
     */
    start(): void {
        if (this.intervalId) {
            return;
        }
        logger.info(`[scheduler.started] Starting FeedScheduler with tick interval ${this.tickIntervalMs}ms and concurrency ${this.concurrency}`);
        this.isRunning = true;

        // Run immediate tick then schedule recurring
        this.tick().catch((err) => logger.error(`[scheduler.tick.error] ${err.message}`));
        this.intervalId = setInterval(() => {
            this.tick().catch((err) => logger.error(`[scheduler.tick.error] ${err.message}`));
        }, this.tickIntervalMs);
    }

    /**
     * Stops the scheduler loop
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('[scheduler.stopped] FeedScheduler stopped');
    }

    /**
     * Returns current scheduler state
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeLocks: Array.from(this.activeLocks),
            tickIntervalMs: this.tickIntervalMs,
            concurrency: this.concurrency,
        };
    }

    /**
     * Executes a single scheduler tick: finds due sources and processes them with limited concurrency
     */
    async tick(): Promise<{ processed: number; failed: number }> {
        const dueSources = this.sourceService.findDueSources();
        if (dueSources.length === 0) {
            return { processed: 0, failed: 0 };
        }

        logger.info(`[scheduler.due_sources] Found ${dueSources.length} due sources to fetch`);

        let processed = 0;
        let failed = 0;

        // Process in chunks up to concurrency limit
        for (let i = 0; i < dueSources.length; i += this.concurrency) {
            const batch = dueSources.slice(i, i + this.concurrency);
            const promises = batch.map(async (source) => {
                const acquired = await this.acquireLock(source.id, source.pollingInterval);
                if (!acquired) {
                    logger.debug(`[scheduler.lock_skipped] Source ${source.id} is currently locked by another instance`);
                    return;
                }

                try {
                    await this.collectorService.collectAndProcessSource(source);
                    this.sourceService.recordSuccess(source.id);
                    processed++;
                } catch (error: any) {
                    this.sourceService.recordFailure(source.id, error.message, error.statusCode);
                    failed++;
                } finally {
                    await this.releaseLock(source.id);
                }
            });

            await Promise.all(promises);
        }

        return { processed, failed };
    }

    private async acquireLock(sourceId: string, ttlSeconds: number): Promise<boolean> {
        if (!this.enableLock) {
            return true;
        }

        // Local in-memory lock check
        if (this.activeLocks.has(sourceId)) {
            return false;
        }

        // Global Redis / Cache claim if supported
        try {
            const lockKey = `rss-feed-lock:${sourceId}`;
            const claimed = await cache.claim(lockKey, Math.min(ttlSeconds, 300));
            if (claimed) {
                this.activeLocks.add(sourceId);
                return true;
            }
            return false;
        } catch {
            this.activeLocks.add(sourceId);
            return true;
        }
    }

    private async releaseLock(sourceId: string): Promise<void> {
        this.activeLocks.delete(sourceId);
        try {
            const lockKey = `rss-feed-lock:${sourceId}`;
            await cache.set(lockKey, '0', 1);
        } catch {
            // Ignore release errors
        }
    }
}
