import { isValidTitle } from '../../digest/crypto-digest-relevance.service';

export interface MarketRelevanceTarget {
    title?: string;
    summary?: string;
    content?: string;
    category?: string;
    sourceName?: string;
    sourceTier?: string;
    tokens?: string[];
    symbols?: string[];
    topics?: string[];
    entities?: string[];
    engagement?: {
        likes?: number;
        comments?: number;
        reposts?: number;
        views?: number;
    };
    metadata?: Record<string, unknown>;
}

export interface MarketRelevanceEvaluation {
    isRelevant: boolean;
    marketRelevanceScore: number; // 0 - 100
    category: 'CRYPTO' | 'MACRO' | 'COMMUNITY_NOISE' | 'UNRELATED';
    reason?: string;
}

// Patterns identifying community / personal noise (especially on Reddit, forums, social)
const COMMUNITY_NOISE_PATTERNS = [
    /portfolio question/i,
    /my portfolio/i,
    /rate my portfolio/i,
    /portfolio advice/i,
    /portfolio check/i,
    /what should i buy/i,
    /should i buy/i,
    /what to buy/i,
    /is it worth buying/i,
    /is [a-z0-9]+ good/i,
    /what do you guys think/i,
    /what are your thoughts/i,
    /unpopular opinion/i,
    /personal opinion/i,
    /beginner question/i,
    /newbie question/i,
    /i am new to crypto/i,
    /need advice/i,
    /any tips for/i,
    /submitted by \/u\//i,
    /hi crypto friend/i,
    /hello crypto friend/i,
    /daily discussion/i,
    /weekend discussion/i,
    /moon farming/i,
];

// Patterns identifying routine, non-systemic business/local updates with no macro/crypto transmission
const ROUTINE_BUSINESS_PATTERNS = [
    /mở rộng.*năm 202[7-9]/i,
    /expands.*in 202[7-9]/i,
    /sẽ chạy năm 202[7-9]/i,
    /line 2.*202[7-9]/i,
    /golden pass.*line 2/i,
    /bổ nhiệm nhân sự/i,
    /ký hợp đồng thông thường/i,
    /khánh thành nhà máy/i,
    /nhà máy điện gió/i,
    /bãi đỗ xe/i,
    /parking/i,
    /bất động sản địa phương/i,
    /nhà ở xã hội/i,
];

// Direct crypto terms and major entities (multi-language: English, Vietnamese, Chinese)
const DIRECT_CRYPTO_KEYWORDS = [
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'binance', 'bnb', 'coinbase',
    'xrp', 'ripple', 'doge', 'dogecoin', 'tether', 'usdt', 'usdc', 'circle', 'cardano', 'ada',
    'crypto', 'cryptocurrency', 'blockchain', 'web3', 'defi', 'nft', 'altcoin', 'memecoin',
    'etf', 'bitcoin etf', 'ether etf', 'grayscale', 'blackrock', 'fidelity', 'sec', 'cftc',
    'stablecoin', 'smart contract', 'layer 1', 'layer 2', 'mining', 'staking', 'airdrop',
    'halving', 'dex', 'cex', 'kraken', 'okx', 'bybit', 'robinhood', 'metamask', 'ledger',
    'rug pull', 'hack crypto', 'exploit', 'drained', 'flash loan attack',
    // Chinese crypto terms
    '比特币', '以太坊', '币安', '加密货币', '虚拟资产', '代币', '数字资产',
];

// Macro transmission channels materially impacting global liquidity, USD, inflation, yields, and risk assets
const MACRO_LIQUIDITY_KEYWORDS = [
    'federal reserve', 'the fed', 'fomc', 'jerome powell', 'chair powell',
    'interest rate', 'rate cut', 'rate hike', 'lãi suất', 'cắt giảm lãi suất', 'tăng lãi suất',
    'cpi', 'pce', 'ppi', 'inflation', 'lạm phát', 'deflation', 'disinflation',
    'global liquidity', 'thanh khoản', 'thanh khoản usd', 'usd liquidity', 'cung tiền', 'm2',
    'quantitative easing', 'quantitative tightening', 'dxy', 'us dollar index', 'chỉ số usd',
    'treasury yield', 'treasury debt', '10-year treasury', 'nợ ngắn hạn', 'trái phiếu kho bạc',
    'short-term debt', 'debt issuance', 'phát hành nợ', 'lợi suất trái phiếu',
    'risk assets', 'tài sản rủi ro', 'khẩu vị rủi ro', 'risk appetite',
    // Chinese macro terms
    '美联储', '鲍威尔', '财政部', '美国财政部', '国债', '短期国债', '短期债务', '降息', '加息', '利率', '通胀', '流动性', '货币政策',
];

// Geopolitical & energy shock keywords that create macro contagion
const SHOCK_ENERGY_GEOPOLITICAL_KEYWORDS = [
    'hormuz', 'khủng hoảng hormuz', 'eo biển hormuz', 'strait of hormuz',
    'energy shock', 'oil shock', 'cú sốc năng lượng', 'cú sốc giá dầu',
    'crude oil', 'giá dầu', 'brent', 'wti', 'lng disruption', 'gián đoạn lng',
    'trade embargo', 'sanctions', 'cấm vận', 'venezuela sanctions', 'middle east conflict',
    'xung đột trung đông', 'shipping disruption', 'tắc nghẽn vận chuyển',
    // Chinese shock terms
    '霍尔木兹', '霍尔木兹海峡', '红海', '原油', '天然气', '卡塔尔能源', '石油', '制裁', '地缘冲突',
];


export class LatestMarketRelevanceService {
    private readonly defaultMinRelevance: number;

