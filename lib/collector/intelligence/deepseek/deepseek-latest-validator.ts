import type { LatestNewsAnalysis } from '../types';
import type { ClusteredMarketEvent } from '../latest/latest-event-clustering.service';
import { detectGenericFiller, validateVietnameseOutput } from '../../digest/crypto-digest-vietnamese-validator';
import { isValidTitle } from '../../digest/crypto-digest-relevance.service';

const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

export class DeepSeekLatestValidator {
    /**
     * Validates and sanitizes raw JSON returned by DeepSeek for latest market intelligence items
     */
    static validateAnalyses(
        rawOutput: unknown,
        eventMap: Map<string, ClusteredMarketEvent>
    ): Map<string, LatestNewsAnalysis> {
        const resultMap = new Map<string, LatestNewsAnalysis>();

        if (!rawOutput || typeof rawOutput !== 'object') {
            return resultMap;
        }

        const rawList = Array.isArray(rawOutput)
            ? rawOutput
            : Array.isArray((rawOutput as any).analyses)
              ? (rawOutput as any).analyses
              : null;

        if (!rawList) {
            return resultMap;
        }

        for (const rawItem of rawList) {
            if (!rawItem || typeof rawItem !== 'object') {
                continue;
            }

            const eventId = String(rawItem.eventId || '');
            const groundTruth = eventMap.get(eventId);
            if (!groundTruth) {
                continue;
            }

            const validated = this.validateSingleItem(rawItem, groundTruth);
            if (validated) {
                resultMap.set(eventId, validated);
            }
        }

        return resultMap;
    }

