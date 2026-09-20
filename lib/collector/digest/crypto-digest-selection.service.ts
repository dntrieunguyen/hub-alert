import { SourceTier, VerificationStatus } from '../types';
import { type MarketEvent, MarketEventType } from '../notifications/types';
import type { CryptoDigestRankingService } from './crypto-digest-ranking.service';
import type { AggregatedMarketEvent, AggregatedSourceInfo, DigestConfig } from './types';
import { isCryptoMarketRelevant, isValidTitle } from './crypto-digest-relevance.service';
import { detectGenericFiller, isValidHttpUrl, validateVietnameseOutput } from './crypto-digest-vietnamese-validator';

/**
 * Ranks sources according to Section 20 Preferred Primary Source:
 * Official > Government / Central Bank > Exchange/project > Reuters/Bloomberg > Crypto publication > Aggregator > Social
 */
export function getSourceAuthoritativenessRank(sourceName: string, tier: SourceTier): number {
    const name = (sourceName || '').toLowerCase();
    // 1. Government / Central Bank / Regulator
    if (
        name.includes('federal reserve') ||
        name.includes('the fed') ||
        name.includes('sec') ||
        name.includes('cftc') ||
        name.includes('treasury') ||
        name.includes('white house') ||
        name.includes('ecb')
    ) {
        return 80;
    }
    // 2. Official protocol / project source
    if (tier === SourceTier.OFFICIAL) {
        return 70;
    }
    // 3. Top Tier Exchange / Top Broker
    if (
        name.includes('coinbase') ||
        name.includes('binance') ||
        name.includes('okx') ||
        name.includes('kraken') ||
        name.includes('bybit') ||
        name.includes('robinhood')
    ) {
        return 60;
    }
    // 4. Reuters / Bloomberg
    if (name.includes('reuters') || name.includes('bloomberg')) {
        return 50;
    }
    // 5. Crypto Native Media
    if (
        name.includes('coindesk') ||
        name.includes('cointelegraph') ||
        name.includes('the block') ||
        name.includes('blockworks') ||
        name.includes('decrypt')
    ) {
        return 40;
    }
    // 6. News / Research / Aggregator (Jin10, etc.)
    if (tier === SourceTier.NEWS || tier === SourceTier.RESEARCH) {
        return 30;
    }
    // 7. Social / Community
    return 10;
}

export class CryptoDigestSelectionService {
    private rankingService: CryptoDigestRankingService;

    constructor(rankingService: CryptoDigestRankingService) {
        this.rankingService = rankingService;
    }

