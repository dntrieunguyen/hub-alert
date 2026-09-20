import type { FeedSource } from '../types';
import { buildInitialSources } from './feed-sources.config';

export class FeedSourceService {
    private sources: Map<string, FeedSource> = new Map();

    constructor(initialSources?: FeedSource[]) {
        const sources = initialSources ?? buildInitialSources();
        for (const source of sources) {
            this.sources.set(source.id, { ...source });
        }
    }

    getAllSources(): FeedSource[] {
        return Array.from(this.sources.values());
    }

    getSourceById(id: string): FeedSource | undefined {
        return this.sources.get(id);
    }

    findDueSources(now: Date = new Date()): FeedSource[] {
        const nowMs = now.getTime();
        return Array.from(this.sources.values()).filter((s) => s.enabled && s.nextFetchAt.getTime() <= nowMs);
    }

    addSource(source: FeedSource): void {
        this.sources.set(source.id, { ...source });
    }

    setSourceEnabled(id: string, enabled: boolean): boolean {
        const source = this.sources.get(id);
        if (!source) {
            return false;
        }
        source.enabled = enabled;
        return true;
    }

    recordSuccess(id: string, now: Date = new Date()): void {
        const source = this.sources.get(id);
        if (!source) {
            return;
        }

        source.lastSuccessAt = now;
        source.failureCount = 0;
        source.lastError = undefined;

        // Next fetch based on configured pollingInterval
        source.nextFetchAt = new Date(now.getTime() + source.pollingInterval * 1000);
    }

    recordFailure(id: string, error: string, statusCode?: number, now: Date = new Date()): void {
        const source = this.sources.get(id);
        if (!source) {
            return;
        }

        source.lastFailureAt = now;
        source.failureCount += 1;
        source.lastError = error;

        // If 404 or permanent invalid route, back off heavily or disable
        if (statusCode === 404) {
            // Backoff for 1 hour for 404s
            source.nextFetchAt = new Date(now.getTime() + 3600 * 1000);
            return;
        }

        // Exponential backoff strategy: 30s -> 1m -> 5m -> 15m
        let backoffSeconds = 30;
        if (source.failureCount === 1) {
            backoffSeconds = 30;
        } else if (source.failureCount === 2) {
            backoffSeconds = 60;
        } else if (source.failureCount === 3) {
            backoffSeconds = 300;
        } else {
            backoffSeconds = 900;
        }

        source.nextFetchAt = new Date(now.getTime() + backoffSeconds * 1000);
    }
}