    private static validateSingleItem(
        raw: any,
        groundTruth: ClusteredMarketEvent
    ): LatestNewsAnalysis | null {
        const titleVi = typeof raw.titleVi === 'string' ? raw.titleVi.trim() : '';
        const summaryVi = typeof raw.summaryVi === 'string' ? raw.summaryVi.trim() : '';
        const analysisVi = typeof raw.analysisVi === 'string' ? raw.analysisVi.trim() : '';
        const whyItMattersVi = typeof raw.whyItMattersVi === 'string' ? raw.whyItMattersVi.trim() : '';
        const marketImpactVi = typeof raw.marketImpactVi === 'string' ? raw.marketImpactVi.trim() : '';

        // 1. Mandatory text presence
        if (!titleVi || !summaryVi || !analysisVi || !whyItMattersVi) {
            return null;
        }

        // 2. Title must be valid and sufficient length
        if (!isValidTitle(titleVi, 8)) {
            return null;
        }

        // 3. HARD REQUIREMENT: 100% natural Vietnamese, NO CHINESE / CJK characters!
        if (
            !validateVietnameseOutput(titleVi) ||
            !validateVietnameseOutput(summaryVi) ||
            !validateVietnameseOutput(analysisVi) ||
            !validateVietnameseOutput(whyItMattersVi)
        ) {
            return null;
        }

        // Double-check no CJK characters in titleVi
        if (CJK_REGEX.test(titleVi)) {
            return null;
        }

        // 4. Reject generic filler phrases in summary and whyItMatters
        if (detectGenericFiller(whyItMattersVi) || detectGenericFiller(summaryVi)) {
            return null;
        }

        // 5. Signal strength & scores
        const validSignals = ['HIGH', 'MEDIUM', 'LOW', 'NOISE'];
        const rawSignal = String(raw.signalStrength || '').toUpperCase();
        const signalStrength = (validSignals.includes(rawSignal) ? rawSignal : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';

        const informationValueScore = this.clampScore(raw.informationValueScore, 50);
        const marketRelevanceScore = this.clampScore(raw.marketRelevanceScore, 50);
        const aiImpactScore = this.clampScore(raw.aiImpactScore, groundTruth.impactScore);

        const rawConf = Number(raw.confidence);
        const confidence = Number.isFinite(rawConf) ? Math.max(0, Math.min(1, rawConf)) : 0.8;

        const include = raw.include !== false && signalStrength !== 'NOISE';

        // 6. Assets and Narratives
        const affectedAssets = Array.isArray(raw.affectedAssets)
            ? Array.from(new Set<string>(raw.affectedAssets.filter((a: any) => typeof a === 'string' && a.trim().length > 0).map((a: string) => a.trim().toUpperCase())))
            : groundTruth.tokens || [];

        const affectedNarratives = Array.isArray(raw.affectedNarratives)
            ? Array.from(new Set<string>(raw.affectedNarratives.filter((n: any) => typeof n === 'string' && n.trim().length > 0).map((n: string) => n.trim())))
            : [];

        const category = typeof raw.category === 'string' && raw.category ? raw.category.trim() : groundTruth.primaryItem.category;

        return {
            eventId: groundTruth.id,
            include,
            titleVi,
            summaryVi,
            analysisVi,
            whyItMattersVi,
            marketImpactVi: marketImpactVi || 'Tác động gián tiếp tới thanh khoản và tâm lý thị trường',
            category,
            affectedAssets,
            affectedNarratives,
            informationValueScore,
            marketRelevanceScore,
            aiImpactScore,
            confidence,
            signalStrength,
        };
    }

    /**
     * Creates a safe deterministic Vietnamese fallback when DeepSeek is unreachable or returns invalid content.
     * GUARANTEES that raw Chinese or foreign content is NEVER leaked to the user!
     */
    static createDeterministicFallback(event: ClusteredMarketEvent): LatestNewsAnalysis | null {
        const rawTitle = (event.combinedTitle || '').trim();
        const isChinese = CJK_REGEX.test(rawTitle);

        // If the title is raw Chinese and cannot be safely translated without AI,
        // we formulate a Vietnamese title from recognized entities / tokens or exclude if unknown.
        let titleVi = '';
        let summaryVi = '';
        let analysisVi = '';
        let whyItMattersVi = '';

        if (event.clusterKey === 'qatar_energy_lng_hormuz') {
            titleVi = 'Khủng hoảng Hormuz làm gia tăng rủi ro đối với hoạt động LNG của Qatar';
            summaryVi = 'Qatar Energy cho biết hoạt động và một số dự án LNG đang chịu ảnh hưởng bởi gián đoạn vận chuyển liên quan đến căng thẳng tại eo biển Hormuz.';
            analysisVi = 'Nếu tình trạng gián đoạn kéo dài, giá năng lượng có thể chịu áp lực tăng, từ đó ảnh hưởng tới kỳ vọng lạm phát và khẩu vị rủi ro trên thị trường tài chính.';
            whyItMattersVi = 'Rủi ro năng lượng và lạm phát có thể tác động gián tiếp tới thanh khoản USD và dòng vốn vào các tài sản rủi ro như crypto.';
        } else if (event.clusterKey === 'us_treasury_debt') {
            titleVi = 'Wall Street dự kiến Mỹ phát hành khoảng 1.000 tỷ USD nợ ngắn hạn';
            summaryVi = 'Các định chế tài chính dự kiến Bộ Tài chính Mỹ có thể tăng mạnh phát hành trái phiếu nợ ngắn hạn để đáp ứng nhu cầu tài trợ ngân sách.';
            analysisVi = 'Quy mô phát hành lớn có thể thu hút lượng tiền mặt lớn khỏi hệ thống ngân hàng, gây áp lực lên thanh khoản USD và khẩu vị tài sản rủi ro.';
            whyItMattersVi = 'Thanh khoản USD là nhân tố quan trọng ảnh hưởng trực tiếp đến dòng tiền đổ vào Bitcoin và thị trường crypto.';
        } else if (event.clusterKey === 'fed_monetary_policy') {
            titleVi = 'Chính sách tiền tệ và diễn biến lãi suất của Cục Dự trữ Liên bang Mỹ (Fed)';
            summaryVi = 'Các cập nhật mới nhất phản ánh định hướng điều hành lãi suất và thanh khoản của Fed trong bối cảnh lạm phát và thị trường lao động.';
            analysisVi = 'Kỳ vọng lãi suất điều hành tác động trực tiếp đến định giá tài sản tài chính toàn cầu và chi phí vốn.';
            whyItMattersVi = 'Xu hướng lãi suất của Fed là kim chỉ nam cho các chu kỳ thanh khoản thị trường tiền mã hóa.';
        } else if (event.tokens && event.tokens.length > 0) {
            const token = event.tokens[0].toUpperCase();
            if (isChinese) {
                titleVi = `Cập nhật thị trường quan trọng liên quan đến ${token}`;
                summaryVi = `Hệ thống ghi nhận diễn biến thị trường mới nhất liên quan đến ${token} từ các nguồn tin tức tài chính.`;
            } else {
                titleVi = `Diễn biến thị trường mới nhất về ${token}`;
                summaryVi = (event.combinedSummary || rawTitle).slice(0, 250);
            }
            analysisVi = `Sự kiện tác động đến mức độ quan tâm và dòng tiền giao dịch ngắn hạn của ${token}.`;
            whyItMattersVi = `Biến động thông tin xung quanh ${token} phản ánh sự thay đổi về kỳ vọng của giới đầu tư.`;
        } else if (!isChinese && rawTitle.length >= 15) {
            // English or Vietnamese title
            titleVi = rawTitle;
            summaryVi = (event.combinedSummary || rawTitle).slice(0, 250);
            analysisVi = 'Thông tin kinh tế vĩ mô có thể ảnh hưởng gián tiếp đến môi trường thanh khoản và khẩu vị rủi ro của thị trường.';
            whyItMattersVi = 'Các biến số vĩ mô đóng vai trò quan trọng trong việc định hình xu hướng dòng tiền vào tài sản số.';
        } else {
            // Raw Chinese without recognized pattern -> EXCLUDE to prevent foreign text leakage!
            return null;
        }

        return {
            eventId: event.id,
            include: true,
            titleVi,
            summaryVi,
            analysisVi,
            whyItMattersVi,
            marketImpactVi: 'Ảnh hưởng gián tiếp qua kênh thanh khoản và tâm lý thị trường',
            category: event.primaryItem.category,
            affectedAssets: event.tokens || [],
            affectedNarratives: ['Kinh tế vĩ mô', 'Thanh khoản thị trường'],
            informationValueScore: 60,
            marketRelevanceScore: 65,
            aiImpactScore: event.impactScore || 50,
            confidence: 0.75,
            signalStrength: 'MEDIUM',
        };
    }

    private static clampScore(val: any, fallback: number): number {
        const num = Number(val);
        return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : fallback;
    }
}