    /**
     * Aggregates raw MarketEvents, filters candidates with hard quality gates,
     * analyzes in batches with DeepSeek, applies replenishment if needed,
     * enforces diversity controls, and selects the true Top 10 unique events.
     */
    async selectDigestEvents(
        events: MarketEvent[],
        config: DigestConfig,
        previouslyDeliveredFingerprints: Set<string> = new Set(),
        aiAnalyzer?: { analyzeEvents(events: MarketEvent[]): Promise<Map<string, any>> }
    ): Promise<AggregatedMarketEvent[]> {
        if (!events || events.length === 0) {
            return [];
        }

        // Step 1: Pre-filter input events by hard title validation & market relevance
        const validRelevantEvents = events.filter((e) => {
            if (!isValidTitle(e.title)) {
                return false;
            }
            if (!isCryptoMarketRelevant(e)) {
                return false;
            }
            return true;
        });

        if (validRelevantEvents.length === 0) {
            return [];
        }

        // Step 2: Cross-Source Deduplication & Event Aggregation (Stage A Deterministic)
        const aggregatedEvents = this.aggregateEvents(validRelevantEvents);

        // Step 3: Initial Deterministic Ranking Score Calculation
        for (const item of aggregatedEvents) {
            const breakdown = this.rankingService.calculateRankingScore(item, config.lookbackHours, config.weights);
            item.rankingBreakdown = breakdown;
            item.digestRankingScore = breakdown.totalRankingScore;
        }

        // Step 4: Candidate Filtering (Quality Gate: minImpactScore >= 45, minCredibility >= 70)
        const qualifiedCandidates = aggregatedEvents.filter((item) => {
            // Check previous delivery duplicate
            if (previouslyDeliveredFingerprints.has(item.canonicalFingerprint)) {
                return false;
            }

            // Exclude disputed events
            if (item.verificationStatus === VerificationStatus.DISPUTED) {
                return false;
            }

            // Exclude unverified rumors without multi-source confirmation
            if (item.verificationStatus === VerificationStatus.UNVERIFIED && item.sourceCount < 2) {
                return false;
            }

            // Strict Quality Gate: Impact Score below minimum (e.g. 15 or < 45) is NEVER allowed
            if (item.impactScore < config.minImpactScore) {
                return false;
            }

            // Credibility Score Gate
            const credScore = item.rankingBreakdown?.credibilityScore ?? 0;
            const satisfiesCandidateScore =
                credScore >= config.minCredibility ||
                item.impactScore >= 70 ||
                item.primaryEvent.priority === 'P0' ||
                item.primaryEvent.priority === 'P1' ||
                item.primaryEvent.metadata?.breaking === true;

            if (!satisfiesCandidateScore) {
                return false;
            }

            // Specific Memecoin Quality Rules
            if (item.category === 'MEMECOIN' || item.eventType === MarketEventType.MEME_TREND) {
                if (!this.satisfiesMemecoinRules(item)) {
                    return false;
                }
            }

            return true;
        });

        // Sort candidates by initial ranking score descending
        qualifiedCandidates.sort((a, b) => (b.digestRankingScore ?? 0) - (a.digestRankingScore ?? 0));

        // Step 5: Candidate Replenishment Loop with AI Analysis Batching
        const batchSize = config.candidateBatchSize || 50;
        const maxScan = config.maxScanItems || 300;
        let cursor = 0;
        let analyzedCandidates: AggregatedMarketEvent[] = [];
        let selected: AggregatedMarketEvent[] = [];

        while (cursor < qualifiedCandidates.length && cursor < maxScan) {
            const batch = qualifiedCandidates.slice(cursor, cursor + batchSize);
            cursor += batchSize;

            if (batch.length === 0) {
                break;
            }

            // Run AI analysis on this batch if enabled
            if (aiAnalyzer && config.aiEnabled) {
                try {
                    const marketEventsToAnalyze = batch.map((c) => c.primaryEvent);
                    const analysesMap = await aiAnalyzer.analyzeEvents(marketEventsToAnalyze);

                    for (const item of batch) {
                        const analysis = analysesMap.get(item.primaryEvent.id);
                        if (analysis) {
                            item.aiAnalysis = analysis;
                        }
                        // Recompute ranking score with AI weights (infoValue + marketRelevance)
                        const breakdown = this.rankingService.calculateRankingScore(item, config.lookbackHours, config.weights);
                        item.rankingBreakdown = breakdown;
                        item.digestRankingScore = breakdown.totalRankingScore;
                    }

                    // Filter out AI rejected items, semantic duplicates, and generic fillers
                    const passingBatch = batch.filter((item) => {
                        if (item.aiAnalysis) {
                            // Rejection / Not valuable
                            if (item.aiAnalysis.includeInDigest === false || item.aiAnalysis.isValuable === false) {
                                return false;
                            }
                            // Semantic duplicate
                            if (item.aiAnalysis.isDuplicate || item.aiAnalysis.duplicateOfEventId) {
                                return false;
                            }
                            // Information value and relevance quality gates
                            if (item.aiAnalysis.informationValueScore < config.minInformationValue) {
                                return false;
                            }
                            if (item.aiAnalysis.marketRelevanceScore < config.minMarketRelevance) {
                                return false;
                            }
                            // Reject generic filler summary
                            if (detectGenericFiller(item.aiAnalysis.summaryVi)) {
                                return false;
                            }
                        }
                        return true;
                    });

                    analyzedCandidates.push(...passingBatch);
                } catch {
                    // Graceful fallback to deterministic batch
                    analyzedCandidates.push(...batch);
                }
            } else {
                analyzedCandidates.push(...batch);
            }

            // Minimum ranking score gate
            const currentQualified = analyzedCandidates.filter((item) => {
                const rankScore = item.digestRankingScore ?? 0;
                return rankScore >= config.minRankingScore;
            });

            // Sort by final digest ranking score descending
            currentQualified.sort((a, b) => {
                const scoreDiff = (b.digestRankingScore ?? 0) - (a.digestRankingScore ?? 0);
                if (Math.abs(scoreDiff) > 0.01) {
                    return scoreDiff;
                }
                const impactDiff = b.impactScore - a.impactScore;
                if (impactDiff !== 0) {
                    return impactDiff;
                }
                return b.publishedAt.getTime() - a.publishedAt.getTime();
            });

            // Apply diversity controls and test if we have achieved maxItems
            selected = this.applyDiversityAndSelect(currentQualified, config.maxItems, config.diversity);

            if (selected.length >= config.maxItems) {
                break;
            }
        }

        return selected;
    }

