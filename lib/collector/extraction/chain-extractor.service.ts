export interface ChainRule {
    name: string;
    keywords: string[];
    regex: RegExp;
}

export const DEFAULT_CHAIN_RULES: Array<{ name: string; keywords: string[] }> = [
    { name: 'Ethereum', keywords: ['ethereum', 'erc-20', 'erc20', 'evm', 'eth'] },
    { name: 'Solana', keywords: ['solana', 'spl-token', 'sol'] },
    { name: 'Bitcoin', keywords: ['bitcoin', 'ordinals', 'runes', 'brc-20', 'brc20'] },
    { name: 'Base', keywords: ['base network', 'base chain', 'on base', 'coinbase base'] },
    { name: 'BNB Chain', keywords: ['bnb chain', 'binance smart chain', 'bsc', 'bep-20', 'bep20'] },
    { name: 'Arbitrum', keywords: ['arbitrum', 'arb'] },
    { name: 'Optimism', keywords: ['optimism', 'op mainnet'] },
    { name: 'Polygon', keywords: ['polygon', 'matic'] },
    { name: 'Avalanche', keywords: ['avalanche', 'avax c-chain'] },
    { name: 'Sui', keywords: ['sui network', 'sui blockchain'] },
    { name: 'TON', keywords: ['ton network', 'the open network'] },
    { name: 'Tron', keywords: ['tron', 'trc-20', 'trc20'] },
];

export class ChainExtractorService {
    private rules: ChainRule[];

    constructor(customRules?: Array<{ name: string; keywords: string[] }>) {
        const raw = customRules ?? DEFAULT_CHAIN_RULES;
        this.rules = raw.map((r) => ({
            name: r.name,
            keywords: r.keywords,
            regex: new RegExp(r.keywords.map((k) => `(?:\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b)`).join('|'), 'iu'),
        }));
    }

    extractChains(text: string): string[] {
        if (!text) {
            return [];
        }
        const matched = new Set<string>();
        for (const rule of this.rules) {
            if (rule.regex.test(text)) {
                matched.add(rule.name);
            }
        }
        return Array.from(matched);
    }
}
