import { CryptoDigestSummaryService } from './crypto-digest-summary.service';
import type {
    AggregatedMarketEvent,
    DigestPayload,
    MarketIntelligenceAnalysis,
} from './types';
import { VerificationStatus } from '../types';

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export class CryptoDigestFormatterService {
    private summaryService = new CryptoDigestSummaryService();

    /**
     * Formats a complete DigestPayload into the AI Crypto Market Intelligence Brief
     * strictly following Sections 18, 19, 20, 24, 25 of the specification.
     */
    formatDigest(payload: DigestPayload): string {
        const dateStr = this.formatVietnamDate(payload.generatedAt);
        const itemCount = payload.items.length;

        // Ensure Market Intelligence Analysis is present; fallback to deterministic engine if not provided
        const intel: MarketIntelligenceAnalysis =
            payload.marketIntelligence ?? this.summaryService.synthesizeDeterministicMarketIntelligence(payload.items);

        const lines: string[] = [];

        // 1. Header (Section 18 & 24)
        lines.push('🚀 CRYPTO MARKET INTELLIGENCE');
        lines.push(`🕒 ${dateStr}`);
        lines.push('');
        lines.push(`Phân tích tổng hợp từ ${itemCount} nguồn tin mới nhất và đáng chú ý.`);
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 2. Tóm tắt thị trường (Section 18)
        lines.push('🧭 TÓM TẮT THỊ TRƯỜNG');
        lines.push('');
        lines.push(intel.summaryVi);
        lines.push('');
        lines.push('🌡️ Trạng thái:');
        if (intel.marketState.btc) {
            lines.push(`BTC: ${intel.marketState.btc}`);
        }
        if (intel.marketState.eth) {
            lines.push(`ETH: ${intel.marketState.eth}`);
        }
        if (intel.marketState.altcoin) {
            lines.push(`Altcoin: ${intel.marketState.altcoin}`);
        }
        if (intel.marketState.meme) {
            lines.push(`Meme: ${intel.marketState.meme}`);
        }
        lines.push('');
        const overallScore = intel.overallImpactScore;
        const overallLabel = this.formatOverallImpactLabel(overallScore);
        lines.push('📊 Mức ảnh hưởng tổng hợp:');
        lines.push(`${overallScore}/100 — ${overallLabel}`);
        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 3. Narrative chính (Section 5 & 18)
        const narrativeCount = intel.narratives.length;
        lines.push(`🔥 ${narrativeCount} NARRATIVE CHÍNH`);
        lines.push('');

        intel.narratives.forEach((n, idx) => {
            const emoji = idx < NUMBER_EMOJIS.length ? NUMBER_EMOJIS[idx] : `${idx + 1}️⃣`;
            lines.push(`${emoji} ${n.titleVi}`);
            lines.push('');
            lines.push(n.summaryVi);
            if (idx < intel.narratives.length - 1) {
                lines.push('');
                lines.push('');
            }
        });

        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 4. Asset-level analysis (Section 9 & 18)
        if (intel.assetAnalysis && intel.assetAnalysis.length > 0) {
            intel.assetAnalysis.forEach((a, idx) => {
                const assetUpper = a.asset.toUpperCase();
                let assetHeader: string;
                switch (assetUpper) {
                    case 'BTC':
                        assetHeader = `₿ BTC — ${a.outlook}`;
                        break;
                    case 'ETH':
                        assetHeader = `Ξ ETH — ${a.outlook}`;
                        break;
                    case 'ALTCOIN':
                        assetHeader = `🪙 ALTCOIN — ${a.outlook}`;
                        break;
                    case 'MEME':
                        assetHeader = `🐸 MEME — ${a.outlook}`;
                        break;
                    default:
                        assetHeader = `${assetUpper} — ${a.outlook}`;
                        break;
                }

                lines.push(assetHeader);
                lines.push('');
                for (const sig of a.signalsVi) {
                    lines.push(`• ${sig}`);
                }
                lines.push('');
                lines.push('→ Tín hiệu chính:');
                lines.push(a.summaryVi);

                if (idx < intel.assetAnalysis.length - 1) {
                    lines.push('');
                    lines.push('');
                }
            });
            lines.push('');
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
        }

        // 5. Institutional flows (Section 10 & 18)
        if (intel.institutionalFlowVi) {
            lines.push('🏦 DÒNG TIỀN TỔ CHỨC');
            lines.push('');
            lines.push(intel.institutionalFlowVi);
            lines.push('');
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
        }

        // 6. Regulation (Section 11 & 18)
        if (intel.regulationVi) {
            lines.push('🏛️ PHÁP LÝ & THỊ TRƯỜNG');
            lines.push('');
            lines.push(intel.regulationVi);
            lines.push('');
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
        }

        // 7. Catalysts (Section 14 & 18)
        if (intel.catalystsVi && intel.catalystsVi.length > 0) {
            lines.push('🚀 CATALYST ĐÁNG CHÚ Ý');
            lines.push('');
            for (const c of intel.catalystsVi) {
                lines.push(`• ${c}`);
            }
            lines.push('');
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
        }

        // 8. Key risks (Section 15 & 18)
        if (intel.risksVi && intel.risksVi.length > 0) {
            lines.push('⚠️ RỦI RO');
            lines.push('');
            for (const r of intel.risksVi) {
                lines.push(`• ${r}`);
            }
            lines.push('');
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
        }

        // 9. Things to watch (Section 16 & 18)
        if (intel.watchNextVi && intel.watchNextVi.length > 0) {
            lines.push('👀 CẦN THEO DÕI');
            lines.push('');
            for (const w of intel.watchNextVi) {
                lines.push(`• ${w}`);
            }
            lines.push('');
            lines.push('━━━━━━━━━━━━━━━━━━');
            lines.push('');
        }

        // 10. Sources Appendix (Section 19: max 1 line / source)
        lines.push('📰 NGUỒN THAM CHIẾU');
        lines.push('');
        const usedSet = new Set(intel.usedEventIds || payload.items.map((i) => i.id));
        const relevantItems = payload.items.filter((i) => usedSet.has(i.id));
        const itemsToDisplay = relevantItems.length > 0 ? relevantItems : payload.items;

        itemsToDisplay.slice(0, 10).forEach((item, idx) => {
            const sourceName = item.sources[0]?.name || item.primaryEvent.source.name;
            const topicOrTitle = this.formatSourceTopic(item);
            const line = `${idx + 1}. ${sourceName} — ${topicOrTitle}`;
            lines.push(line);
        });

        lines.push('');
        lines.push('━━━━━━━━━━━━━━━━━━');
        lines.push('');

        // 11. Footer / Confidence (Section 17 & 18)
        const confidenceScore = intel.analysisConfidence;
        const confidenceLabel = this.formatConfidenceLabel(confidenceScore);
        lines.push(`📊 Độ tin cậy phân tích: ${confidenceScore}/100 — ${confidenceLabel}`);
        lines.push('');
        lines.push('Thông tin nhằm hỗ trợ theo dõi thị trường,');
        lines.push('không phải khuyến nghị đầu tư.');

        return lines.join('\n').trim();
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
        const sum = items.reduce((acc, item) => acc + item.impactScore, 0);
        const avg = sum / items.length;
        const highImpactCount = items.filter((i) => i.impactScore >= 75).length;
        const bonus = Math.min(10, highImpactCount * 2);
        return Math.min(100, Math.max(0, Math.round(avg + bonus)));
    }

    formatOverallImpactLabel(score: number): string {
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

    formatConfidenceLabel(score: number): string {
        if (score >= 85) {
            return 'Cao';
        }
        if (score >= 70) {
            return 'Khá';
        }
        if (score >= 50) {
            return 'Trung bình';
        }
        return 'Thấp';
    }

    private formatSourceTopic(item: AggregatedMarketEvent): string {
        if (item.vietnameseTitle) {
            return item.vietnameseTitle;
        }
        if (item.title) {
            return item.title;
        }
        return item.category || 'Tin thị trường';
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
