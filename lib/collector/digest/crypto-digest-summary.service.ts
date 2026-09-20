import { MarketEventType } from '../notifications/types';
import type { AggregatedMarketEvent } from './types';
import { validateVietnameseOutput, detectGenericFiller } from './crypto-digest-vietnamese-validator';
import { isValidTitle } from './crypto-digest-relevance.service';

export class CryptoDigestSummaryService {
    /**
     * Generates a 1-3 sentence Vietnamese summary answering:
     * 1. Chuyện gì xảy ra?
     * 2. Tại sao đáng chú ý?
     * 3. Có thể ảnh hưởng tới tài sản / thị trường nào?
     */
    generateVietnameseSummary(event: AggregatedMarketEvent): { title: string; summary: string; whyItMatters?: string } {
        if (event.aiAnalysis) {
            let title = event.aiAnalysis.titleVi;
            if (!title || !isValidTitle(title) || !validateVietnameseOutput(title)) {
                title = this.generateVietnameseTitle(event);
            }

            let summary = event.aiAnalysis.summaryVi;
            if (!summary || !validateVietnameseOutput(summary) || detectGenericFiller(summary)) {
                summary = this.buildDeterministicSummary(event);
            }

            let whyItMatters = event.aiAnalysis.whyItMattersVi;
            if (!whyItMatters || !validateVietnameseOutput(whyItMatters) || detectGenericFiller(whyItMatters)) {
                whyItMatters = this.buildDeterministicWhyItMatters(event);
            }

            return { title, summary, whyItMatters };
        }

        const title = this.generateVietnameseTitle(event);
        const summary = this.buildDeterministicSummary(event);
        const whyItMatters = this.buildDeterministicWhyItMatters(event);
        return { title, summary, whyItMatters };
    }

    private buildDeterministicWhyItMatters(event: AggregatedMarketEvent): string {
        const tokenLabel = event.symbols[0] || (event.tokens[0] ? `$${event.tokens[0]}` : '');
        switch (event.eventType) {
            case MarketEventType.CENTRAL_BANK_DECISION:
            case MarketEventType.MACRO_DATA:
                return 'Ảnh hưởng trực tiếp tới kỳ vọng thanh khoản, định giá USD và các tài sản rủi ro như BTC, ETH.';
            case MarketEventType.EXCHANGE_LISTING:
            case MarketEventType.BROKER_LISTING:
                return 'Tăng khả năng tiếp cận và thanh khoản thực tế cho token, mở rộng tệp nhà đầu tư tham gia.';
            case MarketEventType.ETF:
                return 'Mở rộng khả năng tiếp cận của các định chế tài chính và ảnh hưởng tới thanh khoản của tài sản cơ sở.';
            case MarketEventType.REGULATION:
            case MarketEventType.GOVERNMENT_POLICY:
                return 'Tác động tới khuôn khổ pháp lý, cấp phép hoạt động và tính minh bạch dài hạn của ngành.';
            case MarketEventType.SECURITY_INCIDENT:
                return 'Nguy cơ thất thoát tài sản, lỗ hổng hợp đồng thông minh và rủi ro dây chuyền đối với hệ sinh thái.';
            default:
                return `Cung cấp thêm dữ liệu xác thực về hoạt động thực tế của ${tokenLabel || 'dự án'} trên thị trường.`;
        }
    }