    /**
     * Applies source diversity, token diversity, and topic diversity limits
     */
    applyDiversityAndSelect(
        events: AggregatedMarketEvent[],
        maxItems: number,
        diversity: DigestConfig['diversity']
    ): AggregatedMarketEvent[] {
        const selected: AggregatedMarketEvent[] = [];
        const tokenCounts = new Map<string, number>();
        const sourceCounts = new Map<string, number>();
        const topicCounts = new Map<string, number>();
        const seenFingerprints = new Set<string>();

        for (const candidate of events) {
            if (selected.length >= maxItems) {
                break;
            }

            if (seenFingerprints.has(candidate.canonicalFingerprint)) {
                continue;
            }

            // Check if major breaking event warrants diversity override
            const isMajorOverride =
                candidate.eventType === MarketEventType.CENTRAL_BANK_DECISION ||
                candidate.eventType === MarketEventType.SECURITY_INCIDENT ||
                candidate.eventType === MarketEventType.GOVERNMENT_POLICY ||
                candidate.impactScore >= 95;

            const isOfficialSource =
                candidate.primaryEvent.source.tier === SourceTier.OFFICIAL ||
                getSourceAuthoritativenessRank(candidate.primaryEvent.source.name, candidate.primaryEvent.source.tier) >= 70;

            if (!isMajorOverride) {
                // Token Diversity limit (max 2 per token)
                let tokenViolated = false;
                for (const token of candidate.tokens) {
                    const currentCount = tokenCounts.get(token) || 0;
                    if (currentCount >= diversity.maxPerToken) {
                        tokenViolated = true;
                        break;
                    }
                }
                if (tokenViolated) {
                    continue;
                }

                // Source Diversity limit (max 2 per source, e.g. Jin10 max 2 unless official primary source)
                if (!isOfficialSource) {
                    const primarySource = candidate.sources[0]?.id || candidate.primaryEvent.source.name || 'unknown';
                    const sourceCount = sourceCounts.get(primarySource) || 0;
                    if (sourceCount >= diversity.maxPerSource) {
                        continue;
                    }
                }

                // Topic Diversity limit (max 3 per topic)
                let topicViolated = false;
                for (const topic of candidate.topics) {
                    const currentCount = topicCounts.get(topic) || 0;
                    if (currentCount >= diversity.maxPerTopic) {
                        topicViolated = true;
                        break;
                    }
                }
                if (topicViolated) {
                    continue;
                }
            }

            // Accept candidate
            selected.push(candidate);
            seenFingerprints.add(candidate.canonicalFingerprint);

            // Update diversity tallies
            for (const token of candidate.tokens) {
                tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
            }
            const primarySource = candidate.sources[0]?.id || candidate.primaryEvent.source.name || 'unknown';
            sourceCounts.set(primarySource, (sourceCounts.get(primarySource) || 0) + 1);
            for (const topic of candidate.topics) {
                topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            }
        }

        return selected;
    }

