import logger from '@/utils/logger';
import type { CryptoDigestService } from './crypto-digest.service';

export class CryptoDigestScheduler {
    private digestService: CryptoDigestService;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning = false;
    private isExecuting = false;
    private nextRunAt: Date | null = null;
    private lastRunAt: Date | null = null;
    private lastTriggeredSlot: string | null = null;

    constructor(digestService: CryptoDigestService) {
        this.digestService = digestService;
    }

    /**
     * Computes the next occurrence of 05:00, 11:00, or 17:00 in the given timezone (Asia/Ho_Chi_Minh)
     */
    static getNextScheduledRun(now: Date, timezone = 'Asia/Ho_Chi_Minh'): Date {
        const parts = CryptoDigestScheduler.getVietnamTimeParts(now, timezone);
        const currentTotalMinutes = parts.hour * 60 + parts.minute;

        const targetSlots = [
            5 * 60, // 05:00
            11 * 60, // 11:00
            17 * 60, // 17:00
        ];

        let targetMinuteOfDay = targetSlots.find((slot) => slot > currentTotalMinutes);
        let daysToAdd = 0;

        if (targetMinuteOfDay === undefined) {
            // All slots for today passed, target 05:00 tomorrow
            targetMinuteOfDay = targetSlots[0];
            daysToAdd = 1;
        }

        const targetHour = Math.floor(targetMinuteOfDay / 60);
        const targetMin = targetMinuteOfDay % 60;

        // Build target Date in timezone
        const nextDate = new Date(now);
        nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd);

        // Approximate conversion matching target slot in Vietnam (+07:00)
        // Format ISO with offset +07:00
        const y = parts.year;
        const m = String(parts.month).padStart(2, '0');
        const d = String(parts.day + daysToAdd).padStart(2, '0');
        const h = String(targetHour).padStart(2, '0');
        const min = String(targetMin).padStart(2, '0');

        const isoString = `${y}-${m}-${d}T${h}:${min}:00+07:00`;
        const parsed = new Date(isoString);
        return Number.isNaN(parsed.getTime()) ? new Date(now.getTime() + 6 * 60 * 60 * 1000) : parsed;
    }

    /**
     * Extracts date/time parts in the configured timezone
     */
    static getVietnamTimeParts(date: Date, timezone = 'Asia/Ho_Chi_Minh'): {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
    } {
        try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
            });
            const parts = formatter.formatToParts(date);
            return {
                year: Number.parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10),
                month: Number.parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10),
                day: Number.parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10),
                hour: Number.parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10),
                minute: Number.parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10),
            };
        } catch {
            return {
                year: date.getUTCFullYear(),
                month: date.getUTCMonth() + 1,
                day: date.getUTCDate(),
                hour: (date.getUTCHours() + 7) % 24,
                minute: date.getUTCMinutes(),
            };
        }
    }

    /**
     * Computes the window start (windowFrom) for the current digest slot:
     * - 05:00 digest: news from 17:00 previous day
     * - 11:00 digest: news from 05:00
     * - 17:00 digest: news from 11:00
     * If last successful delivery exists and is within fallbackLookbackHours, prioritizes it.
     */
    static computeWindowFrom(
        now: Date,
        timezone = 'Asia/Ho_Chi_Minh',
        fallbackHours = 12,
        lastDeliveredAt?: Date
    ): Date {
        if (lastDeliveredAt) {
            const ageMs = now.getTime() - lastDeliveredAt.getTime();
            if (ageMs > 0 && ageMs <= fallbackHours * 60 * 60 * 1000) {
                return lastDeliveredAt;
            }
        }

        const parts = CryptoDigestScheduler.getVietnamTimeParts(now, timezone);
        const hour = parts.hour;

        // Default window boundaries
        let lookbackHours = fallbackHours;
        if (hour >= 5 && hour < 11) {
            // 05:00 slot (looking back to 17:00 yesterday = 12h)
            lookbackHours = 12;
        } else if (hour >= 11 && hour < 17) {
            // 11:00 slot (looking back to 05:00 = 6h)
            lookbackHours = 6;
        } else {
            // 17:00 slot (looking back to 11:00 = 6h)
            lookbackHours = 6;
        }

        return new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
    }

    start(): void {
        if (this.intervalId || this.isRunning) {
            return;
        }

        const config = this.digestService.configService.getConfig();
        if (!config.enabled) {
            logger.info('[crypto-digest.scheduler] Digest is disabled, scheduler not started');
            return;
        }

        this.isRunning = true;
        this.nextRunAt = CryptoDigestScheduler.getNextScheduledRun(new Date(), config.timezone);
        logger.info(
            `[crypto-digest.scheduler] Started CryptoDigestScheduler (05:00, 11:00, 17:00 ${config.timezone}). Next target run at: ${this.nextRunAt.toISOString()}`
        );

        // Check every 30 seconds for target slot
        this.intervalId = setInterval(() => {
            this.checkSchedule().catch((err) => {
                logger.error(`[crypto-digest.scheduler.error] ${err.message}`);
            });
        }, 30000);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        this.nextRunAt = null;
        logger.info('[crypto-digest.scheduler] CryptoDigestScheduler stopped');
    }

    /**
     * Checks if current time in Asia/Ho_Chi_Minh has hit 05:00, 11:00, or 17:00
     */
    private async checkSchedule(): Promise<void> {
        const config = this.digestService.configService.getConfig();
        const now = new Date();
        const parts = CryptoDigestScheduler.getVietnamTimeParts(now, config.timezone);

        const isTargetSlot =
            (parts.hour === 5 && parts.minute === 0) ||
            (parts.hour === 11 && parts.minute === 0) ||
            (parts.hour === 17 && parts.minute === 0);

        const slotKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;

        if (isTargetSlot && this.lastTriggeredSlot !== slotKey) {
            this.lastTriggeredSlot = slotKey;
            logger.info(`[crypto-digest.scheduler] Scheduled slot triggered: ${parts.hour}:00 in ${config.timezone}`);
            await this.tick();
        }
    }

    async tick(options: { force?: boolean } = {}): Promise<void> {
        if (this.isExecuting && !options.force) {
            logger.warn('[crypto-digest.scheduler] Digest execution already in progress, skipping tick');
            return;
        }

        const config = this.digestService.configService.getConfig();
        this.isExecuting = true;
        this.lastRunAt = new Date();

        try {
            logger.info('[crypto-digest.scheduler] Triggering scheduled digest generation...');
            await this.digestService.generateAndSendDigest();
        } catch (error: any) {
            logger.error(`[crypto-digest.scheduler.failed] ${error.message}`);
        } finally {
            this.isExecuting = false;
            this.nextRunAt = CryptoDigestScheduler.getNextScheduledRun(new Date(), config.timezone);
        }
    }

    getStatus() {
        const config = this.digestService.configService.getConfig();
        return {
            isRunning: this.isRunning,
            isExecuting: this.isExecuting,
            timezone: config.timezone,
            scheduleSlots: ['05:00', '11:00', '17:00'],
            lastRunAt: this.lastRunAt,
            nextRunAt: this.nextRunAt,
        };
    }
}
