import { VerificationStatus } from '../types';
import type { AggregatedMarketEvent, DigestPayload, DigestTrendingToken, MarketSnapshotSection } from './types';

export class CryptoDigestFormatterService {
    /**
     * Formats a complete DigestPayload into Google Chat Markdown text
     */
    formatDigest(payload: DigestPayload): string {
        const dateStr = this.formatVietnamDate(payload.generatedAt);
        const itemCount = payload.items.length;

        const lines: string[] = [];

        // 1. Header
        lines.push(`🚀 CRYPTO INTELLIGENCE DIGEST | ${dateStr}`);
        lines.push('');
        lines.push('Bản tin chắt lọc những sự kiện Crypto, Meme và thị trường có giá trị thông tin cao nhất kể từ bản tin trước.');
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 2. Section 1: Top Stories
        lines.push('📌 1. ĐIỂM TIN QUAN TRỌNG');
        lines.push('');

        payload.items.forEach((item, index) => {
            lines.push(this.formatStoryItem(item, index + 1));
            lines.push('');
        });

        // 3. Section 2: Market Snapshot (Only if snapshot has content)
        const snapshotContent = this.formatMarketSnapshot(payload.snapshot);
        if (snapshotContent) {
            lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            lines.push('');
            lines.push('📊 2. MARKET SNAPSHOT');
            lines.push('');
            lines.push(snapshotContent);
            lines.push('');
        }

        // 4. Section 3: Trending Tokens (Only if trending tokens exist)
        if (payload.trendingTokens && payload.trendingTokens.length > 0) {
            lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            lines.push('');
            lines.push('🔥 3. TOKEN ĐANG ĐƯỢC CHÚ Ý');
            lines.push('');
            lines.push(this.formatTrendingTokens(payload.trendingTokens.slice(0, 5)));
            lines.push('');
        }

        // 5. Section 4: Macro & Regulation (Only if highlights exist)
        if (payload.macroHighlights && payload.macroHighlights.length > 0) {
            lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            lines.push('');
            lines.push('🏛️ 4. MACRO & REGULATION');
            lines.push('');
            for (const h of payload.macroHighlights) {
                lines.push(`• ${h}`);
            }
            lines.push('');
        }

        // 6. Section 5: Signals To Watch (Only if signals exist)
        if (payload.signalsToWatch && payload.signalsToWatch.length > 0) {
            lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            lines.push('');
            lines.push('👀 5. CẦN THEO DÕI');
            lines.push('');
            for (const s of payload.signalsToWatch) {
                lines.push(`• ${s}`);
            }
            lines.push('');
        }

        // 7. Footer & Disclaimer
        lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        lines.push('Dữ liệu được tổng hợp từ các nguồn chính thức và nguồn tin có độ tin cậy cao.');
        lines.push('Bản tin không cấu thành khuyến nghị đầu tư tài chính.');

        return lines.join('\n').trim();
    }

    private formatStoryItem(item: AggregatedMarketEvent, index: number): string {
        const title = item.vietnameseTitle || item.title;
        const url = item.canonicalUrl;
        const summary = item.vietnameseSummary || item.summary || item.title;

        // Sources display
        let sourcesLabel = item.sources[0]?.name || item.primaryEvent.source.name;
        if (item.sources.length > 1) {
            sourcesLabel = item.sources
                .slice(0, 3)
                .map((s) => s.name)
                .join(', ');
        }

        const credLabel = this.formatCredibilityLabel(item.rankingBreakdown?.credibilityScore ?? item.primaryEvent.source.credibilityScore);
        const verificationLabel = this.formatVerificationLabel(item.verificationStatus);

        const lines = [
            `${index}. <${url}|${title}>`,
            '',
            summary,
        ];

        if (item.whyItMattersVi) {
            lines.push('');
            lines.push('Tại sao đáng chú ý:');
            lines.push(item.whyItMattersVi);
        }

        lines.push('');
        lines.push(`Nguồn: ${sourcesLabel} (${verificationLabel})`);
        lines.push(`Độ tin cậy: ${credLabel}`);
        lines.push(`Mức ảnh hưởng: ${item.impactScore}/100`);

        if (item.wasCriticalAlerted) {
            lines.push(`⚠️ Trạng thái: [Đã phát cảnh báo khẩn cấp trước đó]`);
        }

        return lines.join('\n');
    }

    private formatMarketSnapshot(snapshot?: MarketSnapshotSection): string | null {
        if (!snapshot) {
            return null;
        }

        const parts: string[] = [];
        if (snapshot.btcContext) {
            parts.push(`• BTC: ${snapshot.btcContext}`);
        }
        if (snapshot.ethContext) {
            parts.push(`• ETH: ${snapshot.ethContext}`);
        }
        if (snapshot.solContext) {
            parts.push(`• SOL: ${snapshot.solContext}`);
        }
        if (snapshot.memeContext) {
            parts.push(`• Meme: ${snapshot.memeContext}`);
        }
        if (snapshot.macroContext) {
            parts.push(`• Macro: ${snapshot.macroContext}`);
        }

        return parts.length > 0 ? parts.join('\n') : null;
    }

    private formatTrendingTokens(tokens: DigestTrendingToken[]): string {
        const parts: string[] = [];
        tokens.forEach((t, i) => {
            const sym = t.symbol.startsWith('$') ? t.symbol : `$${t.symbol}`;
            const velocity = t.mentionChangePercent ? ` (Tốc độ đề cập 1h: +${t.mentionChangePercent}%)` : '';
            const sources = t.topSources.length > 0 ? `\nNguồn nổi bật: ${t.topSources.slice(0, 3).join(', ')}` : '';
            parts.push(`${i + 1}. ${sym} — Trend Score ${t.trendScore}/100${velocity}${sources}`);
        });
        return parts.join('\n\n');
    }

    formatCredibilityLabel(score: number): string {
        if (score >= 95) {
            return 'Chính thức / Rất cao';
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
            case VerificationStatus.CONFIRMED_PRIMARY_SOURCE: {
                return 'Nguồn chính thức';
            }
            case VerificationStatus.CONFIRMED_MULTI_SOURCE: {
                return 'Đã xác nhận từ nhiều nguồn';
            }
            case VerificationStatus.ATTRIBUTED_STATEMENT: {
                return 'Phát biểu đã xác nhận';
            }
            case VerificationStatus.OFFICIAL_SOCIAL_ONLY: {
                return 'Kênh social chính thức';
            }
            case VerificationStatus.UNVERIFIED: {
                return 'Chưa xác minh';
            }
            case VerificationStatus.DISPUTED: {
                return 'Đang tranh chấp';
            }
            default: {
                return 'Nguồn thứ cấp';
            }
        }
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
                return `${day}/${month}/${year} — ${hour}:${minute}`;
            }
            return `${day}/${month}/${year}`;
        } catch {
            return date.toISOString().slice(0, 16).replace('T', ' — ');
        }
    }
}
