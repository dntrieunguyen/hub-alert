import { FeedCategory, FeedSource, SourceTier } from '../../types';
import type { XSource } from '../types';
import { CRYPTO_PROJECT_X_SOURCES } from './crypto-project.sources';
import { EXCHANGE_AND_BROKER_X_SOURCES } from './exchange.sources';
import { GOVERNMENT_AND_MACRO_X_SOURCES, PUBLIC_OFFICIALS_ROLE_REGISTRY, PUBLIC_OFFICIALS_X_SOURCES } from './government.sources';
import { EUROPE_MACRO_X_SOURCES } from './macro.sources';

export {
    CRYPTO_PROJECT_X_SOURCES,
    EXCHANGE_AND_BROKER_X_SOURCES,
    GOVERNMENT_AND_MACRO_X_SOURCES,
    EUROPE_MACRO_X_SOURCES,
    PUBLIC_OFFICIALS_ROLE_REGISTRY,
    PUBLIC_OFFICIALS_X_SOURCES,
};

export const INITIAL_X_SOURCES: XSource[] = [
    ...GOVERNMENT_AND_MACRO_X_SOURCES,
    ...PUBLIC_OFFICIALS_X_SOURCES,
    ...EUROPE_MACRO_X_SOURCES,
    ...EXCHANGE_AND_BROKER_X_SOURCES,
    ...CRYPTO_PROJECT_X_SOURCES,
];

/**
 * Maps configured XSources to standard FeedSource objects compatible with FeedScheduler
 */
export function buildXFeedSources(sources: XSource[] = INITIAL_X_SOURCES): FeedSource[] {
    return sources.map((s) => {
        let category: FeedCategory = 'CRYPTO';
        if (s.categories.includes('MEMECOIN')) {
            category = 'MEMECOIN';
        } else if (s.categories.includes('MACRO')) {
            category = 'MACRO';
        } else if (s.categories.includes('MARKET')) {
            category = 'MARKET';
        } else if (s.categories.includes('CRYPTO_NEWS')) {
            category = 'CRYPTO_NEWS';
        }

        const tier =
            s.priority === 'P0' || s.sourceType.startsWith('GOVERNMENT') || s.sourceType === 'CENTRAL_BANK' || s.sourceType === 'EXCHANGE' || s.sourceType === 'BROKER'
                ? SourceTier.OFFICIAL
                : SourceTier.COMMUNITY;

        return {
            id: `x-${s.handle.toLowerCase()}`,
            name: s.displayName,
            enabled: s.enabled,
            category,
            sourceTier: tier,
            rssUrl: s.rsshubRoute,
            pollingInterval: s.pollingInterval,
            credibilityScore: s.credibilityScore,
            tags: ['X', s.sourceType, ...(s.regions ?? []), ...s.categories],
            platform: 'X',
            handle: s.handle,
            xSourceType: s.sourceType,
            officialDomain: s.officialDomain,
            requiresConfirmation: s.requiresConfirmation,
            regions: s.regions,
            priority: s.priority,
            watchTopics: s.watchTopics,
            marketImpactWeight: s.priority === 'P0' ? 1.0 : s.priority === 'P1' ? 0.8 : s.priority === 'P2' ? 0.6 : 0.4,
            failureCount: 0,
            nextFetchAt: new Date(),
        };
    });
}
