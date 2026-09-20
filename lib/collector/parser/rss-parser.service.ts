import Parser from 'rss-parser';

export interface RawRssItem {
    id?: string;
    guid?: string;
    title?: string;
    link?: string;
    pubDate?: string;
    isoDate?: string;
    content?: string;
    contentSnippet?: string;
    summary?: string;
    author?: string;
    creator?: string;
    categories?: string[];
    [key: string]: unknown;
}

export interface RawRssFeed {
    title?: string;
    description?: string;
    link?: string;
    items: RawRssItem[];
}

export class RssParserService {
    private parser: Parser;

    constructor() {
        this.parser = new Parser({
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CryptoMarketIntelligence/1.0; +https://rsshub.app)',
                Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
            },
            customFields: {
                item: ['description', 'content:encoded', 'summary', 'creator', 'author'],
            },
        });
    }

    async parseString(xmlContent: string): Promise<RawRssFeed> {
        const feed = await this.parser.parseString(xmlContent);
        return {
            title: feed.title,
            description: feed.description,
            link: feed.link,
            items: (feed.items || []) as RawRssItem[],
        };
    }

    async parseUrl(url: string): Promise<RawRssFeed> {
        const feed = await this.parser.parseURL(url);
        return {
            title: feed.title,
            description: feed.description,
            link: feed.link,
            items: (feed.items || []) as RawRssItem[],
        };
    }
}
