import type { TokenDictionaryEntry } from '../types';
import { INITIAL_TOKEN_DICTIONARY } from './token-dictionary';

interface CompiledTokenPattern {
    entry: TokenDictionaryEntry;
    regex: RegExp;
}

export class TokenExtractorService {
    private dictionary: Map<string, TokenDictionaryEntry> = new Map();
    private compiledPatterns: CompiledTokenPattern[] = [];

    constructor(initialDictionary?: TokenDictionaryEntry[]) {
        const list = initialDictionary ?? INITIAL_TOKEN_DICTIONARY;
        for (const entry of list) {
            this.registerToken(entry);
        }
    }

    /**
     * Extends or updates the dictionary with a new token
     */
    registerToken(entry: TokenDictionaryEntry): void {
        this.dictionary.set(entry.symbol.toUpperCase(), entry);
        this.compilePatterns();
    }

    getDictionary(): TokenDictionaryEntry[] {
        return Array.from(this.dictionary.values());
    }

    private compilePatterns(): void {
        this.compiledPatterns = [];
        for (const entry of this.dictionary.values()) {
            // Build regex for each alias
            const regexParts: string[] = [];

            for (const alias of entry.aliases) {
                const trimmed = alias.trim();
                if (!trimmed) {
                    continue;
                }

                if (trimmed.startsWith('$')) {
                    // Match e.g. $BTC with word boundary or non-word end
                    const escaped = trimmed.replace('$', '\\$');
                    regexParts.push(`(?:${escaped}\\b)`);
                } else if (trimmed === entry.symbol && trimmed.length <= 4) {
                    // Short symbol like BTC, SOL, ETH, WIF: case sensitive match with word boundary
                    regexParts.push(`(?:\\b${trimmed}\\b)`);
                } else {
                    // Full names or longer words: case insensitive match with word boundary
                    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    regexParts.push(`(?:\\b${escaped}\\b)`);
                }
            }

            if (regexParts.length > 0) {
                // Combine aliases for this entry
                const pattern = new RegExp(regexParts.join('|'), 'iu');
                this.compiledPatterns.push({
                    entry,
                    regex: pattern,
                });
            }
        }
    }

    /**
     * Extracts tokens and symbols from given text
     */
    extract(text: string): { tokens: string[]; symbols: string[]; entries: TokenDictionaryEntry[] } {
        if (!text || typeof text !== 'string') {
            return { tokens: [], symbols: [], entries: [] };
        }

        const matchedTokens = new Set<string>();
        const matchedSymbols = new Set<string>();
        const matchedEntries: TokenDictionaryEntry[] = [];

        for (const { entry, regex } of this.compiledPatterns) {
            if (regex.test(text)) {
                matchedTokens.add(entry.symbol);
                matchedSymbols.add(`$${entry.symbol}`);
                matchedEntries.push(entry);
            }
        }

        return {
            tokens: Array.from(matchedTokens),
            symbols: Array.from(matchedSymbols),
            entries: matchedEntries,
        };
    }
}
