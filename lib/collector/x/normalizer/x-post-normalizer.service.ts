import type { XPostLinkAnalysis, XPostStructure } from '../types';

export class XPostNormalizerService {
    private static readonly URL_REGEX = /https?:\/\/[^\s<>"')]+[^\s<>"').,;:?!]/gi;
    private static readonly RT_REGEX = /^RT\s+@([a-zA-Z0-9_]+):?/i;
    private static readonly STATUS_URL_REGEX = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/i;
    private static readonly QUOTE_URL_REGEX = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/gi;

    /**
     * Extracts and normalizes links and domains from text and HTML content
     */
    public extractLinkAnalysis(text: string, officialDomain?: string): XPostLinkAnalysis {
        const matches = text.match(XPostNormalizerService.URL_REGEX) || [];
        const linkedUrls: string[] = [];
        const linkedDomains: Set<string> = new Set();
        let hasPrimarySourceLink = false;
        let matchedOfficialDomain: string | undefined;

        for (const rawUrl of matches) {
            try {
                const parsed = new URL(rawUrl);
                const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
                
                // Exclude twitter / x domain themselves from primary source link detection
                if (hostname !== 'twitter.com' && hostname !== 'x.com' && hostname !== 't.co') {
                    linkedUrls.push(rawUrl);
                    linkedDomains.add(hostname);

                    if (officialDomain) {
                        const cleanOfficial = officialDomain.toLowerCase().replace(/^www\./, '');
                        if (hostname === cleanOfficial || hostname.endsWith(`.${cleanOfficial}`)) {
                            hasPrimarySourceLink = true;
                            matchedOfficialDomain = hostname;
                        }
                    }
                }
            } catch {
                // Ignore malformed URLs
            }
        }

        return {
            linkedUrls,
            linkedDomains: Array.from(linkedDomains),
            hasPrimarySourceLink,
            matchedOfficialDomain,
        };
    }

    /**
     * Parses post structure, identifying original posts, replies, retweets, and quote tweets
     */
    public parsePostStructure(rawTitle: string, rawContent: string, postUrl: string, defaultHandle: string): XPostStructure {
        const fullText = `${rawTitle} ${rawContent}`.trim();

        // 1. Post ID from URL
        let postId = '';
        let urlHandle = defaultHandle;
        const statusMatch = postUrl.match(XPostNormalizerService.STATUS_URL_REGEX);
        if (statusMatch) {
            urlHandle = statusMatch[1];
            postId = statusMatch[2];
        } else {
            // Fallback deterministic ID from URL or text
            postId = Buffer.from(postUrl || fullText).toString('base64url').slice(0, 16);
        }

        // 2. Check Repost / Retweet
        let isRepost = false;
        let canonicalHandle = defaultHandle || urlHandle;
        const rtMatch = rawTitle.match(XPostNormalizerService.RT_REGEX) || rawContent.match(XPostNormalizerService.RT_REGEX);
        if (rtMatch) {
            isRepost = true;
            canonicalHandle = rtMatch[1];
        }

        // 3. Check Reply
        const isReply = fullText.startsWith('@') && !isRepost;

        // 4. Check Quote
        let isQuote = false;
        let quotedPostId: string | undefined;
        const quoteMatches = Array.from(fullText.matchAll(XPostNormalizerService.QUOTE_URL_REGEX));
        for (const qMatch of quoteMatches) {
            const quotedId = qMatch[2];
            if (quotedId !== postId) {
                isQuote = true;
                quotedPostId = quotedId;
                break;
            }
        }

        return {
            postId,
            handle: defaultHandle || urlHandle,
            postUrl,
            text: fullText,
            isReply,
            isRepost,
            isQuote,
            quotedPostId,
            canonicalHandle,
        };
    }
}
