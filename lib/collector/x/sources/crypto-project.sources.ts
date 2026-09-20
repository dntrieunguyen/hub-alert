import { XSourceType } from '../../types';
import type { XSource } from '../types';

export const CRYPTO_PROJECT_X_SOURCES: XSource[] = [
    {
        handle: 'ethereum',
        displayName: 'Ethereum',
        enabled: true,
        sourceType: XSourceType.CRYPTO_PROJECT,
        credibilityScore: 95,
        priority: 'P1',
        pollingInterval: 120, // 2m
        categories: ['CRYPTO', 'INFRASTRUCTURE'],
        watchTopics: ['network upgrade', 'hard fork', 'mainnet', 'protocol update', 'security', 'staking', 'eip', 'layer 1'],
        requiresConfirmation: false,
        officialDomain: 'ethereum.org',
        rsshubRoute: '/twitter/user/ethereum',
    },
    {
        handle: 'solana',
        displayName: 'Solana',
        enabled: true,
        sourceType: XSourceType.CRYPTO_PROJECT,
        credibilityScore: 92,
        priority: 'P1',
        pollingInterval: 120, // 2m
        categories: ['CRYPTO', 'INFRASTRUCTURE'],
        watchTopics: ['network upgrade', 'outage', 'mainnet', 'performance', 'validator', 'restart', 'cluster'],
        requiresConfirmation: false,
        officialDomain: 'solana.com',
        rsshubRoute: '/twitter/user/solana',
    },
    {
        handle: 'base',
        displayName: 'Base',
        enabled: true,
        sourceType: XSourceType.CRYPTO_PROJECT,
        credibilityScore: 92,
        priority: 'P1',
        pollingInterval: 120, // 2m
        categories: ['CRYPTO', 'INFRASTRUCTURE'],
        watchTopics: ['network upgrade', 'mainnet', 'sequencer', 'outage', 'gas', 'bridge', 'layer 2'],
        requiresConfirmation: false,
        officialDomain: 'base.org',
        rsshubRoute: '/twitter/user/base',
    },
    {
        handle: 'arbitrum',
        displayName: 'Arbitrum',
        enabled: true,
        sourceType: XSourceType.CRYPTO_PROJECT,
        credibilityScore: 90,
        priority: 'P1',
        pollingInterval: 120, // 2m
        categories: ['CRYPTO', 'INFRASTRUCTURE'],
        watchTopics: ['network upgrade', 'nitro', 'sequencer', 'outage', 'bridge', 'layer 2'],
        requiresConfirmation: false,
        officialDomain: 'arbitrum.io',
        rsshubRoute: '/twitter/user/arbitrum',
    },
    {
        handle: 'Optimism',
        displayName: 'Optimism (OP Mainnet)',
        enabled: true,
        sourceType: XSourceType.CRYPTO_PROJECT,
        credibilityScore: 90,
        priority: 'P1',
        pollingInterval: 120, // 2m
        categories: ['CRYPTO', 'INFRASTRUCTURE'],
        watchTopics: ['network upgrade', 'superchain', 'bedrock', 'fault proofs', 'sequencer', 'layer 2'],
        requiresConfirmation: false,
        officialDomain: 'optimism.io',
        rsshubRoute: '/twitter/user/Optimism',
    },
    {
        handle: 'chainlink',
        displayName: 'Chainlink',
        enabled: true,
        sourceType: XSourceType.CRYPTO_PROJECT,
        credibilityScore: 90,
        priority: 'P1',
        pollingInterval: 120, // 2m
        categories: ['CRYPTO', 'INFRASTRUCTURE'],
        watchTopics: ['oracle', 'ccip', 'data feed', 'cross-chain', 'reserve', 'mainnet'],
        requiresConfirmation: false,
        officialDomain: 'chain.link',
        rsshubRoute: '/twitter/user/chainlink',
    },
];
