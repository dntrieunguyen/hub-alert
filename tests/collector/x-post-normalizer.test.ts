import { describe, expect, it } from 'vitest';

import { XPostNormalizerService } from '@/collector/x';

describe('XPostNormalizerService', () => {
    const normalizer = new XPostNormalizerService();

    describe('Link Analysis', () => {
        it('should extract URLs and resolve official domain matches', () => {
            const text = 'Today the SEC approved the first Solana ETF. Details at https://www.sec.gov/news/press-release/2025-1';
            const analysis = normalizer.extractLinkAnalysis(text, 'sec.gov');

            expect(analysis.linkedUrls).toHaveLength(1);
            expect(analysis.linkedDomains).toContain('sec.gov');
            expect(analysis.hasPrimarySourceLink).toBe(true);
            expect(analysis.matchedOfficialDomain).toBe('sec.gov');
        });

        it('should handle subdomains matching official domain', () => {
            const text = 'OFAC sanctions announced at https://home.treasury.gov/policy-issues/financial-sanctions';
            const analysis = normalizer.extractLinkAnalysis(text, 'treasury.gov');

            expect(analysis.hasPrimarySourceLink).toBe(true);
            expect(analysis.matchedOfficialDomain).toBe('home.treasury.gov');
        });

        it('should not mark twitter/x.com links as primary source link', () => {
            const text = 'Check out this post https://twitter.com/federalreserve/status/12345';
            const analysis = normalizer.extractLinkAnalysis(text, 'federalreserve.gov');

            expect(analysis.hasPrimarySourceLink).toBe(false);
            expect(analysis.linkedDomains).not.toContain('twitter.com');
        });

        it('should return false when link does not match official domain', () => {
            const text = 'Rumor: Fed cut rates according to https://randomblog.com/news';
            const analysis = normalizer.extractLinkAnalysis(text, 'federalreserve.gov');

            expect(analysis.hasPrimarySourceLink).toBe(false);
            expect(analysis.linkedDomains).toContain('randomblog.com');
        });
    });

    describe('Post Structure Parsing', () => {
        it('should parse post ID from Twitter/X URL', () => {
            const url = 'https://x.com/RobinhoodApp/status/1888999000';
            const struct = normalizer.parsePostStructure('Added PEPE', '', url, 'RobinhoodApp');

            expect(struct.postId).toBe('1888999000');
            expect(struct.handle).toBe('RobinhoodApp');
            expect(struct.isRepost).toBe(false);
        });

        it('should detect retweets and attribute to canonical handle', () => {
            const title = 'RT @CoinbaseMarkets: Spot trading for PEPE is now live!';
            const url = 'https://x.com/Coinbase/status/1999999999';
            const struct = normalizer.parsePostStructure(title, '', url, 'Coinbase');

            expect(struct.isRepost).toBe(true);
            expect(struct.canonicalHandle).toBe('CoinbaseMarkets');
        });

        it('should detect reply posts', () => {
            const text = '@follower Yes, support for SOL deposits is active.';
            const url = 'https://x.com/RobinhoodApp/status/1888999111';
            const struct = normalizer.parsePostStructure(text, '', url, 'RobinhoodApp');

            expect(struct.isReply).toBe(true);
            expect(struct.isRepost).toBe(false);
        });

        it('should detect quote tweets with quoted post ID', () => {
            const title = 'Huge milestone for crypto!';
            const content = 'Quoting: https://x.com/ethereum/status/1777777777';
            const url = 'https://x.com/base/status/1888888888';
            const struct = normalizer.parsePostStructure(title, content, url, 'base');

            expect(struct.isQuote).toBe(true);
            expect(struct.quotedPostId).toBe('1777777777');
        });
    });
});
