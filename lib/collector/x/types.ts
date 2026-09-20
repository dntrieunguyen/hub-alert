import type { VerificationStatus, XEventType, XSourceType } from '../types';

export interface XSource {
    handle: string;
    displayName: string;
    enabled: boolean;
    sourceType: XSourceType;
    credibilityScore: number;
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    pollingInterval: number; // in seconds
    categories: string[];
    watchTopics: string[];
    requiresConfirmation: boolean;
    officialDomain?: string;
    rsshubRoute: string;
    regions?: string[];
    role?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
}

export interface PublicOfficialRole {
    role: 'PRESIDENT' | 'TREASURY_SECRETARY' | 'SEC_CHAIR' | 'CFTC_CHAIR' | 'FED_CHAIR' | 'COMMERCE_SECRETARY' | 'SENIOR_OFFICIAL';
    handle: string;
    name: string;
    effectiveFrom: string;
    effectiveTo: string | null;
}

export interface XEventAggregation {
    symbol: string;
    event: string;
    officialSources: number;
    newsSources: number;
    socialMentions: number;
    mentionVelocity: number;
    trendScore: number;
    firstSeenAt: Date;
    lastSeenAt: Date;
    sources: string[];
    postUrls: string[];
}

export interface XPostLinkAnalysis {
    linkedUrls: string[];
    linkedDomains: string[];
    hasPrimarySourceLink: boolean;
    matchedOfficialDomain?: string;
}

export interface XPostStructure {
    postId: string;
    handle: string;
    postUrl: string;
    text: string;
    isReply: boolean;
    isRepost: boolean;
    isQuote: boolean;
    quotedPostId?: string;
    canonicalHandle?: string;
}
