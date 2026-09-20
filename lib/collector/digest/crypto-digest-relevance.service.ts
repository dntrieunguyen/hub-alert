import { MarketEventType } from '../notifications/types';

export const INVALID_TITLES = new Set([
    'untitled',
    'no title',
    'n/a',
    'null',
    'undefined',
    '""',
    '-',
    'none',
    'unknown',
    'placeholder',
]);

const CRYPTO_EVENT_TYPES = new Set<string>([
    MarketEventType.EXCHANGE_LISTING,
    MarketEventType.EXCHANGE_DELISTING,
    MarketEventType.BROKER_LISTING,
    MarketEventType.ETF,
    MarketEventType.SECURITY_INCIDENT,
    MarketEventType.NETWORK_INCIDENT,
    MarketEventType.MEME_TREND,
]);

// Recognized crypto keywords / entities (lowercased)
const CRYPTO_KEYWORDS = [
    // Major tokens & tickers
    'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'binance', 'bnb', 'ripple', 'xrp',
    'cardano', 'ada', 'dogecoin', 'doge', 'shiba', 'shib', 'pepe', 'wif', 'bonk', 'floki',
    'avalanche', 'avax', 'polkadot', 'dot', 'chainlink', 'link', 'uniswap', 'uni', 'near',
    'sui', 'aptos', 'apt', 'arbitrum', 'arb', 'optimism', 'op', 'celestia', 'tia', 'injective', 'inj',
    'render', 'fetch.ai', 'fet', 'bittensor', 'tao', 'zcash', 'zec', 'monero', 'xmr', 'litecoin', 'ltc',
    'toncoin', 'ton', 'kaspa', 'kas', 'hyperliquid', 'hype', 'virtual', 'ai16z', 'grass', 'ethena', 'ena',
    'pendle', 'aave', 'makerdao', 'mkr', 'curve', 'crv', 'lido', 'ldo', 'jupiter', 'jup', 'raydium', 'ray',
    'ondo', 'mantle', 'mnt', 'stacks', 'stx', 'immutable', 'imx', 'worldcoin', 'wld', 'starknet', 'strk',
    'dydx', 'thorchain', 'rune', 'sei', 'jito', 'pyth', 'wormhole', 'blast', 'berachain', 'sonic',
    'polymarket', 'pump.fun',
    // Stablecoins
    'tether', 'usdt', 'usdc', 'circle', 'dai', 'usde', 'fdusd', 'pyusd', 'stablecoin', 'stablecoins',
    // Crypto native terms
    'crypto', 'cryptocurrency', 'cryptocurrencies', 'tiền mã hóa', 'tiền điện tử',
    'blockchain', 'web3', 'defi', 'nft', 'altcoin', 'altcoins', 'memecoin', 'memecoins', 'meme coin',
    'digital asset', 'digital assets', 'virtual asset', 'virtual assets', 'tài sản số',
    'smart contract', 'smart contracts', 'layer 1', 'layer 2', 'layer-2', 'l2', 'rollup', 'rollups',
    'zero knowledge', 'zk-rollup', 'staking', 'restaking', 'liquid staking', 'airdrop', 'halving',
    'proof of stake', 'proof of work', 'pos', 'pow', 'hashrate', 'hash rate', 'mining pool', 'crypto mining',
    'crypto wallet', 'hardware wallet', 'cold wallet', 'metamask', 'phantom wallet', 'ledger wallet',
    'dex', 'cex', 'liquidity pool', 'yield farming', 'tokenomics', 'gas fee', 'gwei',
    'rug pull', 'flash loan attack', 'bridge exploit', 'smart contract exploit', 'hack crypto',
    'ordinals', 'runes protocol', 'brc-20', 'erc-20', 'spl token',
    // Major exchanges & brokers
    'coinbase', 'kraken', 'okx', 'bybit', 'kucoin', 'gate.io', 'bitget', 'upbit', 'bithumb',
    'robinhood crypto', 'binance us', 'gemini exchange',
    // Asset managers & ETF
    'grayscale', 'blackrock', 'fidelity digital', 'bitwise', 'vaneck', '21shares', 'ark invest',
    'franklin templeton', 'microstrategy', 'michael saylor', 'marathon digital', 'riot platforms',
    'crypto etf', 'bitcoin etf', 'ether etf', 'solana etf', 'spot etf',
    // Regulators & Policy specifically targeting crypto
    'gary gensler', 'crypto regulation', 'crypto bill', 'fit21', 'sab 121', 'mica regulation',
    'crypto ban', 'crypto license', 'vasp', 'vasps', 'sec vs', 'cftc crypto',
];

