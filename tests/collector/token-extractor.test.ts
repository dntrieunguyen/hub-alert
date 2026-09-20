import { describe, expect, it } from 'vitest';

import { TokenExtractorService } from '../../lib/collector/extraction/token-extractor.service';

describe('TokenExtractorService', () => {
    const extractor = new TokenExtractorService();

    it('should detect $BTC', () => {
        const text = 'Massive inflows into $BTC as institutions accumulate.';
        const result = extractor.extract(text);
        expect(result.tokens).toContain('BTC');
        expect(result.symbols).toContain('$BTC');
    });

    it('should detect Bitcoin by full name', () => {
        const text = 'Bitcoin price hits new monthly high after ETF approvals.';
        const result = extractor.extract(text);
        expect(result.tokens).toContain('BTC');
        expect(result.symbols).toContain('$BTC');
    });

    it('should detect BTC standalone symbol', () => {
        const text = 'Analyzing BTC on-chain volume and miner reserves.';
        const result = extractor.extract(text);
        expect(result.tokens).toContain('BTC');
    });

    it('should detect $PEPE and PEPE memecoin', () => {
        const text1 = 'Whales are moving $PEPE to cold storage.';
        const result1 = extractor.extract(text1);
        expect(result1.tokens).toContain('PEPE');
        expect(result1.symbols).toContain('$PEPE');

        const text2 = 'Top trending meme coins today: PEPE and Dogecoin leading the surge.';
        const result2 = extractor.extract(text2);
        expect(result2.tokens).toContain('PEPE');
        expect(result2.tokens).toContain('DOGE');
    });

    it('should detect multiple tokens in a single article', () => {
        const text = 'Comparing $BTC, Ethereum, and $SOL against memecoins like BONK and WIF.';
        const result = extractor.extract(text);
        expect(result.tokens).toEqual(expect.arrayContaining(['BTC', 'ETH', 'SOL', 'BONK', 'WIF']));
        expect(result.symbols).toEqual(expect.arrayContaining(['$BTC', '$ETH', '$SOL', '$BONK', '$WIF']));
    });

    it('should not false positive on common words', () => {
        const text = 'Can anyone find out if there is a solution for me on this network?';
        const result = extractor.extract(text);
        expect(result.tokens).toHaveLength(0);
    });

    it('should support dynamic registration of new tokens', () => {
        const customExtractor = new TokenExtractorService([]);
        customExtractor.registerToken({
            symbol: 'NEWTOKEN',
            name: 'New Token Coin',
            aliases: ['$NEWTOKEN', 'NEWTOKEN', 'New Token Coin'],
            chain: 'Solana',
            isMeme: true,
        });

        const res = customExtractor.extract('Check out the newly launched $NEWTOKEN on DEX.');
        expect(res.tokens).toContain('NEWTOKEN');
        expect(res.symbols).toContain('$NEWTOKEN');
    });
});
