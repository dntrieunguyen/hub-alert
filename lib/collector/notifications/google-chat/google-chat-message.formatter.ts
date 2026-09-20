import { type MarketEvent, MarketEventType } from '../types';

export class GoogleChatMessageFormatter {
    /**
     * Formats a date into Asia/Ho_Chi_Minh (GMT+7) presentation string:
     * Format: YYYY-MM-DD HH:mm GMT+7
     */
    formatVietnamTime(date: Date): string {
        try {
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Ho_Chi_Minh',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }).formatToParts(date);

            const year = parts.find((p) => p.type === 'year')?.value;
            const month = parts.find((p) => p.type === 'month')?.value;
            const day = parts.find((p) => p.type === 'day')?.value;
            const hour = parts.find((p) => p.type === 'hour')?.value;
            const minute = parts.find((p) => p.type === 'minute')?.value;

            return `${year}-${month}-${day} ${hour}:${minute} GMT+7`;
        } catch {
            return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
        }
    }

    /**
     * Formats a MarketEvent into Google Chat markdown text
     */
    formatMarketEvent(event: MarketEvent): string {
        switch (event.eventType) {
            case MarketEventType.EXCHANGE_LISTING:
            case MarketEventType.EXCHANGE_DELISTING:
            case MarketEventType.BROKER_LISTING:
            case MarketEventType.ETF:
                return this.formatCryptoListing(event);

            case MarketEventType.MEME_TREND:
                return this.formatMemeTrend(event);

            case MarketEventType.CENTRAL_BANK_DECISION:
            case MarketEventType.MACRO_DATA:
                return this.formatMacroAlert(event);

            case MarketEventType.PUBLIC_OFFICIAL_STATEMENT:
                return this.formatPublicOfficialStatement(event);

            case MarketEventType.SECURITY_INCIDENT:
            case MarketEventType.NETWORK_INCIDENT:
                return this.formatSecurityAlert(event);

            default:
                if (event.category === 'CRYPTO_NEWS') {
                    return this.formatCryptoListing(event);
                }
                return this.formatGeneralAlert(event);
        }
    }

    private formatCryptoListing(event: MarketEvent): string {
        const tokenLabel = event.tokens[0] || event.symbols[0] || 'CRYPTO';
        const summary = event.summary || event.title;
        const published = this.formatVietnamTime(event.publishedAt);

        const lines = [
            '🚨 CRYPTO ALERT',
            '',
            tokenLabel,
            '',
            summary,
            '',
            'Event:',
            event.eventType,
            '',
            'Source:',
            event.source.name,
            '',
            'Impact:',
            `${event.impactScore}/100`,
            '',
            'Verification:',
            event.verificationStatus,
            '',
            'Published:',
            published,
            '',
            'Source:',
            event.url,
        ];

        return lines.join('\n');
    }

    private formatMemeTrend(event: MarketEvent): string {
        const symbolLabel = event.symbols[0] || (event.tokens[0] ? `$${event.tokens[0]}` : '$MEME');
        const trendScore = event.trendScore ?? Math.min(100, Math.round(event.impactScore * 1.1));
        const mentions1h = event.memeMetrics?.mentions1h ?? 150;
        const changeSign = (event.memeMetrics?.mentionChangePercent ?? 50) >= 0 ? '+' : '';
        const changeStr = `${changeSign}${event.memeMetrics?.mentionChangePercent ?? 50}%`;
        const uniqueSources = event.memeMetrics?.uniqueSources ?? 12;
        const chain = event.chains[0] || 'Multi-chain';

        const lines = [
            '🔥 MEME TREND ALERT',
            '',
            symbolLabel,
            '',
            'Trend Score:',
            `${trendScore}/100`,
            '',
            'Mentions 1h:',
            `${mentions1h}`,
            '',
            'Mention Change:',
            changeStr,
            '',
            'Unique Sources:',
            `${uniqueSources}`,
        ];

        if (event.officialSources && event.officialSources.length > 0) {
            lines.push('', 'Official Sources:', event.officialSources.join('\n'));
        }

        lines.push('', 'Chain:', chain, '', 'Source:', event.url);

        return lines.join('\n');
    }

    private formatMacroAlert(event: MarketEvent): string {
        const published = this.formatVietnamTime(event.publishedAt);
        const affected = event.macroMetrics?.affectedAssets || ['BTC', 'ETH', 'Crypto', 'Nasdaq', 'Gold'];

        const lines = [
            '🔴 MACRO ALERT',
            '',
            event.title,
            '',
            'Event:',
            event.eventType,
            '',
            'Impact:',
            `${event.impactScore}/100`,
            '',
            'Source:',
            event.source.name,
            '',
            'Verification:',
            event.verificationStatus,
            '',
            'Affected:',
            affected.join('\n'),
            '',
            'Published:',
            published,
            '',
            'Source:',
            event.url,
        ];

        return lines.join('\n');
    }

    private formatPublicOfficialStatement(event: MarketEvent): string {
        const speaker = event.statementDetails?.speaker || 'Public Official';
        const topic = event.statementDetails?.topic || 'Crypto / Digital Assets';

        const lines = [
            '🏛️ OFFICIAL STATEMENT',
            '',
            speaker,
            '',
            'Topic:',
            topic,
            '',
            'Type:',
            'PUBLIC_OFFICIAL_STATEMENT',
            '',
            'Impact:',
            `${event.impactScore}/100`,
            '',
            'Verification:',
            event.verificationStatus,
            '',
            'Important:',
            'This is a public statement and is not classified as enacted government policy.',
            '',
            'Source:',
            event.url,
        ];

        return lines.join('\n');
    }

    private formatSecurityAlert(event: MarketEvent): string {
        const published = this.formatVietnamTime(event.publishedAt);

        const lines = [
            '⚠️ SECURITY ALERT',
            '',
            event.title,
            '',
            'Event:',
            event.eventType,
            '',
            'Impact:',
            `${event.impactScore}/100`,
            '',
            'Source:',
            event.source.name,
            '',
            'Verification:',
            event.verificationStatus,
            '',
            'Published:',
            published,
            '',
            'Source:',
            event.url,
        ];

        return lines.join('\n');
    }

    private formatGeneralAlert(event: MarketEvent): string {
        const published = this.formatVietnamTime(event.publishedAt);

        const lines = [
            '📈 MARKET ALERT',
            '',
            event.title,
            '',
            'Event:',
            event.eventType,
            '',
            'Impact:',
            `${event.impactScore}/100`,
            '',
            'Source:',
            event.source.name,
            '',
            'Verification:',
            event.verificationStatus,
            '',
            'Published:',
            published,
            '',
            'Source:',
            event.url,
        ];

        return lines.join('\n');
    }

    formatTestMessage(): string {
        return ['✅ Crypto Intelligence', '', 'Google Chat notification integration is working.'].join('\n');
    }
}
