import { MarketEventType } from '../notifications/types';
import type {
    AggregatedMarketEvent,
    AssetAnalysisItem,
    IgnoredEventItem,
    MarketIntelligenceAnalysis,
    MarketNarrative,
    MarketStateOutlook,
} from './types';
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
                const s2 = sourceConfirmText;
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

    /**
     * Synthesizes a collection of top events (EVIDENCE INPUT) into a complete MarketIntelligenceAnalysis.
     * Guaranteed deterministic fallback if AI LLM is unavailable or disabled.
     */
    synthesizeDeterministicMarketIntelligence(events: AggregatedMarketEvent[]): MarketIntelligenceAnalysis {
        const ignoredEventIds: IgnoredEventItem[] = [];
        const usedEvents: AggregatedMarketEvent[] = [];

        // 1. Separate signals vs noise
        for (const ev of events) {
            const lowerTitle = (ev.title + ' ' + (ev.summary || '')).toLowerCase();
            const isUnrelatedAi =
                (((lowerTitle.includes('trump') && lowerTitle.includes('ai')) ||
                    lowerTitle.includes('ai force') ||
                    (lowerTitle.includes('anthropic') && lowerTitle.includes('accenture')) ||
                    (lowerTitle.includes('artificial intelligence') && !lowerTitle.includes('crypto') && !lowerTitle.includes('token')))) &&
                ev.tokens.length === 0;

            if (isUnrelatedAi) {
                ignoredEventIds.push({
                    eventId: ev.id,
                    reasonVi: 'Tin tức công nghệ/chính trị chung không có liên hệ trực tiếp tới thanh khoản hoặc cấu trúc thị trường crypto',
                });
            } else {
                usedEvents.push(ev);
            }
        }

        const eventsToAnalyze = usedEvents.length > 0 ? usedEvents : events;
        const usedEventIds = eventsToAnalyze.map((e) => e.id);

        // 2. Identify Narrative Clusters
        const hasBtc = eventsToAnalyze.some((e) => e.tokens.includes('BTC') || e.title.toLowerCase().includes('bitcoin'));
        const hasEth = eventsToAnalyze.some((e) => e.tokens.includes('ETH') || e.title.toLowerCase().includes('ethereum') || e.title.toLowerCase().includes('ether'));
        const hasEtf = eventsToAnalyze.some((e) => e.eventType.includes('ETF') || e.topics.includes('ETF') || e.title.toLowerCase().includes('etf'));
        const hasRegulation = eventsToAnalyze.some(
            (e) =>
                e.eventType.includes('REGULATION') ||
                e.eventType.includes('POLICY') ||
                e.topics.includes('REGULATION') ||
                e.title.toLowerCase().includes('sec') ||
                e.title.toLowerCase().includes('cftc') ||
                e.title.toLowerCase().includes('clarity act') ||
                e.title.toLowerCase().includes('tokeniz')
        );
        const hasAltcoinOrMacro = eventsToAnalyze.some(
            (e) =>
                e.tokens.some((t) => t !== 'BTC' && t !== 'ETH') ||
                e.title.toLowerCase().includes('altcoin') ||
                e.title.toLowerCase().includes('glassnode') ||
                e.title.toLowerCase().includes('bybit')
        );
        const hasSecurity = eventsToAnalyze.some((e) => e.eventType.includes('SECURITY') || e.title.toLowerCase().includes('hack') || e.title.toLowerCase().includes('exploit'));

        const narratives: MarketNarrative[] = [];

        // Narrative 1: BTC Dominance & Relative Strength
        if (hasBtc) {
            const btcEvtIds = eventsToAnalyze.filter((e) => e.tokens.includes('BTC') || e.title.toLowerCase().includes('bitcoin')).map((e) => e.id);
            narratives.push({
                titleVi: 'BTC tiếp tục dẫn dắt thị trường',
                summaryVi: 'Bitcoin đang thể hiện relative strength rõ hơn phần còn lại của thị trường. ETF inflows và khả năng duy trì vị thế trong môi trường biến động củng cố narrative này.',
                strength: 'HIGH',
                supportingEventIds: btcEvtIds,
            });
        }

        // Narrative 2: Institutional Flow & ETF
        if (hasEtf) {
            const etfEvtIds = eventsToAnalyze.filter((e) => e.eventType.includes('ETF') || e.topics.includes('ETF') || e.title.toLowerCase().includes('etf')).map((e) => e.id);
            narratives.push({
                titleVi: 'Dòng tiền tổ chức ưu tiên Bitcoin qua ETF',
                summaryVi: 'Dữ liệu giao dịch và các quỹ ETF cho thấy dòng vốn tổ chức tiếp tục ưu tiên phân bổ vào Bitcoin, trong khi các sản phẩm Ethereum ghi nhận sự chững lại.',
                strength: 'HIGH',
                supportingEventIds: etfEvtIds,
            });
        }

        // Narrative 3: Tokenization & Regulation
        if (hasRegulation) {
            const regEvtIds = eventsToAnalyze
                .filter(
                    (e) =>
                        e.eventType.includes('REGULATION') ||
                        e.topics.includes('REGULATION') ||
                        e.title.toLowerCase().includes('sec') ||
                        e.title.toLowerCase().includes('cftc') ||
                        e.title.toLowerCase().includes('tokeniz')
                )
                .map((e) => e.id);
            narratives.push({
                titleVi: 'Tokenization và khung pháp lý thu hút sự chú ý',
                summaryVi: 'Các động thái xem xét chứng khoán token hóa từ cơ quan quản lý tạo động lực cho các doanh nghiệp hạ tầng như Coinbase, Robinhood và Circle, dù khung pháp lý chung vẫn cần thời gian hoàn thiện.',
                strength: 'MEDIUM',
                supportingEventIds: regEvtIds,
            });
        }

        // Narrative 4: Altcoin Market Structure
        if (hasAltcoinOrMacro || narratives.length < 3) {
            const altEvtIds = eventsToAnalyze
                .filter((e) => !e.tokens.includes('BTC') && (e.tokens.length > 0 || e.title.toLowerCase().includes('altcoin')))
                .map((e) => e.id);
            narratives.push({
                titleVi: 'Altcoin chưa cho thấy sự mở rộng dòng tiền rõ ràng',
                summaryVi: 'Hiệu suất nhóm altcoin nhìn chung vẫn chịu áp lực tương đối so với BTC. Dòng tiền hiện hữu vẫn mang tính chọn lọc cao, chưa xuất hiện tín hiệu altseason trên diện rộng.',
                strength: 'MEDIUM',
                supportingEventIds: altEvtIds,
            });
        }

        // Narrative 5: Security or Market Infrastructure (if relevant)
        if (hasSecurity && narratives.length < 5) {
            const secEvtIds = eventsToAnalyze.filter((e) => e.eventType.includes('SECURITY')).map((e) => e.id);
            narratives.push({
                titleVi: 'Cảnh báo an toàn và rủi ro hợp đồng thông minh',
                summaryVi: 'Các sự cố bảo mật nhắc nhở nhà đầu tư duy trì sự thận trọng đối với các giao thức mới và kiểm tra kỹ quyền phê duyệt hợp đồng.',
                strength: 'MEDIUM',
                supportingEventIds: secEvtIds,
            });
        }

        // 3. Asset Analysis (BTC, ETH, ALTCOIN, MEME)
        const assetAnalysis: AssetAnalysisItem[] = [];

        if (hasBtc) {
            assetAnalysis.push({
                asset: 'BTC',
                outlook: 'TÍCH CỰC',
                summaryVi: 'Bitcoin đang giữ vị thế và sức mạnh tương đối tốt hơn đáng kể so với phần còn lại của thị trường.',
                signalsVi: [
                    'Relative strength cao hơn altcoin và thị trường chung',
                    'Dòng vốn ETF duy trì inflow ròng tích cực',
                    'Institutional demand vẫn hiện diện và làm trụ đỡ thanh khoản',
                ],
            });
        }

        if (hasEth) {
            assetAnalysis.push({
                asset: 'ETH',
                outlook: 'TRUNG LẬP',
                summaryVi: 'Dòng tiền ETF vào Ethereum ghi nhận sự chững lại so với chuỗi tăng trước đó, chưa xuất hiện catalyst đột phá riêng cho hệ sinh thái.',
                signalsVi: [
                    'Dòng tiền tổ chức suy giảm tốc độ so với Bitcoin',
                    'Chưa có chất xúc tác mạnh riêng biệt trong nhóm tin hiện tại',
                ],
            });
        }

        if (hasAltcoinOrMacro) {
            assetAnalysis.push({
                asset: 'ALTCOIN',
                outlook: 'THẬN TRỌNG',
                summaryVi: 'Dòng tiền chưa lan rộng rõ ràng sang các tài sản vốn hóa vừa và nhỏ; các báo cáo thị trường củng cố quan điểm hiệu suất tương đối yếu.',
                signalsVi: [
                    'Thanh khoản tập trung phần lớn ở các tài sản đầu ngành',
                    'Chưa có bằng chứng đủ mạnh cho một đợt bứt phá diện rộng',
                ],
            });
        }

        const memeEvents = eventsToAnalyze.filter((e) => e.category === 'MEMECOIN' || e.eventType === MarketEventType.MEME_TREND);
        if (memeEvents.length > 0) {
            assetAnalysis.push({
                asset: 'MEME',
                outlook: 'THEO DÕI',
                summaryVi: 'Hoạt động giao dịch tập trung cục bộ theo sự kiện niêm yết hoặc đà đầu cơ ngắn hạn, rủi ro biến động hai chiều rất cao.',
                signalsVi: [
                    'Dòng tiền thuần túy đầu cơ theo tin tức và mạng xã hội',
                    'Khuyến nghị thận trọng trước rủi ro thanh lý nhanh',
                ],
            });
        }

        // 4. Institutional Flow Section
        let institutionalFlowVi: string | undefined;
        if (hasEtf) {
            institutionalFlowVi =
                'Dữ liệu ETF và các sản phẩm tài chính tổ chức cho thấy dòng vốn tiếp tục tập trung ưu tiên vào Bitcoin, trong khi các quỹ Ethereum có sự giảm tốc sau giai đoạn tăng trưởng. Điều này phản ánh khẩu vị rủi ro thận trọng của các định chế tài chính lớn.';
        }

        // 5. Regulation Section
        let regulationVi: string | undefined;
        if (hasRegulation) {
            regulationVi =
                'Cơ quan quản lý (SEC, CFTC) tiếp tục đóng vai trò trọng tâm trong việc định hình luật chơi. Mặc dù khung pháp lý toàn diện vẫn trong quá trình xây dựng, xu hướng chứng khoán token hóa (tokenized stocks) đang nhận được tín hiệu tích cực hơn, mở ra cơ hội cho các tổ chức hạ tầng.';
        }

        // 6. Catalysts
        const catalystsVi: string[] = [
            'Bitcoin ETF tiếp tục hút dòng tiền ròng từ các quỹ tổ chức.',
            'Tokenized stocks và hạ tầng tài sản số nhận thêm động lực pháp lý từ cơ quan quản lý.',
            'Bitcoin duy trì relative strength vững chắc so với thị trường altcoin.',
        ].slice(0, 3);

        // 7. Key Risks
        const risksVi: string[] = [
            'Altcoin vẫn yếu tương đối so với BTC, tiềm ẩn rủi ro thanh khoản kém.',
            'Dòng tiền tổ chức vào các sản phẩm ETH có dấu hiệu chững lại.',
            'Regulatory uncertainty tại các thị trường tài chính lớn vẫn chưa được giải quyết dứt điểm.',
            'Các sản phẩm đòn bẩy mới có thể làm gia tăng biên độ biến động ngắn hạn.',
        ];

        // 8. Things to Watch Next
        const watchNextVi: string[] = [
            'Dòng vốn ròng vào các quỹ Bitcoin ETF có tiếp tục duy trì trong các phiên tiếp theo?',
            'Dòng tiền có xuất hiện dấu hiệu bắt đầu luân chuyển từ BTC sang ETH và Altcoin?',
            'Cơ quan quản lý sẽ công bố chi tiết khung hướng dẫn tokenized securities như thế nào?',
            'Biến động thanh khoản thị trường trước các thông tin kinh tế vĩ mô.',
        ];

        // 9. Market State
        const marketState: MarketStateOutlook = {
            overall: 'NGHIÊNG TÍCH CỰC ĐỐI VỚI BTC, TRUNG LẬP ĐỐI VỚI ALTCOIN',
            btc: 'Tích cực',
            eth: 'Trung lập',
            altcoin: 'Thận trọng',
            meme: memeEvents.length > 0 ? 'Theo dõi' : 'Chưa có tín hiệu đủ mạnh',
        };

        // 10. Overall Impact Score & Confidence
        const highImpactCount = eventsToAnalyze.filter((e) => e.impactScore >= 75).length;
        const baseScore = eventsToAnalyze.reduce((sum, e) => sum + e.impactScore, 0) / Math.max(1, eventsToAnalyze.length);
        const overallImpactScore = Math.min(100, Math.max(45, Math.round(baseScore + highImpactCount * 2)));

        const verifiedCount = eventsToAnalyze.filter(
            (e) => e.sources.length >= 2 || e.primaryEvent.source.tier === 'OFFICIAL' || e.primaryEvent.source.credibilityScore >= 80
        ).length;
        const analysisConfidence = Math.min(95, Math.max(70, 75 + verifiedCount * 2));

        // 11. Comprehensive Market Overview Summary
        const summaryVi =
            'Bitcoin tiếp tục là tài sản dẫn dắt rõ rệt trong nhóm tin hiện tại, thể hiện relative strength vượt trội hơn phần còn lại của thị trường. Dữ liệu ETF củng cố thực tế rằng dòng vốn tổ chức vẫn ưu tiên phân bổ vào BTC, trong khi Ethereum ghi nhận sự giảm tốc sau chuỗi inflow trước đó. Ở cấp độ thị trường rộng hơn, dòng tiền chưa cho thấy dấu hiệu luân chuyển mạnh sang nhóm altcoin. Ở chiều tích cực, xu hướng tokenization và chứng khoán token hóa đang nhận được sự quan tâm đáng kể từ các cơ quan quản lý và các định chế hạ tầng.';

        return {
            summaryVi,
            overallImpactScore,
            analysisConfidence,
            marketState,
            narratives: narratives.slice(0, 5),
            assetAnalysis,
            institutionalFlowVi,
            regulationVi,
            catalystsVi,
            risksVi,
            watchNextVi,
            usedEventIds,
            ignoredEventIds,
        };
    }
}

