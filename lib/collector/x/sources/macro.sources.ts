import { XSourceType } from '../../types';
import type { XSource } from '../types';

export const EUROPE_MACRO_X_SOURCES: XSource[] = [
    {
        handle: 'ECB',
        displayName: 'European Central Bank',
        enabled: true,
        sourceType: XSourceType.CENTRAL_BANK,
        credibilityScore: 100,
        priority: 'P0',
        pollingInterval: 60, // 1m
        categories: ['MACRO', 'MARKET'],
        watchTopics: [
            'interest rates',
            'inflation',
            'Euro',
            'liquidity',
            'monetary policy',
            'digital euro',
            'banking',
        ],
        requiresConfirmation: true,
        officialDomain: 'ecb.europa.eu',
        rsshubRoute: '/twitter/user/ECB',
    },
    {
        handle: 'bankofengland',
        displayName: 'Bank of England',
        enabled: true,
        sourceType: XSourceType.CENTRAL_BANK,
        credibilityScore: 100,
        priority: 'P0',
        pollingInterval: 60, // 1m
        categories: ['MACRO', 'MARKET'],
        watchTopics: [
            'rates',
            'GBP',
            'inflation',
            'monetary policy',
            'financial stability',
        ],
        requiresConfirmation: true,
        officialDomain: 'bankofengland.co.uk',
        rsshubRoute: '/twitter/user/bankofengland',
    },
];