    /**
     * Generates a concise Vietnamese headline
     */
    generateVietnameseTitle(event: AggregatedMarketEvent): string {
        const tokenStr = event.symbols[0] || (event.tokens[0] ? `$${event.tokens[0]}` : '');
        const primarySource = event.sources[0]?.name || event.primaryEvent.source.name;

        switch (event.eventType) {
            case MarketEventType.EXCHANGE_LISTING: {
                if (tokenStr) {
                    return `${primarySource} thông báo niêm yết ${tokenStr}`;
                }
                return `${primarySource} công bố niêm yết tài sản mới`;
            }
            case MarketEventType.BROKER_LISTING: {
                if (tokenStr) {
                    return `${primarySource} mở giao dịch cho ${tokenStr}`;
                }
                return `${primarySource} bổ sung tài sản crypto mới`;
            }
            case MarketEventType.EXCHANGE_DELISTING: {
                if (tokenStr) {
                    return `${primarySource} thông báo hủy niêm yết ${tokenStr}`;
                }
                return `${primarySource} công bố hủy niêm yết tài sản`;
            }
            case MarketEventType.CENTRAL_BANK_DECISION: {
                return `${primarySource} công bố quyết định lãi suất và chính sách tiền tệ`;
            }
            case MarketEventType.MACRO_DATA: {
                return 'Dữ liệu vĩ mô mới được công bố, ảnh hưởng kỳ vọng thị trường';
            }
            case MarketEventType.ETF: {
                if (tokenStr) {
                    return `Cập nhật tiến trình ETF liên quan đến ${tokenStr}`;
                }
                return 'Thông tin mới về các quỹ ETF crypto được nộp lên cơ quan quản lý';
            }
            case MarketEventType.REGULATION:
            case MarketEventType.GOVERNMENT_POLICY: {
                return `${primarySource} công bố quy định và định hướng chính sách crypto`;
            }
            case MarketEventType.SECURITY_INCIDENT: {
                if (tokenStr) {
                    return `Cảnh báo sự cố bảo mật liên quan đến hệ sinh thái ${tokenStr}`;
                }
                return 'Phát hiện sự cố bảo mật / khai thác lỗ hổng nghiêm trọng';
            }
            case MarketEventType.NETWORK_INCIDENT: {
                if (tokenStr) {
                    return `Sự cố mạng lưới / gián đoạn hoạt động trên blockchain ${tokenStr}`;
                }
                return 'Ghi nhận sự cố gián đoạn hoạt động mạng lưới blockchain';
            }
            case MarketEventType.MEME_TREND: {
                if (tokenStr) {
                    return `Đột biến mức độ chú ý và thanh khoản đối với ${tokenStr}`;
                }
                return 'Ghi nhận xu hướng thảo luận tăng vọt trong nhóm memecoin';
            }
            default: {
                // Return clean translated title
                return this.translateOrSanitizeTitle(event.title, tokenStr);
            }
        }
    }