    /**
     * Cross-source deduplication: groups related MarketEvents into unified AggregatedMarketEvents
     * and selects preferred primary source and canonical URL according to Section 20.
     */
    aggregateEvents(events: MarketEvent[]): AggregatedMarketEvent[] {
        const groupMap = new Map<string, MarketEvent[]>();

        for (const event of events) {
            const fingerprint = this.computeCanonicalFingerprint(event);
            const group = groupMap.get(fingerprint) || [];
            group.push(event);
            groupMap.set(fingerprint, group);
        }

        const aggregated: AggregatedMarketEvent[] = [];

        for (const [fingerprint, group] of groupMap.entries()) {
            // Sort group so primary event is the most authoritative (Section 20 Preferred Primary Source)
            group.sort((a, b) => {
                const rankA = getSourceAuthoritativenessRank(a.source.name, a.source.tier);
                const rankB = getSourceAuthoritativenessRank(b.source.name, b.source.tier);
                const rankDiff = rankB - rankA;
                if (rankDiff !== 0) {
                    return rankDiff;
                }
                return b.impactScore - a.impactScore;
            });

            const primary = group[0];

            // Build source list
            const sources: AggregatedSourceInfo[] = [];
            const seenSources = new Set<string>();
            let officialCount = 0;
            let newsCount = 0;
            let socialCount = 0;

            for (const item of group) {
                if (!seenSources.has(item.source.id)) {
                    seenSources.add(item.source.id);
                    sources.push({
                        id: item.source.id,
                        name: item.source.name,
                        tier: item.source.tier,
                        credibilityScore: item.source.credibilityScore,
                        url: item.url,
                        publishedAt: item.publishedAt,
                    });

                    if (
                        item.source.tier === SourceTier.OFFICIAL ||
                        getSourceAuthoritativenessRank(item.source.name, item.source.tier) >= 70
                    ) {
                        officialCount++;
                    } else if (item.source.tier === SourceTier.NEWS || item.source.tier === SourceTier.RESEARCH) {
                        newsCount++;
                    } else {
                        socialCount++;
                    }
                }
            }

            // Deduplicate tokens, symbols, chains, topics
            const allTokens = Array.from(new Set(group.flatMap((g) => g.tokens || [])));
            const allSymbols = Array.from(new Set(group.flatMap((g) => g.symbols || [])));
            const allChains = Array.from(new Set(group.flatMap((g) => g.chains || [])));
            const allTopics = Array.from(new Set(group.flatMap((g) => ((g.metadata?.topics as string[]) || []))));

            // Determine highest verification status
            let verificationStatus = primary.verificationStatus;
            if (officialCount > 0) {
                verificationStatus = VerificationStatus.CONFIRMED_PRIMARY_SOURCE;
            } else if (sources.length >= 2 && (newsCount >= 1 || officialCount >= 1)) {
                verificationStatus = VerificationStatus.CONFIRMED_MULTI_SOURCE;
            }

            // Determine canonical url (Section 20: Official > Gov > Exchange > News > Aggregator)
            // Sort sources by rank to pick the most authoritative source that has a valid HTTP URL
            const sortedSourcesForUrl = [...sources].sort((a, b) => {
                const rankA = getSourceAuthoritativenessRank(a.name, a.tier);
                const rankB = getSourceAuthoritativenessRank(b.name, b.tier);
                return rankB - rankA;
            });
            const bestSourceWithUrl = sortedSourcesForUrl.find((s) => isValidHttpUrl(s.url));
            const canonicalUrl = bestSourceWithUrl ? bestSourceWithUrl.url : isValidHttpUrl(primary.url) ? primary.url : '';

            // Maximum impact score across reports
            const maxImpact = Math.max(...group.map((g) => g.impactScore));
            const maxTrend = Math.max(...group.map((g) => g.trendScore ?? 0));

            aggregated.push({
                id: `agg_${fingerprint}`,
                canonicalFingerprint: fingerprint,
                primaryEvent: primary,
                title: primary.title,
                summary: primary.summary,
                canonicalUrl,
                category: primary.category,
                eventType: primary.eventType,
                verificationStatus,
                tokens: allTokens,
                symbols: allSymbols,
                chains: allChains,
                topics: allTopics,
                impactScore: maxImpact,
                trendScore: maxTrend > 0 ? maxTrend : undefined,
                publishedAt: primary.publishedAt,
                createdAt: primary.createdAt,
                sources,
                sourceCount: sources.length,
                officialSourceCount: officialCount,
                newsSourceCount: newsCount,
                socialSourceCount: socialCount,
            });
        }

        return aggregated;
    }

