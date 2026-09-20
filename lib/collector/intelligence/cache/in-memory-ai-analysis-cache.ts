import { createHash } from 'node:crypto';
import type { MarketEvent } from '../../notifications/types';
import type { AiAnalysisCacheRecord, AiNewsAnalysis } from '../types';

export class InMemoryAiAnalysisCache {
    private cache = new Map<string, AiAnalysisCacheRecord>();
    private readonly defaultTtlMs: number;

    constructor(ttlHours = 24) {
        this.defaultTtlMs = ttlHours * 60 * 60 * 1000;
    }

    /**
     * Computes a deterministic SHA256 hash of the material fields of a MarketEvent.
     * If title, summary, content, impactScore, or verificationStatus change, the hash changes.
     */
    computeInputHash(event: MarketEvent): string {
        const payload = [
            event.id,
            event.title.trim(),
            (event.summary || '').trim(),
            (event.content || '').slice(0, 500).trim(),
            event.eventType,
            event.verificationStatus,
            event.impactScore,
            (event.tokens || []).join(','),
        ].join('|');

        return createHash('sha256').update(payload).digest('hex');
    }

    get(eventId: string, currentHash: string): AiNewsAnalysis | null {
        const record = this.cache.get(eventId);
        if (!record) {
            return null;
        }

        // Check if hash matches
        if (record.inputHash !== currentHash) {
            return null;
        }

        // Check TTL
        if (Date.now() - record.analyzedAt.getTime() > this.defaultTtlMs) {
            this.cache.delete(eventId);
            return null;
        }

        return record.analysis;
    }

    set(
        eventId: string,
        inputHash: string,
        analysis: AiNewsAnalysis,
        provider: string,
        model: string,
        version = 1
    ): void {
        this.cache.set(eventId, {
            eventId,
            inputHash,
            analysis,
            analyzedAt: new Date(),
            provider,
            model,
            version,
        });
    }

    clear(): void {
        this.cache.clear();
    }

    size(): number {
        return this.cache.size;
    }
}
