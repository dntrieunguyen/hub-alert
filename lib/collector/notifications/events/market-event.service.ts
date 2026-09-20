import { SourceTier } from '../../types';
import type { CryptoFeedItem, MemeTrend } from '../../types';
import { EventPriority, type MacroMetrics, type MarketEvent, MarketEventType, type MemeMetrics, type StatementDetails, VerificationStatus } from '../types';

export class MarketEventService {
    /**
     * Converts a CryptoFeedItem into a verified MarketEvent
     */
    createFromFeedItem(item: CryptoFeedItem): MarketEvent {
        const eventType = this.detectEventType(item);
        const verificationStatus = this.detectVerificationStatus(item, eventType);
        const priority = this.detectPriority(item.impactScore, eventType, verificationStatus);
        const statementDetails = this.extractStatementDetails(item, eventType);
        const macroMetrics = this.extractMacroMetrics(item, eventType);

        return {
            id: `evt_${item.id}`,
            feedItemId: item.id,
            title: item.title,
            summary: item.summary,
            content: item.content,
            url: item.url, // Original source URL
            source: {
                id: item.sourceId,
                name: item.sourceName,
                tier: item.sourceTier,
                credibilityScore: item.credibilityScore,
            },
            category: item.category,
            eventType,
            verificationStatus,
            priority,
            impactScore: item.impactScore,
            tokens: item.tokens,
            symbols: item.symbols,
            chains: item.chains,
            statementDetails,
            macroMetrics,
            publishedAt: item.publishedAt,
            createdAt: new Date(),
        };
    }

    /**
     * Creates a MarketEvent from an aggregated MemeTrend
     */
    createFromMemeTrend(trend: MemeTrend, sourceUrl?: string, officialSources: string[] = []): MarketEvent {
        const impactScore = Math.min(100, Math.round(trend.trendingScore * 0.95 + trend.officialMentions * 5));
        const verificationStatus = trend.officialMentions > 0 ? VerificationStatus.CONFIRMED_PRIMARY_SOURCE : VerificationStatus.CONFIRMED_MULTI_SOURCE;

        const priority = trend.trendingScore >= 90 || trend.officialMentions > 0 ? EventPriority.P0 : EventPriority.P1;

        const memeMetrics: MemeMetrics = {
            mentions1h: trend.mentionCount,
            mentionChangePercent: Math.round(trend.mentionVelocity * 10),
            uniqueSources: trend.uniqueSources,
            velocity: trend.mentionVelocity,
        };

        return {
            id: `evt_meme_${trend.symbol.toLowerCase()}_${Date.now()}`,
            title: `Meme surge detected for ${trend.symbol}`,
            summary: `${trend.symbol} reached trend score ${trend.trendingScore}/100 with ${trend.mentionCount} mentions across ${trend.uniqueSources} sources.`,
            url: sourceUrl || 'https://coindesk.com',
            source: {
                id: 'meme-trend-engine',
                name: officialSources[0] || 'Market Intelligence',
                tier: trend.officialMentions > 0 ? SourceTier.OFFICIAL : SourceTier.RESEARCH,
                credibilityScore: trend.officialMentions > 0 ? 95 : 85,
            },
            category: 'MEMECOIN',
            eventType: MarketEventType.MEME_TREND,
            verificationStatus,
            priority,
            impactScore,
            trendScore: trend.trendingScore,
            tokens: [trend.token],
            symbols: [trend.symbol.startsWith('$') ? trend.symbol : `$${trend.symbol}`],
            chains: trend.chain ? [trend.chain] : [],
            officialSources,
            memeMetrics,
            publishedAt: trend.updatedAt,
            createdAt: new Date(),
        };
    }

