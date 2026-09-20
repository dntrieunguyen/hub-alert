import { SourceTier, VerificationStatus } from '../types';
import { type MarketEvent, MarketEventType } from '../notifications/types';
import type { CryptoDigestRankingService } from './crypto-digest-ranking.service';
import type { AggregatedMarketEvent, AggregatedSourceInfo, DigestConfig } from './types';

export class CryptoDigestSelectionService {
    private rankingService: CryptoDigestRankingService;

    constructor(rankingService: CryptoDigestRankingService) {
        this.rankingService = rankingService;
    }

    /**
     * Aggregates raw MarketEvents, filters candidates, applies AI analysis (if enabled),
     * scores them with combined ranking, applies diversity controls, and returns top <= 10.
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

        // Step 1: Cross-Source Deduplication & Event Aggregation
        const aggregatedEvents = this.aggregateEvents(events);

        // Step 2: Initial Deterministic Ranking Score Calculation
        for (const item of aggregatedEvents) {
            const breakdown = this.rankingService.calculateRankingScore(item, config.lookbackHours, config.weights);
            item.rankingBreakdown = breakdown;
            item.digestRankingScore = breakdown.totalRankingScore;
        }

        // Step 3: Candidate Pre-filtering (Section 6: minimize AI token usage)
        const candidates = aggregatedEvents.filter((item) => {
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

            // Candidate criteria (Section 6)
            const credScore = item.rankingBreakdown?.credibilityScore ?? 0;
            const satisfiesCandidateScore =
                credScore >= config.minCredibility ||
                item.impactScore >= 60 ||
                item.primaryEvent.priority === 'P0' ||
                item.primaryEvent.priority === 'P1' ||
                item.primaryEvent.metadata?.breaking === true ||
                (item.trendScore ?? 0) >= 80;

            if (!satisfiesCandidateScore) {
                return false;
            }

            // Specific Memecoin Quality Rules (Section 11)
            if (item.category === 'MEMECOIN' || item.eventType === MarketEventType.MEME_TREND) {
                if (!this.satisfiesMemecoinRules(item)) {
                    return false;
                }
            }

            return true;
        });

        // Sort candidates by initial ranking score descending and cap at maxCandidates (20-30 max)
        candidates.sort((a, b) => (b.digestRankingScore ?? 0) - (a.digestRankingScore ?? 0));
        const aiCandidates = candidates.slice(0, config.aiMaxCandidates || 30);

        // Step 4: AI Analysis Batch (Section 17 & 18)
        let filteredEvents = aiCandidates;
        if (aiAnalyzer && config.aiEnabled) {
            try {
                const marketEventsToAnalyze = aiCandidates.map((c) => c.primaryEvent);
                const analysesMap = await aiAnalyzer.analyzeEvents(marketEventsToAnalyze);

                for (const item of aiCandidates) {
                    const analysis = analysesMap.get(item.primaryEvent.id);
                    if (analysis) {
                        item.aiAnalysis = analysis;
                    }
                    // Recompute ranking score with AI weights (0.15 info + 0.10 relevance)
                    const breakdown = this.rankingService.calculateRankingScore(item, config.lookbackHours, config.weights);
                    item.rankingBreakdown = breakdown;
                    item.digestRankingScore = breakdown.totalRankingScore;
                }

                // Remove noise/spam identified by AI
                filteredEvents = aiCandidates.filter((item) => {
                    if (item.aiAnalysis) {
                        if (item.aiAnalysis.isValuable === false) {
                            return false;
                        }
                        if (item.aiAnalysis.duplicateOfEventId) {
                            return false;
                        }
                    }
                    return true;
                });
            } catch {
                // If AI analysis fails, gracefully continue with deterministic candidates
                filteredEvents = aiCandidates;
            }
        }

        // Step 5: Minimum Ranking Score Gate
        const qualifiedEvents = filteredEvents.filter((item) => {
            const rankScore = item.digestRankingScore ?? 0;
            return rankScore >= config.minRankingScore;
        });

        // Step 6: Sort by Final Digest Ranking Score Descending (Tie-break by recency and impact)
        qualifiedEvents.sort((a, b) => {
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

        // Step 5: Category Diversity & Quota Control (Section 8)
        const selected: AggregatedMarketEvent[] = [];
        const tokenCounts = new Map<string, number>();
        const sourceCounts = new Map<string, number>();
        const topicCounts = new Map<string, number>();

        for (const candidate of qualifiedEvents) {
            if (selected.length >= config.maxItems) {
                break;
            }

            // Check if major breaking event warrants diversity override
            const isMajorOverride =
                candidate.eventType === MarketEventType.CENTRAL_BANK_DECISION ||
                candidate.eventType === MarketEventType.SECURITY_INCIDENT ||
                candidate.eventType === MarketEventType.GOVERNMENT_POLICY ||
                candidate.impactScore >= 95;

            if (!isMajorOverride) {
                // Check Token Diversity limit
                let tokenViolated = false;
                for (const token of candidate.tokens) {
                    const currentCount = tokenCounts.get(token) || 0;
                    if (currentCount >= config.diversity.maxPerToken) {
                        tokenViolated = true;
                        break;
                    }
                }
                if (tokenViolated) {
                    continue;
                }

                // Check Source Diversity limit
                const primarySource = candidate.sources[0]?.id || 'unknown';
                const sourceCount = sourceCounts.get(primarySource) || 0;
                if (sourceCount >= config.diversity.maxPerSource) {
                    continue;
                }

                // Check Topic Diversity limit
                let topicViolated = false;
                for (const topic of candidate.topics) {
                    const currentCount = topicCounts.get(topic) || 0;
                    if (currentCount >= config.diversity.maxPerTopic) {
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

            // Update diversity tallies
            for (const token of candidate.tokens) {
                tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
            }
            const primarySource = candidate.sources[0]?.id || 'unknown';
            sourceCounts.set(primarySource, (sourceCounts.get(primarySource) || 0) + 1);
            for (const topic of candidate.topics) {
                topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            }
        }

        // Return selected Top N items (Notice: never pads with low quality items!)
        return selected;
    }

    /**
     * Cross-source deduplication: groups related MarketEvents into unified AggregatedMarketEvents
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
            // Sort group so primary event is the most authoritative (Official > News > Social, then impact)
            group.sort((a, b) => {
                const tierRank = (t: SourceTier) => (t === SourceTier.OFFICIAL ? 3 : t === SourceTier.RESEARCH || t === SourceTier.NEWS ? 2 : 1);
                const tierDiff = tierRank(b.source.tier) - tierRank(a.source.tier);
                if (tierDiff !== 0) {
                    return tierDiff;
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

                    if (item.source.tier === SourceTier.OFFICIAL) {
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
            } else if (sources.length >= 2 && newsCount >= 1) {
                verificationStatus = VerificationStatus.CONFIRMED_MULTI_SOURCE;
            }

            // Determine canonical url (Official url > original X post > trusted news)
            const officialSource = sources.find((s) => s.tier === SourceTier.OFFICIAL);
            const canonicalUrl = officialSource ? officialSource.url : primary.url;

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
     * Computes a canonical fingerprint to group multi-source coverage of the exact same event
     */
    computeCanonicalFingerprint(event: MarketEvent): string {
        const eventType = event.eventType;
        const normalizedTokens = (event.tokens || []).map((t) => t.toUpperCase().trim()).sort().join('_');

        // Extract key entities (exchanges, agencies)
        const text = `${event.title} ${event.summary || ''}`.toLowerCase();
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

        // If listing or meme event with a specific token, group by [eventType]_[entity]_[token]
        if (normalizedTokens && (eventType === MarketEventType.EXCHANGE_LISTING || eventType === MarketEventType.BROKER_LISTING || eventType === MarketEventType.MEME_TREND)) {
            return `${eventType}_${entity}_${normalizedTokens}`.toLowerCase();
        }

        // Macro / Policy event
        if (eventType === MarketEventType.CENTRAL_BANK_DECISION || eventType === MarketEventType.MACRO_DATA || eventType === MarketEventType.REGULATION) {
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
     * Memecoin Quality Validation (Section 11)
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
