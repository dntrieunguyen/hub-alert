export enum SourceTier {
    OFFICIAL = 'OFFICIAL',
    RESEARCH = 'RESEARCH',
    NEWS = 'NEWS',
    SOCIAL = 'SOCIAL',
    COMMUNITY = 'COMMUNITY',
}

export enum XSourceType {
    GOVERNMENT_AGENCY = 'GOVERNMENT_AGENCY',
    GOVERNMENT_INSTITUTION = 'GOVERNMENT_INSTITUTION',
    PUBLIC_OFFICIAL = 'PUBLIC_OFFICIAL',
    CENTRAL_BANK = 'CENTRAL_BANK',
    EXCHANGE = 'EXCHANGE',
    BROKER = 'BROKER',
    CRYPTO_PROJECT = 'CRYPTO_PROJECT',
    RESEARCHER = 'RESEARCHER',
    ANALYST = 'ANALYST',
    NEWS = 'NEWS',
    COMMUNITY = 'COMMUNITY',
}

export enum XEventType {
    EXCHANGE_LISTING = 'EXCHANGE_LISTING',
    EXCHANGE_DELISTING = 'EXCHANGE_DELISTING',
    BROKER_LISTING = 'BROKER_LISTING',
    TOKEN_SUPPORT = 'TOKEN_SUPPORT',
    ETF = 'ETF',
    REGULATION = 'REGULATION',
    GOVERNMENT_POLICY = 'GOVERNMENT_POLICY',
    PUBLIC_OFFICIAL_STATEMENT = 'PUBLIC_OFFICIAL_STATEMENT',
    CENTRAL_BANK_DECISION = 'CENTRAL_BANK_DECISION',
    MACRO_DATA = 'MACRO_DATA',
    SANCTIONS = 'SANCTIONS',
    SECURITY_INCIDENT = 'SECURITY_INCIDENT',
    NETWORK_INCIDENT = 'NETWORK_INCIDENT',
    PROJECT_ANNOUNCEMENT = 'PROJECT_ANNOUNCEMENT',
    MEME_MENTION = 'MEME_MENTION',
    SOCIAL_MENTION = 'SOCIAL_MENTION',
}

export enum VerificationStatus {
    CONFIRMED_PRIMARY_SOURCE = 'CONFIRMED_PRIMARY_SOURCE',
    CONFIRMED_MULTI_SOURCE = 'CONFIRMED_MULTI_SOURCE',
    ATTRIBUTED_STATEMENT = 'ATTRIBUTED_STATEMENT',
    OFFICIAL_SOCIAL_ONLY = 'OFFICIAL_SOCIAL_ONLY',
    UNVERIFIED = 'UNVERIFIED',
    DISPUTED = 'DISPUTED',
}

export type FeedCategory = 'CRYPTO_NEWS' | 'MEMECOIN' | 'MARKET' | 'MACRO' | 'CRYPTO';

export interface XPostMetadata {
    postId: string;
    handle: string;
    postUrl: string;
    isReply: boolean;
    isRepost: boolean;
    isQuote: boolean;
    quotedPostId?: string;
    canonicalHandle?: string;
    linkedDomains: string[];
    hasPrimarySourceLink: boolean;
    verificationStatus: VerificationStatus;
}

export interface FeedSource {
    id: string;
    name: string;
    enabled: boolean;
    category: FeedCategory;
    sourceTier: SourceTier;
    rssUrl: string;
    pollingInterval: number; // in seconds
    credibilityScore: number; // 0 - 100
    tags: string[];

    // Platform & X Metadata
    platform?: 'RSS' | 'X';
    handle?: string;
    xSourceType?: XSourceType;
    officialDomain?: string;
    requiresConfirmation?: boolean;
    regions?: string[];
    marketImpactWeight?: number;
    watchTopics?: string[];
    priority?: 'P0' | 'P1' | 'P2' | 'P3';

    // Health & Scheduling
    lastSuccessAt?: Date;
    lastFailureAt?: Date;
    failureCount: number;
    lastError?: string;
    nextFetchAt: Date;
}

export interface CryptoFeedItem {
    id: string;
    externalId: string;
    fingerprint: string; // sha256(normalizedTitle + normalizedUrl)
    sourceId: string;
    sourceName: string;
    sourceTier: SourceTier;
    category: FeedCategory;
    title: string;
    summary?: string;
    content?: string;
    url: string;
    author?: string;
    publishedAt: Date;
    collectedAt: Date;
    tokens: string[]; // e.g., ['BTC', 'PEPE']
    symbols: string[]; // e.g., ['$BTC', '$PEPE']
    chains: string[]; // e.g., ['Ethereum', 'Solana']
    topics: string[]; // e.g., ['LISTING', 'ETF']
    entities: string[]; // e.g., ['Binance', 'Federal Reserve']
    credibilityScore: number;
    impactScore: number; // 0 - 100
    breaking: boolean;
    engagement?: {
        likes?: number;
        comments?: number;
        reposts?: number;
        views?: number;
    };
    metadata?: Record<string, unknown>;

    // X Platform additions
    platform?: 'RSS' | 'X';
    handle?: string;
    xSourceType?: XSourceType;
    xMetadata?: XPostMetadata;

    // Raw source fields (preserved, never overwritten)
    originalTitle?: string;
    originalSummary?: string;
    originalContent?: string;
    originalLanguage?: string;

    // AI Market Intelligence fields
    aiTitleVi?: string;
    aiSummaryVi?: string;
    aiAnalysisVi?: string;
    aiWhyItMattersVi?: string;
    aiMarketImpactVi?: string;
    aiInformationValueScore?: number;
    aiMarketRelevanceScore?: number;
    aiImpactScore?: number;
    aiConfidence?: number;
    aiSignalStrength?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOISE';
    aiAnalyzedAt?: Date;
    aiProvider?: string;
    aiModel?: string;
    aiAnalysisVersion?: number;
}

export interface MemeTrend {
    token: string;
    symbol: string;
    chain?: string;
    window: '1h' | '6h' | '24h';
    mentionCount: number;
    uniqueSources: number;
    officialMentions: number;
    newsMentions: number;
    socialMentions: number;
    mentionVelocity: number; // mentions per hour
    trendingScore: number; // 0 - 100
    updatedAt: Date;
}

export interface TokenTrend {
    symbol: string;
    token: string;
    isMeme: boolean;
    chain?: string;
    window: '1h' | '6h' | '24h';
    mentions1h: number;
    change1h: number;
    uniqueSources: number;
    trendScore: number;
    updatedAt: Date;
}

export interface TokenDictionaryEntry {
    symbol: string;
    name: string;
    aliases: string[];
    chain?: string;
    isMeme: boolean;
}

export interface FeedFilterOptions {
    category?: FeedCategory;
    sourceId?: string;
    sourceTier?: SourceTier;
    token?: string;
    topic?: string;
    from?: Date;
    to?: Date;
    breaking?: boolean;
    minCredibility?: number;
    limit?: number;
    offset?: number;

    // Platform & X filtering
    platform?: 'RSS' | 'X';
    xSourceType?: XSourceType;
    handle?: string;
    verificationStatus?: VerificationStatus;
    eventType?: XEventType;
}
