import logger from '@/utils/logger';
import type { DigestConfig, DigestRankingWeights } from './types';

export class CryptoDigestConfigService {
    private config: DigestConfig;

    constructor(env: Record<string, string | undefined> = process.env) {
        this.config = this.parseAndValidate(env);
    }

    private parseAndValidate(env: Record<string, string | undefined>): DigestConfig {
        const rawEnabled = env.CRYPTO_DIGEST_ENABLED?.trim().toLowerCase();
        const enabled = rawEnabled === undefined ? true : rawEnabled === 'true' || rawEnabled === '1';

        const intervalMinutes = this.parsePositiveInt(env.CRYPTO_DIGEST_INTERVAL_MINUTES, 180, 5, 1440);
        const lookbackHours = this.parsePositiveInt(env.CRYPTO_DIGEST_LOOKBACK_HOURS, 6, 1, 72);
        const maxItems = this.parsePositiveInt(env.CRYPTO_DIGEST_MAX_ITEMS, 10, 1, 30);
        const minCredibility = this.parsePositiveInt(env.CRYPTO_DIGEST_MIN_CREDIBILITY, 70, 0, 100);
        const minRankingScore = this.parsePositiveInt(env.CRYPTO_DIGEST_MIN_RANKING_SCORE, 60, 0, 100);
        const minImpactScore = this.parsePositiveInt(env.CRYPTO_DIGEST_MIN_IMPACT_SCORE, 45, 0, 100);
        const minInformationValue = this.parsePositiveInt(env.CRYPTO_DIGEST_MIN_INFORMATION_VALUE, 60, 0, 100);
        const minMarketRelevance = this.parsePositiveInt(env.CRYPTO_DIGEST_MIN_MARKET_RELEVANCE, 60, 0, 100);
        const candidateBatchSize = this.parsePositiveInt(env.CRYPTO_DIGEST_CANDIDATE_BATCH_SIZE, 50, 10, 100);
        const maxScanItems = this.parsePositiveInt(env.CRYPTO_DIGEST_MAX_SCAN_ITEMS, 300, 50, 1000);

        const rawCriticalEnabled = env.CRYPTO_CRITICAL_ALERT_ENABLED?.trim().toLowerCase();
        const criticalAlertEnabled = rawCriticalEnabled === undefined ? true : rawCriticalEnabled === 'true' || rawCriticalEnabled === '1';
        const criticalAlertThreshold = this.parsePositiveInt(env.CRYPTO_CRITICAL_ALERT_THRESHOLD, 95, 80, 100);

        const timezone = env.CRYPTO_DIGEST_TIMEZONE?.trim() || 'Asia/Ho_Chi_Minh';
        const morningCron = env.CRYPTO_DIGEST_MORNING_CRON?.trim() || '0 5 * * *';
        const noonCron = env.CRYPTO_DIGEST_NOON_CRON?.trim() || '0 11 * * *';
        const eveningCron = env.CRYPTO_DIGEST_EVENING_CRON?.trim() || '0 17 * * *';
        const fallbackLookbackHours = this.parsePositiveInt(env.CRYPTO_DIGEST_FALLBACK_LOOKBACK_HOURS, 12, 1, 72);

        const rawAiEnabled = env.AI_NEWS_ENABLED?.trim().toLowerCase();
        const aiEnabled = rawAiEnabled === undefined ? true : rawAiEnabled === 'true' || rawAiEnabled === '1';
        const aiMaxCandidates = this.parsePositiveInt(env.AI_NEWS_MAX_CANDIDATES, 50, 5, 100);

        const weights: DigestRankingWeights = {
            credibility: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_CREDIBILITY, 0.15),
            impact: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_IMPACT, 0.25),
            verification: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_VERIFICATION, 0.15),
            recency: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_RECENCY, 0.05),
            crossSource: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_CROSS_SOURCE, 0.05),
            marketRelevance: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_RELEVANCE, 0.15),
            aiInformationValue: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_AI_INFO, aiEnabled ? 0.20 : 0),
            aiMarketRelevance: this.parseFloatValue(env.CRYPTO_DIGEST_WEIGHT_AI_RELEVANCE, aiEnabled ? 0.15 : 0),
        };

        const diversity = {
            maxPerToken: this.parsePositiveInt(env.CRYPTO_DIGEST_MAX_PER_TOKEN, 2, 1, 10),
            maxPerSource: this.parsePositiveInt(env.CRYPTO_DIGEST_MAX_PER_SOURCE, 2, 1, 10),
            maxPerTopic: this.parsePositiveInt(env.CRYPTO_DIGEST_MAX_PER_TOPIC, 3, 1, 10),
            maxPerEvent: 1,
        };

        return {
            enabled,
            intervalMinutes,
            lookbackHours,
            maxItems,
            minCredibility,
            minRankingScore,
            minImpactScore,
            minInformationValue,
            minMarketRelevance,
            candidateBatchSize,
            maxScanItems,
            criticalAlertEnabled,
            criticalAlertThreshold,
            timezone,
            morningCron,
            noonCron,
            eveningCron,
            fallbackLookbackHours,
            aiEnabled,
            aiMaxCandidates,
            weights,
            diversity,
        };
    }

    private parsePositiveInt(val: string | undefined, defaultVal: number, min: number, max: number): number {
        if (!val || val.trim() === '') {
            return defaultVal;
        }
        const parsed = Number.parseInt(val.trim(), 10);
        if (Number.isNaN(parsed) || parsed < min || parsed > max) {
            logger.warn(`Invalid integer config value: ${val}. Falling back to default: ${defaultVal}`);
            return defaultVal;
        }
        return parsed;
    }

    private parseFloatValue(val: string | undefined, defaultVal: number): number {
        if (!val || val.trim() === '') {
            return defaultVal;
        }
        const parsed = Number.parseFloat(val.trim());
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
            return defaultVal;
        }
        return parsed;
    }

    logStartup(): void {
        logger.info(
            `[crypto-digest.config] Digest enabled: ${this.config.enabled} (Interval: ${this.config.intervalMinutes}m, Lookback: ${this.config.lookbackHours}h, MaxItems: ${this.config.maxItems}, MinRanking: ${this.config.minRankingScore})`
        );
        logger.info(
            `[crypto-digest.config] Critical Alerts enabled: ${this.config.criticalAlertEnabled} (Threshold: >= ${this.config.criticalAlertThreshold})`
        );
    }

    getConfig(): Readonly<DigestConfig> {
        return { ...this.config };
    }

    isEnabled(): boolean {
        return this.config.enabled;
    }

    isCriticalAlertEnabled(): boolean {
        return this.config.criticalAlertEnabled;
    }

    getCriticalAlertThreshold(): number {
        return this.config.criticalAlertThreshold;
    }
}
