import type { RawRssItem } from '../parser/rss-parser.service';
import type { CryptoFeedItem, FeedSource } from '../types';

export class FeedNormalizerService {
    /**
     * Cleans HTML markup, extra spaces, and entities from plain text
     */
    cleanText(htmlOrText?: string): string {
        if (!htmlOrText) {
            return '';
        }
        // Remove HTML tags
        let text = htmlOrText.replaceAll(/<[^>]+>/g, ' ');
        // Decode common HTML entities
        text = text
            .replaceAll('&amp;', '&')
            .replaceAll('&lt;', '<')
            .replaceAll('&gt;', '>')
            .replaceAll('&quot;', '"')
            .replaceAll('&#39;', "'")
            .replaceAll('&nbsp;', ' ');
        // Collapse whitespace
        return text.replaceAll(/\s+/g, ' ').trim();
    }

    /**
     * Normalizes a URL by removing common tracking parameters and trailing slashes
     */
    normalizeUrl(rawUrl?: string): string {
        if (!rawUrl) {
            return '';
        }
        try {
            const parsed = new URL(rawUrl.trim());
            // Strip tracking params
            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'fbclid', 'gclid'];
            for (const p of trackingParams) {
                parsed.searchParams.delete(p);
            }
            let normalized = parsed.toString();
            if (normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        } catch {
            return rawUrl.trim().replace(/\/+$/, '');
        }
    }

    /**
     * Parses a date string safely into a Date object
     */
    parsePublishedDate(dateStr?: string, fallback: Date = new Date()): Date {
        if (!dateStr) {
            return fallback;
        }
        const parsed = new Date(dateStr);
        if (Number.isNaN(parsed.getTime())) {
            return fallback;
        }
        return parsed;
    }

    /**
     * Normalizes a RawRssItem into a CryptoFeedItem
     */
    normalizeItem(raw: RawRssItem, source: FeedSource, fingerprint: string): CryptoFeedItem {
        const title = this.cleanText(raw.title || 'Untitled');
        const url = this.normalizeUrl(raw.link || '');
        const summary = this.cleanText(raw.summary || raw.contentSnippet || raw.description || '');
        const content = typeof raw.content === 'string' ? raw.content : (raw['content:encoded'] as string) || summary;
        const author = raw.author || raw.creator || undefined;
        const publishedAt = this.parsePublishedDate(raw.isoDate || raw.pubDate);
        const externalId = (raw.guid || raw.id || url || `${source.id}-${publishedAt.getTime()}`).toString();

        return {
            id: fingerprint,
            externalId,
            fingerprint,
            sourceId: source.id,
            sourceName: source.name,
            sourceTier: source.sourceTier,
            category: source.category,
            title,
            summary: summary || undefined,
            content: content || undefined,
            url,
            author,
            publishedAt,
            collectedAt: new Date(),
            tokens: [],
            symbols: [],
            chains: [],
            topics: [],
            entities: [],
            credibilityScore: source.credibilityScore,
            impactScore: 0,
            breaking: false,
        };
    }
}
