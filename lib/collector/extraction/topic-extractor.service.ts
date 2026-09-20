export interface TopicRule {
    topic: string;
    keywords: string[];
    regex?: RegExp;
}

export const DEFAULT_TOPIC_RULES: TopicRule[] = [
    {
        topic: 'LISTING',
        keywords: ['listing', 'will list', 'lists', 'launches trading', 'new listing', 'adds support for', 'spot trading for', '上线', '上市'],
    },
    {
        topic: 'DELISTING',
        keywords: ['delisting', 'will delist', 'delists', 'remove trading', 'removes trading pairs', 'cease trading', '下线', '下架'],
    },
    {
        topic: 'ETF',
        keywords: ['etf', 'spot etf', 'etfs', 'etf inflow', 'etf outflow', 's-1', '19b-4', 'grayscale', 'ishares', 'blackrock etf'],
    },
    {
        topic: 'REGULATION',
        keywords: ['regulation', 'regulator', 'regulatory', 'sec', 'cftc', 'doj', 'compliance', 'lawsuit', 'subpoena', 'sanction', 'sanctions', 'enforcement'],
    },
    {
        topic: 'HACK_EXPLOIT',
        keywords: ['hack', 'hacked', 'exploit', 'exploited', 'stolen', 'vulnerability', 'drain', 'drained', 'compromised', 'phishing', 'security breach'],
    },
    {
        topic: 'PARTNERSHIP',
        keywords: ['partnership', 'partnered with', 'partners with', 'collaboration', 'collaborates with', 'strategic alliance', 'joint venture'],
    },
    {
        topic: 'AIR_DROP',
        keywords: ['airdrop', 'air drop', 'airdrops', 'claim token', 'token claim', 'retroactive reward'],
    },
    {
        topic: 'TOKEN_LAUNCH',
        keywords: ['token launch', 'tge', 'token generation', 'presale', 'ido', 'launchpool', 'launchpad'],
    },
    {
        topic: 'MAINNET',
        keywords: ['mainnet', 'mainnet launch', 'testnet', 'devnet', 'genesis block'],
    },
    {
        topic: 'NETWORK_UPGRADE',
        keywords: ['network upgrade', 'hard fork', 'soft fork', 'protocol upgrade', 'consensus upgrade', 'eip-', 'hardfork'],
    },
    {
        topic: 'WHALE',
        keywords: ['whale', 'whale alert', 'dormant address', 'large transaction', 'transferred to exchange', 'whale movement'],
    },
    {
        topic: 'MEME_TREND',
        keywords: ['memecoin', 'meme coin', 'meme token', 'memecoins', 'trending meme', 'viral token', 'pump.fun', 'doge', 'pepe', 'shib', 'wif'],
    },
    {
        topic: 'MARKET_MACRO',
        keywords: ['macro', 'recession', 'gdp', 'treasury', 'bond yield', 'dxy', 'dollar index', 's&p 500', 'nasdaq', 'equities', 'risk-on', 'risk-off'],
    },
    {
        topic: 'FED',
        keywords: ['federal reserve', 'the fed', 'jerome powell', 'fomc', 'interest rate', 'rate cut', 'rate hike', 'central bank'],
    },
    {
        topic: 'INFLATION',
        keywords: ['cpi', 'consumer price index', 'ppi', 'inflation', 'pce', 'deflation', 'stagflation'],
    },
    {
        topic: 'LIQUIDITY',
        keywords: ['liquidity', 'quantitative easing', 'quantitative tightening', 'm2 money supply', 'balance sheet', 'repo facility'],
    },
];

export class TopicExtractorService {
    private rules: TopicRule[];

    constructor(customRules?: TopicRule[]) {
        const raw = customRules ?? DEFAULT_TOPIC_RULES;
        this.rules = raw.map((r) => ({
            ...r,
            regex: r.regex ?? new RegExp(r.keywords.map((k) => `(?:\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b)`).join('|'), 'iu'),
        }));
    }

    extractTopics(text: string): string[] {
        if (!text) {
            return [];
        }
        const matched = new Set<string>();
        for (const rule of this.rules) {
            if (rule.regex?.test(text)) {
                matched.add(rule.topic);
            }
        }
        return Array.from(matched);
    }
}
