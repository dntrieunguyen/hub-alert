import type { CollectorService } from '../../collector.service';
import { INITIAL_X_SOURCES } from '../../x';

export interface XModuleDependencies {
    collectorService: CollectorService;
}

export class XService {
    constructor(private readonly collectorService: CollectorService) {}

    getSources(filters: { type?: string; priority?: string }) {
        let sources = INITIAL_X_SOURCES;
        if (filters.type) {
            sources = sources.filter((s) => s.sourceType === filters.type);
        }
        if (filters.priority) {
            sources = sources.filter((s) => s.priority === filters.priority);
        }
        return {
            count: sources.length,
            sources,
        };
    }

    getAggregations(symbol?: string) {
        const aggregator = this.collectorService.getXEventAggregator();
        if (symbol) {
            return { aggregation: aggregator.getAggregation(symbol) };
        }
        const aggregations = aggregator.getAllAggregations();
        return { count: aggregations.length, aggregations };
    }
}