    /**
     * Computes a canonical fingerprint to group multi-source coverage of the exact same event.
     * Special handling for ETF events (Grayscale ZEC ETF split from multiple sources).
     */
    computeCanonicalFingerprint(event: MarketEvent): string {
        const eventType = event.eventType;
        const normalizedTokens = (event.tokens || []).map((t) => t.toUpperCase().trim()).sort().join('_');
        const text = `${event.title} ${event.summary || ''}`.toLowerCase();

        // 1. Detect ETF events (Section 14 & 15 ETF cluster)
        const isEtf = eventType === MarketEventType.ETF || text.includes('etf') || text.includes('fund');
        if (isEtf) {
            let entity = 'general';
            if (text.includes('grayscale')) {
                entity = 'grayscale';
            } else if (text.includes('blackrock')) {
                entity = 'blackrock';
            } else if (text.includes('bitwise')) {
                entity = 'bitwise';
            } else if (text.includes('fidelity')) {
                entity = 'fidelity';
            } else if (text.includes('vaneck')) {
                entity = 'vaneck';
            } else if (text.includes('21shares')) {
                entity = '21shares';
            } else if (text.includes('ark')) {
                entity = 'ark';
            }

            let token = normalizedTokens;
            if (!token) {
                if (text.includes('zcash') || text.includes('zec')) {
                    token = 'ZEC';
                } else if (text.includes('bitcoin') || text.includes('btc')) {
                    token = 'BTC';
                } else if (text.includes('ethereum') || text.includes('eth')) {
                    token = 'ETH';
                } else if (text.includes('solana') || text.includes('sol')) {
                    token = 'SOL';
                }
            }

            let action = 'event';
            if (text.includes('split') || text.includes('3-for-1') || text.includes('chia tách')) {
                action = 'split';
            } else if (text.includes('filing') || text.includes('file') || text.includes('nộp')) {
                action = 'file';
            } else if (text.includes('approv') || text.includes('phê duyệt')) {
                action = 'approve';
            } else if (text.includes('delay') || text.includes('hoãn')) {
                action = 'delay';
            }

            return `etf_${token || entity}_${action}`.toLowerCase();
        }

        // Extract key entities (exchanges, agencies)
        let entity = 'general';
        if (text.includes('binance')) {
            entity = 'binance';
        } else if (text.includes('coinbase')) {
            entity = 'coinbase';
        } else if (text.includes('robinhood')) {
            entity = 'robinhood';
        } else if (text.includes('federal reserve') || text.includes('fed ')) {
            entity = 'fed';
        } else if (text.includes('sec')) {
            entity = 'sec';
        } else if (text.includes('treasury')) {
            entity = 'treasury';
        }

        // Listing or meme event with a specific token
        if (
            normalizedTokens &&
            (eventType === MarketEventType.EXCHANGE_LISTING ||
                eventType === MarketEventType.BROKER_LISTING ||
                eventType === MarketEventType.MEME_TREND)
        ) {
            return `${eventType}_${entity}_${normalizedTokens}`.toLowerCase();
        }

        // Macro / Policy / Regulation event
        const isRegulation =
            eventType === MarketEventType.REGULATION ||
            eventType === MarketEventType.GOVERNMENT_POLICY ||
            entity === 'sec' ||
            entity === 'cftc' ||
            text.includes('regulation') ||
            text.includes('rule change') ||
            text.includes('listing rule');

        if (isRegulation) {
            return `regulation_${entity}_${normalizedTokens || 'policy'}`.toLowerCase();
        }

        if (
            eventType === MarketEventType.CENTRAL_BANK_DECISION ||
            eventType === MarketEventType.MACRO_DATA
        ) {
            return `${eventType}_${entity}_${normalizedTokens || 'macro'}`.toLowerCase();
        }

        // Security / Hack event
        if (eventType === MarketEventType.SECURITY_INCIDENT || eventType === MarketEventType.NETWORK_INCIDENT) {
            return `${eventType}_${entity}_${normalizedTokens || 'security'}`.toLowerCase();
        }

        // Fallback: simplified slug from title + token
        const cleanTitle = event.title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, ' ')
            .trim()
            .split(/\s+/)
            .slice(0, 5)
            .join('_');

        return `${eventType}_${normalizedTokens || 'crypto'}_${cleanTitle}`.toLowerCase();
    }

    /**
     * Memecoin Quality Validation
     */
    private satisfiesMemecoinRules(event: AggregatedMarketEvent): boolean {
        // Condition 1: Official exchange / broker mention or listing
        if (
            event.officialSourceCount > 0 ||
            event.eventType === MarketEventType.EXCHANGE_LISTING ||
            event.eventType === MarketEventType.BROKER_LISTING
        ) {
            return true;
        }

        // Condition 2: Multiple trusted independent news sources
        if (event.newsSourceCount >= 2) {
            return true;
        }

        // Condition 3: High trend score >= 85 AND at least 3 unique sources
        if (event.trendScore !== undefined && event.trendScore >= 85 && event.sourceCount >= 3) {
            return true;
        }

        // Condition 4: Meme metrics with high velocity and multi-source
        if (event.primaryEvent.memeMetrics) {
            const { velocity = 0, uniqueSources = 0 } = event.primaryEvent.memeMetrics;
            if (velocity >= 15 && uniqueSources >= 4) {
                return true;
            }
        }

        // Random influencer hype -> REJECT
        return false;
    }
}
