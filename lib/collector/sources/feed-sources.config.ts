import { type FeedSource, SourceTier } from '../types';
import { buildXFeedSources } from '../x';

export const getRSSHubBaseUrl = (): string => {
    const rawUrl = process.env.RSSHUB_BASE_URL?.trim() || 'http://localhost:1200';
    return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
};

export const resolveFeedUrl = (routeOrUrl: string): string => {
    if (routeOrUrl.startsWith('http://') || routeOrUrl.startsWith('https://')) {
        return routeOrUrl;
    }
    const base = getRSSHubBaseUrl();
    const path = routeOrUrl.startsWith('/') ? routeOrUrl : `/${routeOrUrl}`;
    return `${base}${path}`;
};

export const INITIAL_FEED_SOURCES: Array<Omit<FeedSource, 'nextFetchAt' | 'failureCount'>> = [
    // --- TIER 1: OFFICIAL ---
    {
        id: 'binance-listings',
        name: 'Binance New Listings',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: '/binance/announcement/new-cryptocurrency-listing/en',
        pollingInterval: 120, // 2m
        credibilityScore: 98,
        tags: ['binance', 'listing', 'exchange', 'official'],
    },
    {
        id: 'binance-delistings',
        name: 'Binance Delistings',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: '/binance/announcement/delisting/en',
        pollingInterval: 120, // 2m
        credibilityScore: 98,
        tags: ['binance', 'delisting', 'risk', 'official'],
    },
    {
        id: 'binance-news',
        name: 'Binance Latest News',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: '/binance/announcement/latest-binance-news/en',
        pollingInterval: 180, // 3m
        credibilityScore: 96,
        tags: ['binance', 'news', 'exchange', 'official'],
    },
    {
        id: 'okx-listings',
        name: 'OKX New Listings',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: '/okx/new-listings',
        pollingInterval: 120, // 2m
        credibilityScore: 97,
        tags: ['okx', 'listing', 'exchange', 'official'],
    },
    {
        id: 'okx-delistings',
        name: 'OKX Delistings',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: '/okx/delistings',
        pollingInterval: 120, // 2m
        credibilityScore: 97,
        tags: ['okx', 'delisting', 'risk', 'official'],
    },
    {
        id: 'sec-press-releases',
        name: 'SEC Press Releases',
        enabled: true,
        category: 'MARKET',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: 'https://www.sec.gov/news/pressreleases.rss',
        pollingInterval: 300, // 5m
        credibilityScore: 99,
        tags: ['sec', 'regulation', 'enforcement', 'etf', 'official'],
    },
    {
        id: 'federal-reserve-press',
        name: 'Federal Reserve Statements',
        enabled: true,
        category: 'MARKET',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: 'https://www.federalreserve.gov/feeds/press_all.xml',
        pollingInterval: 300, // 5m
        credibilityScore: 100,
        tags: ['fed', 'fomc', 'interest-rates', 'inflation', 'official'],
    },
    {
        id: 'ethereum-foundation-blog',
        name: 'Ethereum Foundation Blog',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: 'https://blog.ethereum.org/feed.xml',
        pollingInterval: 900, // 15m
        credibilityScore: 98,
        tags: ['ethereum', 'eth', 'upgrade', 'foundation', 'official'],
    },
    {
        id: 'solana-foundation-news',
        name: 'Solana Foundation News',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.OFFICIAL,
        rssUrl: 'https://solana.com/news/rss.xml',
        pollingInterval: 900, // 15m
        credibilityScore: 95,
        tags: ['solana', 'sol', 'ecosystem', 'official'],
    },

    // --- TIER 2 & 3: NEWS ---
    {
        id: 'coindesk-news',
        name: 'CoinDesk',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: 'https://feeds.feedburner.com/Coindesk',
        pollingInterval: 180, // 3m
        credibilityScore: 88,
        tags: ['crypto', 'news', 'bitcoin', 'ethereum', 'defi'],
    },
    {
        id: 'cointelegraph-news',
        name: 'Cointelegraph',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: 'https://cointelegraph.com/rss',
        pollingInterval: 180, // 3m
        credibilityScore: 85,
        tags: ['crypto', 'news', 'markets', 'altcoins'],
    },
    {
        id: 'decrypt-news',
        name: 'Decrypt',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: 'https://decrypt.co/feed',
        pollingInterval: 180, // 3m
        credibilityScore: 85,
        tags: ['crypto', 'memecoin', 'web3', 'culture', 'news'],
    },
    {
        id: 'blockworks-news',
        name: 'Blockworks',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: 'https://blockworks.co/feed',
        pollingInterval: 240, // 4m
        credibilityScore: 88,
        tags: ['institutional', 'macro', 'defi', 'news'],
    },
    {
        id: 'the-block',
        name: 'The Block',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: 'https://www.theblock.co/rss.xml',
        pollingInterval: 180, // 3m
        credibilityScore: 89,
        tags: ['breaking', 'data', 'funding', 'news'],
    },
    {
        id: 'foresight-news',
        name: 'Foresight News',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: '/foresightnews/news',
        pollingInterval: 180, // 3m
        credibilityScore: 84,
        tags: ['asia', 'flash', 'news', 'web3'],
    },
    {
        id: 'odaily-newsflash',
        name: 'Odaily Newsflash',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: '/odaily/newsflash',
        pollingInterval: 120, // 2m
        credibilityScore: 83,
        tags: ['flash', 'breaking', 'news'],
    },
    {
        id: 'chaincatcher-news',
        name: 'ChainCatcher',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.NEWS,
        rssUrl: '/chaincatcher/news',
        pollingInterval: 180, // 3m
        credibilityScore: 82,
        tags: ['crypto', 'narrative', 'defi', 'news'],
    },

    // --- TIER 2: RESEARCH ---
    {
        id: 'messari-research',
        name: 'Messari',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.RESEARCH,
        rssUrl: 'https://messari.io/rss',
        pollingInterval: 900, // 15m
        credibilityScore: 92,
        tags: ['research', 'fundamentals', 'tokenomics'],
    },
    {
        id: 'bankless',
        name: 'Bankless',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.RESEARCH,
        rssUrl: 'https://www.bankless.com/rss/feed',
        pollingInterval: 900, // 15m
        credibilityScore: 88,
        tags: ['defi', 'layer2', 'ethereum', 'research'],
    },
    {
        id: 'vitalik-blog',
        name: 'Vitalik Buterin Blog',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.RESEARCH,
        rssUrl: 'https://vitalik.eth.limo/feed.xml',
        pollingInterval: 1800, // 30m
        credibilityScore: 97,
        tags: ['ethereum', 'philosophy', 'cryptography', 'research'],
    },

    // --- MACRO / MARKET ---
    {
        id: 'cnbc-economy',
        name: 'CNBC Economy',
        enabled: true,
        category: 'MARKET',
        sourceTier: SourceTier.NEWS,
        rssUrl: '/cnbc/rss/10001147',
        pollingInterval: 300, // 5m
        credibilityScore: 90,
        tags: ['economy', 'cpi', 'inflation', 'jobs', 'macro'],
    },
    {
        id: 'cnbc-finance',
        name: 'CNBC Finance',
        enabled: true,
        category: 'MARKET',
        sourceTier: SourceTier.NEWS,
        rssUrl: '/cnbc/rss/10000664',
        pollingInterval: 300, // 5m
        credibilityScore: 90,
        tags: ['finance', 'stocks', 'nasdaq', 'sp500', 'macro'],
    },
    {
        id: 'jin10-flash',
        name: 'Jin10 Global Flash',
        enabled: true,
        category: 'MARKET',
        sourceTier: SourceTier.NEWS,
        rssUrl: '/jin10',
        pollingInterval: 120, // 2m
        credibilityScore: 85,
        tags: ['macro', 'breaking', 'central-banks', 'gold', 'dxy'],
    },

    // --- SOCIAL / MEME / COMMUNITY ---
    {
        id: 'reddit-cryptocurrency',
        name: 'Reddit r/CryptoCurrency',
        enabled: true,
        category: 'CRYPTO_NEWS',
        sourceTier: SourceTier.COMMUNITY,
        rssUrl: 'https://www.reddit.com/r/CryptoCurrency/.rss',
        pollingInterval: 240, // 4m
        credibilityScore: 55,
        tags: ['social', 'reddit', 'community', 'sentiment'],
    },
    {
        id: 'reddit-memecoins',
        name: 'Reddit r/memecoins',
        enabled: true,
        category: 'MEMECOIN',
        sourceTier: SourceTier.COMMUNITY,
        rssUrl: 'https://www.reddit.com/r/memecoins/.rss',
        pollingInterval: 180, // 3m
        credibilityScore: 45,
        tags: ['memecoin', 'reddit', 'viral', 'meme'],
    },
    {
        id: 'reddit-solana',
        name: 'Reddit r/solana',
        enabled: true,
        category: 'MEMECOIN',
        sourceTier: SourceTier.COMMUNITY,
        rssUrl: 'https://www.reddit.com/r/solana/.rss',
        pollingInterval: 180, // 3m
        credibilityScore: 50,
        tags: ['solana', 'memecoin', 'community'],
    },
];

export const buildInitialSources = (): FeedSource[] => {
    const now = new Date();
    const standardSources: FeedSource[] = INITIAL_FEED_SOURCES.map((s) => ({
        ...s,
        platform: 'RSS',
        rssUrl: resolveFeedUrl(s.rssUrl),
        failureCount: 0,
        nextFetchAt: now,
    }));
    const xSources = buildXFeedSources().map((s) => ({
        ...s,
        rssUrl: resolveFeedUrl(s.rssUrl),
    }));
    return [...standardSources, ...xSources];
};
