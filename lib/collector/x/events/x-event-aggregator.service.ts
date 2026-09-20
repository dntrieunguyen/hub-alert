import { SourceTier, XSourceType } from '../../types';
import type { XEventAggregation, XSource } from '../types';

export interface RecordedMention {
    symbol: string;
    handle: string;
    sourceName: string;
    sourceType: XSourceType | SourceTier;
    isOfficial: boolean;
    isNews: boolean;
    postUrl: string;
    timestamp: Date;
    impactScore: number;
}

export class XEventAggregatorService {
    private readonly windowMs: number;
    private readonly mentionsBySymbol: Map<string, RecordedMention[]> = new Map();

    constructor(windowMinutes: number = 20) {
        this.windowMs = windowMinutes * 60 * 1000;
    }

    /**
     * Records a new mention of a symbol from an X post or news source
     */
    public recordMention(
        symbol: string,
        source: XSource | { handle: string; displayName: string; sourceType: any },
        postUrl: string,
        impactScore: number = 50,
        timestamp: Date = new Date(),
    ): void {
        const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '');
        const isOfficial =
            source.sourceType === XSourceType.EXCHANGE ||
            source.sourceType === XSourceType.BROKER ||
            source.sourceType === XSourceType.GOVERNMENT_AGENCY ||
            source.sourceType === XSourceType.GOVERNMENT_INSTITUTION ||
            source.sourceType === XSourceType.CENTRAL_BANK ||
            source.sourceType === XSourceType.CRYPTO_PROJECT ||
            source.sourceType === SourceTier.OFFICIAL;

        const isNews = source.sourceType === XSourceType.NEWS || source.sourceType === SourceTier.NEWS;

        const mention: RecordedMention = {
            symbol: cleanSymbol,
            handle: source.handle,
            sourceName: source.displayName || source.handle,
            sourceType: source.sourceType,
            isOfficial,
            isNews,
            postUrl,
            timestamp,
            impactScore,
        };

        const existing = this.mentionsBySymbol.get(cleanSymbol) || [];
        existing.push(mention);
        this.mentionsBySymbol.set(cleanSymbol, existing);
    }

    /**
     * Cleans up mentions older than the rolling window
     */
    public cleanup(now: Date = new Date()): void {
        const cutoff = now.getTime() - this.windowMs;
        for (const [symbol, mentions] of this.mentionsBySymbol.entries()) {
            const filtered = mentions.filter((m) => m.timestamp.getTime() >= cutoff);
            if (filtered.length === 0) {
                this.mentionsBySymbol.delete(symbol);
            } else {
                this.mentionsBySymbol.set(symbol, filtered);
            }
        }
    }

    /**
     * Computes aggregation metrics for a specific symbol
     */
    public getAggregation(symbol: string, now: Date = new Date()): XEventAggregation | null {
        this.cleanup(now);
        const cleanSymbol = symbol.toUpperCase().replace(/^\$/, '');
        const mentions = this.mentionsBySymbol.get(cleanSymbol);
        if (!mentions || mentions.length === 0) {
            return null;
        }

        const distinctOfficial = new Set<string>();
        const distinctNews = new Set<string>();
        const distinctSources = new Set<string>();
        const postUrls: string[] = [];

        let firstSeen = mentions[0].timestamp;
        let lastSeen = mentions[0].timestamp;

        for (const m of mentions) {
            distinctSources.add(m.handle);
            if (m.isOfficial) {
                distinctOfficial.add(m.handle);
            }
            if (m.isNews) {
                distinctNews.add(m.handle);
            }
            if (m.postUrl && !postUrls.includes(m.postUrl)) {
                postUrls.push(m.postUrl);
            }
            if (m.timestamp < firstSeen) {
                firstSeen = m.timestamp;
            }
            if (m.timestamp > lastSeen) {
                lastSeen = m.timestamp;
            }
        }

        const durationMinutes = Math.max(1, (lastSeen.getTime() - firstSeen.getTime()) / (60 * 1000));
        const mentionVelocity = Number((mentions.length / durationMinutes).toFixed(2));

        // Event classification
        let eventName = `${cleanSymbol}_ACTIVITY_SURGE`;
        if (distinctOfficial.size >= 2) {
            eventName = `${cleanSymbol}_MULTI_EXCHANGE_LISTING_CONSENSUS`;
        } else if (distinctOfficial.size === 1) {
            eventName = `${cleanSymbol}_OFFICIAL_LISTING_ANNOUNCED`;
        }

        // Trend score 0 - 100
        const officialWeight = distinctOfficial.size * 25; // up to 50-75
        const newsWeight = distinctNews.size * 10;
        const velocityWeight = Math.min(25, mentionVelocity * 5);
        const trendScore = Math.min(100, Math.round(officialWeight + newsWeight + velocityWeight + Math.min(20, mentions.length)));

        return {
            symbol: cleanSymbol,
            event: eventName,
            officialSources: distinctOfficial.size,
            newsSources: distinctNews.size,
            socialMentions: mentions.length,
            mentionVelocity,
            trendScore,
            firstSeenAt: firstSeen,
            lastSeenAt: lastSeen,
            sources: Array.from(distinctSources),
            postUrls: postUrls.slice(0, 10),
        };
    }

    /**
     * Returns aggregations for all currently active symbols in the rolling window
     */
    public getAllAggregations(now: Date = new Date()): XEventAggregation[] {
        this.cleanup(now);
        const results: XEventAggregation[] = [];
        for (const symbol of this.mentionsBySymbol.keys()) {
            const agg = this.getAggregation(symbol, now);
            if (agg) {
                results.push(agg);
            }
        }
        return results.sort((a, b) => b.trendScore - a.trendScore);
    }
}
