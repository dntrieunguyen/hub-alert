import { describe, expect, it } from 'vitest';

import { TopicExtractorService } from '../../lib/collector/extraction/topic-extractor.service';

describe('TopicExtractorService', () => {
    const extractor = new TopicExtractorService();

    it('should classify LISTING and DELISTING', () => {
        const text1 = 'Binance will list PEPE with spot trading pairs.';
        expect(extractor.extractTopics(text1)).toContain('LISTING');

        const text2 = 'OKX announces delisting of specific margin pairs due to liquidity.';
        expect(extractor.extractTopics(text2)).toContain('DELISTING');
    });

    it('should classify ETF and REGULATION', () => {
        const text = 'SEC reviews new Ethereum spot ETF filings amid strict regulatory scrutiny.';
        const topics = extractor.extractTopics(text);
        expect(topics).toContain('ETF');
        expect(topics).toContain('REGULATION');
    });

    it('should classify HACK_EXPLOIT and SECURITY', () => {
        const text = 'DeFi bridge suffered a $50M exploit due to a reentrancy vulnerability, funds drained.';
        const topics = extractor.extractTopics(text);
        expect(topics).toContain('HACK_EXPLOIT');
    });

    it('should classify FED, INFLATION, and LIQUIDITY', () => {
        const text = 'Federal Reserve signals upcoming rate cut as CPI inflation drops to 2.5%, boosting liquidity.';
        const topics = extractor.extractTopics(text);
        expect(topics).toContain('FED');
        expect(topics).toContain('INFLATION');
        expect(topics).toContain('LIQUIDITY');
    });

    it('should support multiple topics in one article', () => {
        const text = 'Binance listing announcement: new token launch with airdrop rewards following mainnet release.';
        const topics = extractor.extractTopics(text);
        expect(topics).toEqual(expect.arrayContaining(['LISTING', 'TOKEN_LAUNCH', 'AIR_DROP', 'MAINNET']));
    });
});
