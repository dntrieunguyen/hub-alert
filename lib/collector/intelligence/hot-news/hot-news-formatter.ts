import { VerificationStatus } from '../../types';
import type { MarketEvent } from '../../notifications/types';
import type { AiNewsAnalysis } from '../types';

export class HotNewsFormatter {
    /**
     * Formats an immediate Hot News Alert for Google Chat
     */
    static formatAlert(event: MarketEvent, analysis: AiNewsAnalysis): string {
        const titleVi = analysis.titleVi || event.title;
        const summaryVi = analysis.summaryVi || event.summary || event.title;
        const whyItMattersVi = analysis.whyItMattersVi || 'Sự kiện có khả năng tạo biến động lớn về thanh khoản và dòng tiền trên thị trường.';

        // Why it matters bullet points
        const points = analysis.keyFacts && analysis.keyFacts.length > 0
            ? analysis.keyFacts.slice(0, 3).map((f) => `• ${f}`).join('\n')
            : `• ${whyItMattersVi}`;

        // Assets and narratives
        const assets = analysis.affectedAssets.length > 0
            ? analysis.affectedAssets.map((a) => (a.startsWith('$') ? a : `$${a}`)).join(', ')
            : event.tokens.length > 0
              ? event.tokens.map((t) => `$${t}`).join(', ')
              : 'Toàn thị trường';

        const narrative = analysis.affectedNarratives[0] || event.eventType.replace(/_/g, ' ');
        const verifLabel = this.formatVerificationLabel(event.verificationStatus);

        const lines = [
            '🚨 TIN NÓNG — CRYPTO INTELLIGENCE',
            '',
            titleVi,
            '',
            summaryVi,
            '',
            '📌 Tại sao đáng chú ý',
            points,
            '',
            '🎯 Liên quan',
            `${assets} • ${narrative}`,
            '',
            '📊 Mức ảnh hưởng',
            `${event.impactScore}/100`,
            '',
            '✅ Xác minh',
            `${verifLabel} (${event.source.name})`,
            '',
            `🔗 ${event.url}`,
        ];

        return lines.join('\n');
    }

    private static formatVerificationLabel(status: VerificationStatus): string {
        switch (status) {
            case VerificationStatus.CONFIRMED_PRIMARY_SOURCE: {
                return 'Nguồn chính thức';
            }
            case VerificationStatus.CONFIRMED_MULTI_SOURCE: {
                return 'Xác nhận từ nhiều nguồn độc lập';
            }
            case VerificationStatus.ATTRIBUTED_STATEMENT: {
                return 'Phát biểu chính thức (không phải luật ban hành)';
            }
            case VerificationStatus.OFFICIAL_SOCIAL_ONLY: {
                return 'Kênh mạng xã hội chính thức';
            }
            default: {
                return 'Nguồn tin cậy cao';
            }
        }
    }
}
