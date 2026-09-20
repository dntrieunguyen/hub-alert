import { VerificationStatus } from '../types';
import type { AggregatedMarketEvent, DigestPayload, DigestTrendingToken } from './types';
import { isValidHttpUrl } from './crypto-digest-vietnamese-validator';

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export class CryptoDigestFormatterService {
    /**
     * Formats a complete DigestPayload into the Top 10 Google Chat Markdown structure
     * strictly following Sections 24, 25, 26, 27, 28, and 29.
     */
    formatDigest(payload: DigestPayload): string {
        const dateStr = this.formatVietnamDate(payload.generatedAt);
        const itemCount = payload.items.length;

        const lines: string[] = [];

        // 1. Header
        lines.push('🚀 CRYPTO INTELLIGENCE DIGEST');
        lines.push(`🕒 ${dateStr}`);
        lines.push('');
        lines.push(`Top ${itemCount} sự kiện Crypto, Meme và thị trường đáng chú ý nhất kể từ bản tin trước.`);
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 2. Top 10 Điểm Tin
        lines.push(`📌 TOP ${itemCount} ĐIỂM TIN`);
        lines.push('');

        payload.items.forEach((item, index) => {
            lines.push(this.formatStoryItem(item, index + 1));
            if (index < payload.items.length - 1) {
                lines.push('');
                lines.push('──────────────────');
                lines.push('');
            }
        });

        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 3. Đánh Giá Thị Trường (Section 27 & 28)
        lines.push('📊 ĐÁNH GIÁ THỊ TRƯỜNG');
        lines.push('');

        const overallScore = payload.overallImpactScore ?? this.calculateOverallImpactScore(payload.items);
        const overallLabel = payload.overallImpactLabel ?? this.formatOverallImpactLabel(overallScore);
        lines.push(`🌡️ Mức ảnh hưởng chung: ${overallScore}/100 — ${overallLabel}`);
        lines.push('');

        const topNarratives = this.extractTopNarratives(payload.items);
        if (topNarratives.length > 0) {
            lines.push('Các narrative nổi bật:');
            for (const n of topNarratives) {
                lines.push(`• ${n}`);
            }
            lines.push('');
        }

        const topTokens = this.extractTopTokens(payload.items);
        if (topTokens.length > 0) {
            lines.push('Tài sản được nhắc đến nhiều:');
            for (const t of topTokens) {
                lines.push(`• ${t}`);
            }
            lines.push('');
        }

        // 4. Trending Tokens (If available)
        if (payload.trendingTokens && payload.trendingTokens.length > 0) {
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
            lines.push('🔥 TOKEN ĐANG ĐƯỢC CHÚ Ý');
            lines.push('');
            lines.push(this.formatTrendingTokens(payload.trendingTokens.slice(0, 5)));
            lines.push('');
        }

        // 5. Cần Theo Dõi (Section 29)
        const signals = payload.signalsToWatch || this.buildSignalsToWatch(payload.items);
        if (signals && signals.length > 0) {
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
            lines.push('👀 CẦN THEO DÕI');
            lines.push('');
            for (const s of signals) {
                lines.push(`• ${s}`);
            }
            lines.push('');
        }

        // 6. Disclaimer
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('Dữ liệu được tổng hợp từ các nguồn chính thức và nguồn tin có độ tin cậy cao.');
        lines.push('Bản tin không cấu thành khuyến nghị đầu tư tài chính.');

        return lines.join('\n').trim();
    }

    private formatStoryItem(item: AggregatedMarketEvent, rank: number): string {
        const emoji = rank <= 10 ? NUMBER_EMOJIS[rank - 1] : `${rank}.`;
        const title = item.vietnameseTitle || item.title;
        const summary = item.vietnameseSummary || item.summary || title;
        const url = item.canonicalUrl;

        const lines: string[] = [];

        // Title line
        lines.push(`${emoji} ${title}`);

        // Link validation: only render link if URL is valid, never render <|Title> or empty URL
        if (url && isValidHttpUrl(url)) {
            lines.push(`🔗 <${url}|Xem nguồn>`);
        }

        lines.push('');
        lines.push(summary);

        // Why It Matters
        if (item.whyItMattersVi) {
            lines.push('');
            lines.push('💡 Vì sao đáng chú ý');
            lines.push(item.whyItMattersVi);
        }

        // Evaluation
        lines.push('');
        lines.push('📊 Đánh giá');
        const impactLabel = this.formatImpactLabel(item.impactScore);
        lines.push(`• Ảnh hưởng: ${item.impactScore}/100 — ${impactLabel}`);

        const credScore = item.rankingBreakdown?.credibilityScore ?? item.primaryEvent.source.credibilityScore;
        const credLabel = this.formatCredibilityLabel(credScore);
        lines.push(`• Độ tin cậy: ${credLabel}`);

        const verificationLabel = this.formatVerificationLabel(item.verificationStatus);
        lines.push(`• Xác minh: ${verificationLabel}`);

        // Related tokens & entities
        const related = this.buildRelatedTags(item);
        if (related.length > 0) {
            lines.push(`• Liên quan: ${related.join(' • ')}`);
        }

        if (item.wasCriticalAlerted) {
            lines.push('• Trạng thái: [Đã phát cảnh báo khẩn cấp trước đó]');
        }

        return lines.join('\n');
    }

    private buildRelatedTags(item: AggregatedMarketEvent): string[] {
        const tags: string[] = [];
        for (const token of item.tokens) {
            if (token && !tags.includes(token)) {
                tags.push(token);
            }
        }
        for (const topic of item.topics) {
            const vnTopic = this.formatTopicLabel(topic);
            if (vnTopic && !tags.includes(vnTopic)) {
                tags.push(vnTopic);
            }
        }
        if (tags.length === 0 && item.category) {
            tags.push(item.category);
        }
        return tags.slice(0, 4);
    }

    formatImpactLabel(score: number): string {
        if (score >= 90) {
            return 'Rất lớn';
        }
        if (score >= 75) {
            return 'Lớn';
        }
        if (score >= 60) {
            return 'Đáng chú ý';
        }
        if (score >= 45) {
            return 'Trung bình';
        }
        return 'Thấp';
    }

    formatCredibilityLabel(score: number): string {
        if (score >= 95) {
            return 'Rất cao (Chính thức)';
        }
        if (score >= 85) {
            return 'Rất cao';
        }
        if (score >= 75) {
            return 'Cao';
        }
        if (score >= 60) {
            return 'Trung bình';
        }
        return 'Thấp';
    }

    formatVerificationLabel(status: VerificationStatus): string {
        switch (status) {
            case VerificationStatus.CONFIRMED_PRIMARY_SOURCE:
                return 'Nguồn chính thức';
            case VerificationStatus.CONFIRMED_MULTI_SOURCE:
                return 'Đa nguồn';
            case VerificationStatus.ATTRIBUTED_STATEMENT:
                return 'Phát biểu đã xác nhận';
            case VerificationStatus.OFFICIAL_SOCIAL_ONLY:
                return 'Kênh mạng xã hội chính thức';
            case VerificationStatus.UNVERIFIED:
                return 'Chưa xác minh';
            case VerificationStatus.DISPUTED:
                return 'Đang tranh chấp';
            default:
                return 'Nguồn thứ cấp';
        }
    }

    formatTopicLabel(topic: string): string {
        const upper = (topic || '').toUpperCase();
        switch (upper) {
            case 'ETF':
                return 'ETF';
            case 'LISTING':
                return 'Niêm yết sàn';
            case 'REGULATION':
                return 'Pháp lý';
            case 'MACRO':
                return 'Vĩ mô';
            case 'SECURITY':
                return 'Bảo mật';
            case 'MEME':
            case 'MEMECOIN':
                return 'Memecoin';
            default:
                return topic;
        }
    }

    calculateOverallImpactScore(items: AggregatedMarketEvent[]): number {
        if (!items || items.length === 0) {
            return 50;
        }
        // Weighted average with slight bonus for multiple high-impact items
        const sum = items.reduce((acc, item) => acc + item.impactScore, 0);
        const avg = sum / items.length;
        const highImpactCount = items.filter((i) => i.impactScore >= 75).length;
        const bonus = Math.min(10, highImpactCount * 2);
        return Math.min(100, Math.max(0, Math.round(avg + bonus)));
    }

    formatOverallImpactLabel(score: number): string {
        if (score >= 75) {
            return 'Cao';
        }
        if (score >= 55) {
            return 'Trung bình';
        }
        return 'Thấp';
    }

    private extractTopNarratives(items: AggregatedMarketEvent[]): string[] {
        const counts = new Map<string, number>();
        for (const item of items) {
            if (item.eventType.includes('ETF') || item.topics.includes('ETF')) {
                counts.set('ETF', (counts.get('ETF') || 0) + 1);
            }
            if (item.eventType.includes('CENTRAL_BANK') || item.eventType.includes('MACRO')) {
                counts.set('Fed / Lãi suất / Thanh khoản', (counts.get('Fed / Lãi suất / Thanh khoản') || 0) + 1);
            }
            if (item.eventType.includes('LISTING') || item.topics.includes('LISTING')) {
                counts.set('Niêm yết sàn', (counts.get('Niêm yết sàn') || 0) + 1);
            }
            if (item.eventType.includes('MEME') || item.category === 'MEMECOIN') {
                counts.set('Meme activity', (counts.get('Meme activity') || 0) + 1);
            }
            if (item.eventType.includes('REGULATION') || item.eventType.includes('POLICY')) {
                counts.set('Chính sách pháp lý', (counts.get('Chính sách pháp lý') || 0) + 1);
            }
            if (item.eventType.includes('SECURITY')) {
                counts.set('Bảo mật & Cảnh báo', (counts.get('Bảo mật & Cảnh báo') || 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([narrative]) => narrative);
    }

    private extractTopTokens(items: AggregatedMarketEvent[]): string[] {
        const counts = new Map<string, number>();
        for (const item of items) {
            for (const token of item.tokens) {
                const upper = token.toUpperCase();
                if (['THE', 'NEW', 'ALL', 'USD'].includes(upper)) {
                    continue;
                }
                counts.set(upper, (counts.get(upper) || 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([token]) => token);
    }

    private buildSignalsToWatch(items: AggregatedMarketEvent[]): string[] {
        const signals: string[] = [];

        const macroItem = items.find((i) => i.eventType.includes('CENTRAL_BANK') || i.eventType.includes('MACRO'));
        if (macroItem) {
            signals.push('Thị trường đang hấp thụ dữ liệu vĩ mô mới; theo dõi biến động các cặp BTC và ETH.');
        }

        const etfItem = items.find((i) => i.eventType.includes('ETF'));
        if (etfItem && etfItem.tokens[0]) {
            signals.push(`${etfItem.tokens[0]} nhận mức độ chú ý cao sau cập nhật liên quan đến hồ sơ ETF.`);
        }

        const multiSource = items.find((i) => i.sources.length >= 2 && i.tokens.length > 0);
        if (multiSource && multiSource.tokens[0]) {
            signals.push(`${multiSource.tokens[0]} xuất hiện đồng thời trên nhiều nguồn tin xác thực.`);
        }

        return signals.slice(0, 3);
    }

    private formatTrendingTokens(tokens: DigestTrendingToken[]): string {
        const parts: string[] = [];
        tokens.forEach((t, i) => {
            const sym = t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`;
            const velocity = t.mentionChangePercent ? ` (Tốc độ đề cập 1h: +${t.mentionChangePercent}%)` : '';
            const sources = t.topSources.length > 0 ? `\nNguồn: ${t.topSources.slice(0, 3).join(', ')}` : '';
            parts.push(`${i + 1}. ${sym} — Trend Score ${t.trendScore}/100${velocity}${sources}`);
        });
        return parts.join('\n\n');
    }

    private formatVietnamDate(date: Date): string {
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

            if (hour && minute) {
                return `${day}/${month}/${year} • ${hour}:${minute}`;
            }
            return `${day}/${month}/${year}`;
        } catch {
            return date.toISOString().slice(0, 16).replace('T', ' • ');
        }
    }
}