    constructor(minRelevance = 50) {
        const envMin = process.env.LATEST_MIN_MARKET_RELEVANCE;
        this.defaultMinRelevance = envMin ? Number.parseInt(envMin, 10) : minRelevance;
    }

    /**
     * Determines whether an event is genuinely relevant to crypto or material macro/geopolitical shocks.
     */
    isMarketRelevantToCrypto(event: MarketRelevanceTarget, minScore = this.defaultMinRelevance): MarketRelevanceEvaluation {
        if (!event || !isValidTitle(event.title, 8)) {
            return {
                isRelevant: false,
                marketRelevanceScore: 0,
                category: 'UNRELATED',
                reason: 'Invalid or missing title',
            };
        }

        const title = (event.title || '').trim();
        const summary = (event.summary || '').trim();
        const content = (event.content || '').trim();
        const entitiesText = (event.entities || []).join(' ').toLowerCase();
        const text = `${title} ${summary} ${content} ${entitiesText}`.toLowerCase();
        const isCommunitySource = event.sourceTier === 'COMMUNITY' || (event.sourceName || '').toLowerCase().includes('reddit');


        // 1. Check Community Noise (Reddit, forums)
        if (isCommunitySource) {
            const isPersonalNoise = COMMUNITY_NOISE_PATTERNS.some((p) => p.test(text));
            if (isPersonalNoise) {
                return {
                    isRelevant: false,
                    marketRelevanceScore: 15,
                    category: 'COMMUNITY_NOISE',
                    reason: 'Community personal question, portfolio inquiry, or subjective opinion without market data',
                };
            }

            // Community sources only allowed if it is a security report, exploit, or high engagement news
            const isSecurityIncident = text.includes('exploit') || text.includes('hack') || text.includes('vulnerability') || text.includes('scam') || text.includes('incident');
            const hasHighEngagement = (event.engagement?.likes ?? 0) >= 150 || (event.engagement?.comments ?? 0) >= 60;

            if (!isSecurityIncident && !hasHighEngagement) {
                return {
                    isRelevant: false,
                    marketRelevanceScore: 25,
                    category: 'COMMUNITY_NOISE',
                    reason: 'Community post without verified security incident or high engagement signal',
                };
            }
        }

        // 2. Direct Crypto Relevance
        const hasValidTokens = (event.tokens || []).some((t) => t && t.length >= 2 && !['THE', 'ALL', 'NEW', 'TOP', 'USD'].includes(t.toUpperCase()));
        const hasValidSymbols = (event.symbols || []).some((s) => s.startsWith('$') && s.length >= 2);
        const hasDirectCryptoKeyword = DIRECT_CRYPTO_KEYWORDS.some((kw) => text.includes(kw));

        if (hasValidTokens || hasValidSymbols || hasDirectCryptoKeyword || event.category === 'CRYPTO_NEWS' || event.category === 'MEMECOIN') {
            let score = 85;
            // Boost for major tokens, ETF, or regulatory actions
            if (text.includes('bitcoin') || text.includes('btc') || text.includes('ethereum') || text.includes('eth') || text.includes('etf') || text.includes('sec')) {
                score = 92;
            }
            return {
                isRelevant: score >= minScore,
                marketRelevanceScore: score,
                category: 'CRYPTO',
                reason: 'Direct crypto asset, protocol, ETF, or regulatory relevance',
            };
        }

        // 3. Routine Business / Localized Updates Filtering (e.g. Qatar Energy 2027 line 2 without crisis)
        const isRoutineUpdate = ROUTINE_BUSINESS_PATTERNS.some((p) => p.test(text));
        if (isRoutineUpdate) {
            // Check if there is an overriding systemic shock keyword like Hormuz or crisis
            const hasOverridingShock = SHOCK_ENERGY_GEOPOLITICAL_KEYWORDS.some((kw) => text.includes(kw));
            if (!hasOverridingShock) {
                return {
                    isRelevant: false,
                    marketRelevanceScore: 20,
                    category: 'UNRELATED',
                    reason: 'Routine corporate expansion or local infrastructure without systemic market transmission',
                };
            }
        }

        // 4. Macro Liquidity & Transmission Channels
        const hasMacroKeyword = MACRO_LIQUIDITY_KEYWORDS.some((kw) => text.includes(kw));
        if (hasMacroKeyword) {
            let score = 75;
            // Stronger transmission: Treasury short-term debt, Fed rate decision, CPI inflation
            if (text.includes('treasury') || text.includes('nợ ngắn hạn') || text.includes('fomc') || text.includes('interest rate') || text.includes('thanh khoản')) {
                score = 80;
            }
            return {
                isRelevant: score >= minScore,
                marketRelevanceScore: score,
                category: 'MACRO',
                reason: 'Material macroeconomic factor affecting global liquidity, USD, or risk assets',
            };
        }

        // 5. Geopolitical & Energy Shock Transmission (Hormuz, Oil, LNG crisis)
        const hasShockKeyword = SHOCK_ENERGY_GEOPOLITICAL_KEYWORDS.some((kw) => text.includes(kw));
        if (hasShockKeyword) {
            let score = 65;
            if (text.includes('hormuz') || text.includes('khủng hoảng') || text.includes('gián đoạn')) {
                score = 70;
            }
            return {
                isRelevant: score >= minScore,
                marketRelevanceScore: score,
                category: 'MACRO',
                reason: 'Geopolitical or energy shock with transmission risk to inflation and risk assets',
            };
        }

        // 6. Generic or Unrelated Market news without crypto/macro connection
        return {
            isRelevant: false,
            marketRelevanceScore: 25,
            category: 'UNRELATED',
            reason: 'General market news lacking significant transmission mechanism to crypto or macro risk assets',
        };
    }
}
