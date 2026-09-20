import { type FeedCategory, type SourceTier, VerificationStatus } from '../types';

export { VerificationStatus };

export enum MarketEventType {
    EXCHANGE_LISTING = 'EXCHANGE_LISTING',
    EXCHANGE_DELISTING = 'EXCHANGE_DELISTING',
    BROKER_LISTING = 'BROKER_LISTING',
    CENTRAL_BANK_DECISION = 'CENTRAL_BANK_DECISION',
    MACRO_DATA = 'MACRO_DATA',
    ETF = 'ETF',
    REGULATION = 'REGULATION',
    GOVERNMENT_POLICY = 'GOVERNMENT_POLICY',
    PUBLIC_OFFICIAL_STATEMENT = 'PUBLIC_OFFICIAL_STATEMENT',
    SECURITY_INCIDENT = 'SECURITY_INCIDENT',
    NETWORK_INCIDENT = 'NETWORK_INCIDENT',
    MEME_TREND = 'MEME_TREND',
    GENERAL_NEWS = 'GENERAL_NEWS',
}

export enum EventPriority {
    P0 = 'P0',
    P1 = 'P1',
    P2 = 'P2',
}

export enum NotificationSeverity {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
}

export enum NotificationChannel {
    GOOGLE_CHAT = 'GOOGLE_CHAT',
}

export enum NotificationStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    FAILED = 'FAILED',
}

export interface MarketEventSource {
    id: string;
    name: string;
    tier: SourceTier;
    credibilityScore: number;
}

export interface StatementDetails {
    speaker?: string;
    topic?: string;
    isEnactedPolicy?: boolean;
}

export interface MemeMetrics {
    mentions1h?: number;
    mentionChangePercent?: number;
    uniqueSources?: number;
    velocity?: number;
}

export interface MacroMetrics {
    affectedAssets?: string[];
}

export interface MarketEvent {
    id: string;
    feedItemId?: string;
    title: string;
    summary?: string;
    content?: string;
    url: string; // Original canonical source URL (never internal RSSHub route)
    source: MarketEventSource;
    category: FeedCategory;
    eventType: MarketEventType;
    verificationStatus: VerificationStatus;
    priority: EventPriority;
    impactScore: number; // 0 - 100
    trendScore?: number; // 0 - 100
    tokens: string[];
    symbols: string[];
    chains: string[];
    officialSources?: string[];
    statementDetails?: StatementDetails;
    memeMetrics?: MemeMetrics;
    macroMetrics?: MacroMetrics;
    publishedAt: Date;
    createdAt: Date;
    metadata?: Record<string, unknown>;
}

export interface NotificationDelivery {
    id: string;
    eventId: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    attemptCount: number;
    sentAt?: Date;
    failedAt?: Date;
    lastError?: string;
    createdAt: Date;
}

export interface GoogleChatMessage {
    text: string;
}

export interface NotificationConfig {
    enabled: boolean;
    webhookUrl: string;
    minImpactScore: number;
}
