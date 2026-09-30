import type { TokenTrendService } from '../../trends/token-trend.service';

export type TrendWindow = '1h' | '6h' | '24h';

export interface TrendsModuleDependencies {
    trendService: TokenTrendService;
}

export class TrendsService {
    constructor(private readonly trendService: TokenTrendService) {}

    getTokenTrends(window: TrendWindow) {
        return this.trendService.getTokenTrends(window);
    }

    getMemeTrends(window: TrendWindow) {
        return this.trendService.getMemeTrends(window);
    }
}
