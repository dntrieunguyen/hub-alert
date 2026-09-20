import type { CryptoFeedItem } from '../../types';

export interface ClusteredMarketEvent {
    id: string;
    clusterKey: string;
    primaryItem: CryptoFeedItem;
    items: CryptoFeedItem[];
    itemCount: number;
    combinedTitle: string;
    combinedSummary: string;
    combinedContent: string;
    entities: string[];
    tokens: string[];
    symbols: string[];
    publishedAt: Date;
    impactScore: number;
    credibilityScore: number;
}

const KNOWN_ENTITY_CLUSTERS = [
    { key: 'qatar_energy_lng_hormuz', pattern: /(qatar energy|qatar lng|hormuz|golden pass|eo biển hormuz|卡塔尔能源|霍尔木兹)/i },
    { key: 'venezuela_sanctions_oil', pattern: /(venezuela|pdvsa|dầu venezuela|委内瑞拉)/i },
    { key: 'us_treasury_debt', pattern: /(treasury|bộ tài chính mỹ|nợ ngắn hạn|short-term debt|debt issuance|美国财政部|财政部|短期国债|短期债务)/i },
    { key: 'fed_monetary_policy', pattern: /(federal reserve|fomc|jerome powell|lãi suất fed|cắt giảm lãi suất|美联储|鲍威尔|降息|加息)/i },
    { key: 'sec_crypto_regulation', pattern: /(sec|gary gensler|crypto regulation|khung pháp lý crypto|美国证券交易委员会)/i },
    { key: 'spot_bitcoin_etf', pattern: /(bitcoin etf|btc etf|spot etf|blackrock etf|比特币etf)/i },
    { key: 'spot_ether_etf', pattern: /(ethereum etf|eth etf|ether etf|以太坊etf)/i },
    { key: 'binance_regulatory', pattern: /(binance|cz|richard teng|币安)/i },
    { key: 'coinbase_regulatory', pattern: /(coinbase|brian armstrong)/i },
];


export class LatestEventClusteringService {
    private readonly windowMinutes: number;

    constructor(windowMinutes = 30) {
        const envWindow = process.env.LATEST_EVENT_CLUSTER_WINDOW_MINUTES;
        this.windowMinutes = envWindow ? Number.parseInt(envWindow, 10) : windowMinutes;
    }

    /**
     * Clusters consecutive feed items with similar entities/topics within the time window.
     */
    clusterEvents(items: CryptoFeedItem[]): ClusteredMarketEvent[] {
        if (!items || items.length === 0) {
            return [];
        }

        // Sort items by publishedAt descending
        const sorted = [...items].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
        const clusters: ClusteredMarketEvent[] = [];

        for (const item of sorted) {
            const clusterKey = this.extractClusterKey(item);
            const itemTime = item.publishedAt.getTime();
            const windowMs = this.windowMinutes * 60 * 1000;

            // Find existing cluster with same key within time window
            const existingCluster = clusters.find((c) => {
                if (c.clusterKey !== clusterKey) {
                    return false;
                }
                const timeDiff = Math.abs(c.publishedAt.getTime() - itemTime);
                return timeDiff <= windowMs;
            });

            if (existingCluster) {
                existingCluster.items.push(item);
                existingCluster.itemCount = existingCluster.items.length;

                // Update primary item if current item has higher impact
                if (item.impactScore > existingCluster.primaryItem.impactScore) {
                    existingCluster.primaryItem = item;
                }

                // Update max impact and credibility
                existingCluster.impactScore = Math.max(existingCluster.impactScore, item.impactScore);
                existingCluster.credibilityScore = Math.max(existingCluster.credibilityScore, item.credibilityScore);

                // Merge tokens and symbols
                existingCluster.tokens = Array.from(new Set([...existingCluster.tokens, ...(item.tokens || [])]));
                existingCluster.symbols = Array.from(new Set([...existingCluster.symbols, ...(item.symbols || [])]));
                existingCluster.entities = Array.from(new Set([...existingCluster.entities, ...(item.entities || [])]));

                // Combine title & summary
                const summaries = existingCluster.items
                    .map((i) => i.summary || i.title)
                    .filter(Boolean)
                    .filter((s, idx, arr) => arr.indexOf(s) === idx);
                existingCluster.combinedSummary = summaries.join('\n');
            } else {
                clusters.push({
                    id: `cluster_${item.id}`,
                    clusterKey,
                    primaryItem: item,
                    items: [item],
                    itemCount: 1,
                    combinedTitle: item.title,
                    combinedSummary: item.summary || item.title,
                    combinedContent: item.content || item.summary || item.title,
                    entities: [...(item.entities || [])],
                    tokens: [...(item.tokens || [])],
                    symbols: [...(item.symbols || [])],
                    publishedAt: item.publishedAt,
                    impactScore: item.impactScore,
                    credibilityScore: item.credibilityScore,
                });
            }
        }

        return clusters;
    }

    private extractClusterKey(item: CryptoFeedItem): string {
        const entitiesText = (item.entities || []).join(' ');
        const text = `${item.title} ${item.summary || ''} ${entitiesText}`.toLowerCase();

        // 1. Check predefined dominant macro / industry entities
        for (const cluster of KNOWN_ENTITY_CLUSTERS) {
            if (cluster.pattern.test(text)) {
                return cluster.key;
            }
        }

        const cleanTitle = item.title
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]/gu, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 8)
            .join('_');



        // 2. Check tokens with specific topic or action (avoiding generic coin collapse)
        if (item.tokens && item.tokens.length > 0) {
            const primaryToken = item.tokens[0].toUpperCase();
            if (!['THE', 'ALL', 'NEW', 'TOP', 'USD'].includes(primaryToken)) {
                const specificTopic = (item.topics || []).find((t) => !['MARKET', 'CRYPTO', 'GENERAL'].includes(t.toUpperCase()));
                if (specificTopic) {
                    return `token_${primaryToken}_${specificTopic.toLowerCase()}`;
                }
                return `token_${primaryToken}_${cleanTitle}`;
            }
        }

        // 3. Fallback: simplified slug from title keywords
        return cleanTitle ? `topic_${cleanTitle}` : `item_${item.id}`;
    }
}