    private buildDeterministicSummary(event: AggregatedMarketEvent): string {
        const tokenLabel = event.symbols[0] || (event.tokens[0] ? `$${event.tokens[0]}` : '');
        const allTokens = event.tokens.length > 0 ? event.tokens.join(', ') : 'thị trường crypto';
        const primarySource = event.sources[0]?.name || event.primaryEvent.source.name;
        const sourceConfirmText =
            event.sourceCount > 1
                ? `Thông tin đã được ghi nhận và xác nhận qua ${event.sourceCount} nguồn độc lập (bao gồm ${event.sources.map((s) => s.name).slice(0, 3).join(', ')}).`
                : `Thông tin được phát đi từ ${primarySource}.`;

        switch (event.eventType) {
            case MarketEventType.EXCHANGE_LISTING:
            case MarketEventType.BROKER_LISTING: {
                const action = event.eventType === MarketEventType.BROKER_LISTING ? 'hỗ trợ giao dịch' : 'niêm yết';
                const s1 = `${primarySource} chính thức xác nhận ${action} ${tokenLabel || 'tài sản mới'}.`;
                const s2 = `Đây là tín hiệu quan trọng giúp mở rộng thanh khoản và tăng mạnh độ phủ sóng tới nhóm nhà đầu tư tổ chức lẫn cá nhân.`;
                const s3 = `Sự kiện có tác động trực tiếp tới biến động giá và khối lượng giao dịch của ${tokenLabel || allTokens}.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.EXCHANGE_DELISTING: {
                const s1 = `${primarySource} thông báo kế hoạch loại bỏ ${tokenLabel || 'tài sản'} khỏi danh sách giao dịch.`;
                const s2 = `Quyết định này có thể làm giảm mạnh tính thanh khoản và gây áp lực rút vốn đối với người nắm giữ.`;
                const s3 = `Sự kiện ảnh hưởng tiêu cực ngắn hạn tới ${tokenLabel || allTokens}.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.CENTRAL_BANK_DECISION: {
                const s1 = `Federal Reserve và các ngân hàng trung ương đưa ra thông báo về định hướng lãi suất và kiểm soát lạm phát.`;
                const s2 = `Đây là dữ liệu vĩ mô cốt lõi chi phối khẩu vị rủi ro và dòng tiền trên toàn bộ thị trường tài chính.`;
                const s3 = `Quyết định tác động trực tiếp tới sức mạnh đồng USD, lợi suất trái phiếu và các tài sản rủi ro như BTC, ETH và thị trường chứng khoán.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.MACRO_DATA: {
                const s1 = `Báo cáo số liệu kinh tế vĩ mô (CPI / việc làm / GDP) vừa được công bố.`;
                const s2 = `Số liệu thực tế so với kỳ vọng sẽ tái định hình dự báo về lộ trình cắt giảm hoặc tăng lãi suất tiếp theo.`;
                const s3 = `Thông tin có thể gây ra biến động thanh lý lớn trên các cặp giao dịch chính như BTC và ETH.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.ETF: {
                const s1 = `Cơ quan quản lý và các quỹ phát hành công bố diễn biến mới về hồ sơ ETF crypto.`;
                const s2 = `Tiến trình phê duyệt hoặc điều chỉnh cơ chế giao dịch mở đường cho dòng vốn từ các quỹ đầu tư tổ chức tham gia trực tiếp.`;
                const s3 = `Diễn biến này tác động rõ rệt tới thanh khoản và cơ cấu nhà đầu tư của ${tokenLabel || 'BTC, ETH'}.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.REGULATION:
            case MarketEventType.GOVERNMENT_POLICY: {
                const s1 = `Cơ quan quản lý công bố khung chính sách hoặc biện pháp giám sát mới áp dụng cho hệ sinh thái tài sản số.`;
                const s2 = `Động thái này thiết lập tiền lệ pháp lý quan trọng và làm rõ tiêu chuẩn hoạt động của các tổ chức tài chính.`;
                const s3 = `Ảnh hưởng sâu rộng tới hoạt động của các sàn giao dịch, các tổ chức phát hành stablecoin và các dự án liên quan (${allTokens}).`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.SECURITY_INCIDENT: {
                const s1 = `Hệ thống ghi nhận sự cố bảo mật hoặc dấu hiệu tấn công khai thác lỗ hổng nhắm vào giao thức / nền tảng.`;
                const s2 = `Vụ việc tiềm ẩn nguy cơ thất thoát tài sản và làm suy giảm niềm tin vào tính an toàn của dự án.`;
                const s3 = `Người dùng nắm giữ ${tokenLabel || allTokens} cần chú ý theo dõi cảnh báo thu hồi phê duyệt hợp đồng thông minh.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.NETWORK_INCIDENT: {
                const s1 = `Mạng lưới blockchain ghi nhận tình trạng gián đoạn xử lý giao dịch hoặc chậm trễ khối.`;
                const s2 = `Đội ngũ phát triển đang phối hợp với các validator để xác định nguyên nhân và tái khởi động hệ thống.`;
                const s3 = `Sự cố có thể làm đóng băng tạm thời hoạt động nạp rút trên các sàn đối với ${tokenLabel || allTokens}.`;
                return `${s1} ${s2} ${s3}`;
            }

            case MarketEventType.MEME_TREND: {
                const s1 = `${tokenLabel || 'Token'} ghi nhận sự gia tăng đột biến về lượng thảo luận và thanh khoản giao dịch trong thời gian ngắn.`;
                const s2 = `Tín hiệu phản ánh dòng tiền đầu cơ retail đang tập trung cao độ vào nhóm tài sản này.`;
                const s3 = `Cần hết sức thận trọng trước rủi ro biến động giá hai chiều với biên độ cực lớn đối với ${tokenLabel || 'memecoin'}.`;
                return `${s1} ${s2} ${s3}`;
            }

            default: {
                // Fallback for general crypto news
                const originalSnippet = event.summary || event.title;
                const cleanSnippet = originalSnippet.replace(/<[^>]*>?/gm, '').slice(0, 160);
                const s1 = `${cleanSnippet}.`;
                const s2 = `${sourceConfirmText}`;
                const s3 = `Thông tin cung cấp thêm dữ liệu quan trọng cho các nhà phân tích theo dõi diễn biến của ${allTokens}.`;
                return `${s1} ${s2} ${s3}`;
            }
        }
    }

    private translateOrSanitizeTitle(rawTitle: string, tokenStr: string): string {
        const clean = rawTitle.replace(/<[^>]*>?/gm, '').trim();
        // Remove trailing url or author signatures
        const firstLine = clean.split('\n')[0] || clean;
        return firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
    }
}
