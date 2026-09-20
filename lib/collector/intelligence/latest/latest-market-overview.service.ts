import type { LatestMarketIntelligenceItem, LatestMarketOverview } from '../types';

export class LatestMarketOverviewService {
    /**
     * Synthesizes a unified Market Overview from the selected Top intelligence items.
     * Guaranteed NO hallucination: strictly draws context from the supplied items.
     */
    synthesizeOverview(items: LatestMarketIntelligenceItem[]): LatestMarketOverview {
        if (!items || items.length === 0) {
            return {
                title: 'Tổng quan thị trường mới nhất',
                marketOverview: 'Hiện tại chưa ghi nhận sự kiện thị trường hoặc xúc tác nổi bật nào trong khung thời gian theo dõi.',
                overallImpactScore: 50,
                marketState: 'TRUNG_LẬP',
                mainNarratives: [],
                risks: ['Thiếu dữ liệu sự kiện mới'],
                watchNext: ['Theo dõi các bản tin kinh tế và lịch công bố dữ liệu'],
            };
        }

        // 1. Calculate weighted overall impact score
        const totalImpact = items.reduce((sum, item) => sum + (item.impactScore || 50), 0);
        const overallImpactScore = Math.round(totalImpact / items.length);

        // 2. Identify market state
        let marketState = 'TRUNG_LẬP';
        if (overallImpactScore >= 75) {
            marketState = 'TÍCH_CỰC';
        } else if (overallImpactScore <= 45) {
            marketState = 'THẬN_TRỌNG';
        }

        // 3. Extract main narratives
        const narrativesSet = new Set<string>();
        for (const item of items) {
            for (const n of item.affectedNarratives || []) {
                if (n && n.trim()) {
                    narrativesSet.add(n.trim());
                }
            }
        }
        const mainNarratives = Array.from(narrativesSet).slice(0, 5);
        if (mainNarratives.length === 0) {
            mainNarratives.push('Thanh khoản thị trường', 'Kinh tế vĩ mô');
        }

        // 4. Identify assets mentioned
        const assetsSet = new Set<string>();
        for (const item of items) {
            for (const a of item.affectedAssets || []) {
                if (a && a.trim()) {
                    assetsSet.add(a.trim().toUpperCase());
                }
            }
        }
        const mentionedAssets = Array.from(assetsSet);

        // 5. Synthesize Market Overview Paragraph
        const hasCryptoCatalyst = items.some(
            (i) =>
                i.title.toLowerCase().includes('bitcoin') ||
                i.title.toLowerCase().includes('btc') ||
                i.title.toLowerCase().includes('etf') ||
                i.title.toLowerCase().includes('sec') ||
                i.title.toLowerCase().includes('binance') ||
                i.title.toLowerCase().includes('coinbase')
        );

        const hasEnergyShock = items.some(
            (i) =>
                i.title.toLowerCase().includes('hormuz') ||
                i.title.toLowerCase().includes('dầu') ||
                i.title.toLowerCase().includes('lng') ||
                i.title.toLowerCase().includes('năng lượng')
        );

        const hasTreasuryOrDebt = items.some(
            (i) =>
                i.title.toLowerCase().includes('treasury') ||
                i.title.toLowerCase().includes('nợ ngắn hạn') ||
                i.title.toLowerCase().includes('trái phiếu')
        );

        const overviewParts: string[] = [];

        if (mainNarratives.length > 0) {
            overviewParts.push(
                `Các thông tin mới nhất tập trung vào các chủ đề chính: ${mainNarratives.join(', ')}.`
            );
        }

        if (hasTreasuryOrDebt && hasEnergyShock) {
            overviewParts.push(
                'Kỳ vọng Mỹ tăng phát hành nợ ngắn hạn có thể gây cạnh tranh thanh khoản trên thị trường tài chính, trong khi rủi ro tại khu vực Hormuz tiếp tục tạo áp lực lên thị trường năng lượng và lạm phát.'
            );
        } else if (hasTreasuryOrDebt) {
            overviewParts.push(
                'Kỳ vọng gia tăng phát hành nợ ngắn hạn từ Kho bạc Mỹ đang thu hút sự chú ý của giới đầu tư đối với thanh khoản USD trên các thị trường tài sản tài chính.'
            );
        } else if (hasEnergyShock) {
            overviewParts.push(
                'Căng thẳng địa chính trị và rủi ro gián đoạn vận chuyển năng lượng qua eo biển Hormuz làm gia tăng lo ngại lạm phát, qua đó gián tiếp tạo áp lực lên lãi suất và khẩu vị rủi ro.'
            );
        }

        if (!hasCryptoCatalyst) {
            const assetContext = mentionedAssets.length > 0 ? `đến ${mentionedAssets.slice(0, 3).join(', ')}` : 'đến thị trường crypto';
            overviewParts.push(
                `Hiện chưa xuất hiện catalyst crypto trực tiếp đủ mạnh, do đó tác động chủ yếu ${assetContext} đến từ môi trường thanh khoản vĩ mô và khẩu vị rủi ro toàn cầu.`
            );
        } else {
            overviewParts.push(
                'Các chất xúc tác nội tại của thị trường crypto tiếp tục phản ánh sự phân hóa về dòng vốn và tâm lý giữa các nhóm tài sản.'
            );
        }

        const marketOverview = overviewParts.join(' ');

        // 6. Risks and WatchNext
        const risks: string[] = [];
        if (hasEnergyShock) {
            risks.push('Rủi ro gián đoạn nguồn cung năng lượng và lạm phát tăng trở lại');
        }
        if (hasTreasuryOrDebt) {
            risks.push('Áp lực hút ròng thanh khoản USD từ việc phát hành trái phiếu chính phủ');
        }
        if (risks.length === 0) {
            risks.push('Biến động thanh khoản ngắn hạn và áp lực chốt lời');
        }

        const watchNext: string[] = [
            'Diễn biến chỉ số USD (DXY) và lợi suất trái phiếu Kho bạc Mỹ',
            'Động thái dòng tiền tổ chức và phản ứng của BTC tại các ngưỡng hỗ trợ/kháng cự then chốt',
        ];

        return {
            title: 'Tổng quan thị trường mới nhất',
            marketOverview,
            overallImpactScore,
            marketState,
            mainNarratives,
            risks,
            watchNext,
        };
    }
}