// Recognized macro keywords that materially impact global risk assets and liquidity
const MACRO_KEYWORDS = [
    'federal reserve', 'the fed', 'fed hike', 'fed cut', 'fomc', 'jerome powell', 'chair powell',
    'interest rate', 'interest rates', 'rate hike', 'rate cut', 'lãi suất', 'cắt giảm lãi suất', 'tăng lãi suất',
    'cpi', 'consumer price index', 'core cpi', 'pce', 'personal consumption expenditures',
    'inflation', 'lạm phát', 'deflation', 'disinflation', 'stagflation',
    'non-farm payrolls', 'nonfarm payrolls', 'jobless claims', 'unemployment rate', 'tỷ lệ thất nghiệp', 'bảng lương phi nông nghiệp',
    'dxy', 'us dollar index', 'treasury yield', 'treasury yields', '10-year treasury', '2-year treasury', 'lợi suất trái phiếu',
    'global liquidity', 'liquidity injection', 'quantitative easing', 'quantitative tightening', 'm2 money supply', 'cung tiền m2',
    'major tariffs', 'trade tariffs', 'trade sanctions', 'economic sanctions', 'banking crisis', 'bank bailout',
];

// Unrelated local Chinese / non-crypto keywords that must be rejected if no crypto connection
const IRRELEVANT_PATTERNS = [
    /停充/,
    /智慧停车/,
    /停车场/,
    /充电桩/,
    /智慧城市/,
    /地产/,
    /隧道股份/,
    /陆家嘴/,
    /城投/,
    /私募股权投资.*(?:充电|物业|基建|市政|水务|燃气)/,
];

export interface RelevanceCheckTarget {
    title?: string;
    summary?: string;
    content?: string;
    tokens?: string[];
    symbols?: string[];
    eventType?: string;
    category?: string;
    metadata?: Record<string, any>;
}

/**
 * Validates that an article/event title is non-empty, of sufficient length,
 * and not a generic placeholder like "Untitled" or "No title".
 */
export function isValidTitle(title?: string | null, minLength = 15): boolean {
    if (!title) {
        return false;
    }
    const trimmed = title.trim();
    if (trimmed.length < minLength) {
        return false;
    }
    const lower = trimmed.toLowerCase();
    if (INVALID_TITLES.has(lower)) {
        return false;
    }
    return true;
}

/**
 * Hard Relevance Filter: Determines whether an event is genuinely relevant to
 * Crypto, Memecoins, Web3 or material Macroeconomics affecting risk assets.
 *
 * Rules:
 * 1. Must satisfy at least ONE of:
 *    - Recognized crypto tokens / symbols present
 *    - Crypto event type (Listing, ETF, Meme, Security incident)
 *    - Explicit crypto keyword / entity in title or text
 *    - Material macroeconomic event affecting risk assets
 * 2. Hard-rejects purely local infrastructure, parking lots, non-crypto municipal funds.
 * 3. Never allows generic filler to justify inclusion.
 */
export function isCryptoMarketRelevant(target: RelevanceCheckTarget): boolean {
    if (!target) {
        return false;
    }

    const title = target.title || '';
    const summary = target.summary || '';
    const content = target.content || '';
    const fullText = `${title} ${summary} ${content}`.toLowerCase();

    // 1. Hard check against known irrelevant patterns (e.g. Chinese parking / municipal funds)
    for (const pattern of IRRELEVANT_PATTERNS) {
        if (pattern.test(fullText)) {
            // Check if there is an explicit, legitimate crypto connection (not just accidental word)
            const hasExplicitCrypto = CRYPTO_KEYWORDS.some((kw) => {
                const re = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'i');
                return re.test(fullText);
            });
            if (!hasExplicitCrypto) {
                return false;
            }
        }
    }

    // 2. Check crypto event type
    if (target.eventType && CRYPTO_EVENT_TYPES.has(target.eventType)) {
        return true;
    }

    // 3. Check recognized tokens/symbols
    const tokens = target.tokens || [];
    const symbols = target.symbols || [];
    const validTokens = tokens.filter((t) => t && t.length >= 2 && !['THE', 'ALL', 'NEW', 'TOP', 'USD'].includes(t.toUpperCase()));
    if (validTokens.length > 0) {
        return true;
    }
    if (symbols.length > 0 && symbols.some((s) => s.startsWith('$') && s.length >= 2)) {
        return true;
    }

    // 4. Check category
    if (target.category === 'MEMECOIN') {
        return true;
    }

    // 5. Match crypto keywords in title or summary
    const hasCryptoKeyword = CRYPTO_KEYWORDS.some((kw) => {
        const re = new RegExp(`(?:^|[^a-zA-Z0-9])${kw.replace('.', '\\.')}(?:$|[^a-zA-Z0-9])`, 'i');
        return re.test(fullText);
    });

    if (hasCryptoKeyword) {
        return true;
    }

    // 6. Match macro keywords in title or summary (must be in title or first 200 chars to ensure primary topic)
    const titleAndSummary = `${title} ${summary}`.toLowerCase();
    const hasMacroKeyword = MACRO_KEYWORDS.some((kw) => {
        const re = new RegExp(`(?:^|[^a-zA-Z0-9])${kw.replace('.', '\\.')}(?:$|[^a-zA-Z0-9])`, 'i');
        return re.test(titleAndSummary);
    });

    if (hasMacroKeyword) {
        return true;
    }

    return false;
}