    private detectEventType(item: CryptoFeedItem): MarketEventType {
        const text = `${item.title} ${item.summary || ''}`.toLowerCase();

        // Check listing / delisting
        if (item.topics.includes('LISTING') || text.includes('lists ') || text.includes('listing') || text.includes('announced support for')) {
            if (text.includes('robinhood') || text.includes('revolut') || text.includes('etoro')) {
                return MarketEventType.BROKER_LISTING;
            }
            return MarketEventType.EXCHANGE_LISTING;
        }

        if (item.topics.includes('DELISTING') || text.includes('delisting') || text.includes('delists')) {
            return MarketEventType.EXCHANGE_DELISTING;
        }

        // Public official statements vs Government policy
        if (text.includes('trump') || text.includes('biden') || text.includes('gensler') || text.includes('senator') || text.includes('statement') || text.includes('said on')) {
            return MarketEventType.PUBLIC_OFFICIAL_STATEMENT;
        }

        if (item.topics.includes('REGULATION') || text.includes('bill passed') || text.includes('executive order') || text.includes('enacted') || text.includes('treasury sanctions')) {
            return MarketEventType.GOVERNMENT_POLICY;
        }

        // Central bank & Macro
        if (item.topics.includes('FED') || text.includes('federal reserve') || text.includes('interest rate') || text.includes('fomc') || text.includes('ecb') || text.includes('rate decision') || text.includes('rate hike') || text.includes('rate cut')) {
            return MarketEventType.CENTRAL_BANK_DECISION;
        }

        if (item.topics.includes('INFLATION') || text.includes('cpi') || text.includes('ppi') || text.includes('gdp') || text.includes('jobs report') || text.includes('nonfarm')) {
            return MarketEventType.MACRO_DATA;
        }

        // ETF
        if (item.topics.includes('ETF') || text.includes('spot etf')) {
            return MarketEventType.ETF;
        }

        // Security / Hack
        if (item.topics.includes('HACK_EXPLOIT') || text.includes('exploit') || text.includes('drained') || text.includes('hack') || text.includes('vulnerability')) {
            return MarketEventType.SECURITY_INCIDENT;
        }

        // Memecoin
        if (item.category === 'MEMECOIN' || text.includes('memecoin') || text.includes('meme coin')) {
            return MarketEventType.MEME_TREND;
        }

        return MarketEventType.GENERAL_NEWS;
    }

    private detectVerificationStatus(item: CryptoFeedItem, eventType: MarketEventType): VerificationStatus {
        if (item.xMetadata?.verificationStatus) {
            return item.xMetadata.verificationStatus;
        }

        if (eventType === MarketEventType.PUBLIC_OFFICIAL_STATEMENT) {
            return VerificationStatus.ATTRIBUTED_STATEMENT;
        }

        if (item.sourceTier === SourceTier.OFFICIAL) {
            return VerificationStatus.CONFIRMED_PRIMARY_SOURCE;
        }

        if (item.breaking || item.credibilityScore >= 85) {
            return VerificationStatus.CONFIRMED_MULTI_SOURCE;
        }

        if (item.credibilityScore >= 70) {
            return VerificationStatus.ATTRIBUTED_STATEMENT;
        }

        return VerificationStatus.UNVERIFIED;
    }

    private detectPriority(impactScore: number, eventType: MarketEventType, verificationStatus: VerificationStatus): EventPriority {
        const isCriticalType = [
            MarketEventType.EXCHANGE_LISTING,
            MarketEventType.EXCHANGE_DELISTING,
            MarketEventType.CENTRAL_BANK_DECISION,
            MarketEventType.MACRO_DATA,
            MarketEventType.ETF,
            MarketEventType.SECURITY_INCIDENT,
            MarketEventType.GOVERNMENT_POLICY,
        ].includes(eventType);

        if (impactScore >= 90 || (isCriticalType && impactScore >= 80 && verificationStatus !== VerificationStatus.UNVERIFIED)) {
            return EventPriority.P0;
        }

        if (impactScore >= 80) {
            return EventPriority.P1;
        }

        return EventPriority.P2;
    }

    private extractStatementDetails(item: CryptoFeedItem, eventType: MarketEventType): StatementDetails | undefined {
        if (eventType !== MarketEventType.PUBLIC_OFFICIAL_STATEMENT) {
            return undefined;
        }

        const text = `${item.title} ${item.summary || ''}`;
        let speaker = 'Public Official';
        if (text.toLowerCase().includes('trump')) {
            speaker = 'Donald Trump';
        } else if (text.toLowerCase().includes('biden')) {
            speaker = 'Joe Biden';
        } else if (text.toLowerCase().includes('powell')) {
            speaker = 'Jerome Powell';
        } else if (text.toLowerCase().includes('gensler')) {
            speaker = 'Gary Gensler';
        }

        return {
            speaker,
            topic: item.tokens.length > 0 ? `Crypto / ${item.tokens.join(', ')}` : 'Crypto / Digital Assets',
            isEnactedPolicy: false, // Strictly separate public statement from enacted government policy
        };
    }

    private extractMacroMetrics(item: CryptoFeedItem, eventType: MarketEventType): MacroMetrics | undefined {
        if (eventType !== MarketEventType.CENTRAL_BANK_DECISION && eventType !== MarketEventType.MACRO_DATA) {
            return undefined;
        }

        return {
            affectedAssets: ['BTC', 'ETH', 'Crypto', 'Nasdaq', 'Gold'],
        };
    }
}
