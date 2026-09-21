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
     * Creates a UTC Date representing a specific year, month, day, hour, minute in the given timezone.
     * Uses native UTC arithmetic so days roll over safely (e.g. day 30+1 -> 1st of next month)
     * without producing invalid dates or string parsing NaN.
     */
    static createDateInTimezone(year: number, month: number, day: number, hour: number, minute: number, timezone = 'Asia/Ho_Chi_Minh'): Date {
        const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
        try {
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: timezone,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: false,
            });
            const parts = formatter.formatToParts(guessUtc);
            const getVal = (t: string) => Number.parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
            const targetInTz = new Date(Date.UTC(getVal('year'), getVal('month') - 1, getVal('day'), getVal('hour'), getVal('minute'), getVal('second')));
            const diffMs = guessUtc.getTime() - targetInTz.getTime();
            return new Date(guessUtc.getTime() + diffMs);
        } catch {
            return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
        }
    }

    /**
     * Computes the next occurrence of a scheduled slot in the given timezone.
     * Accepts optional customSlots (in minutes of day, e.g. [300, 660, 1020]).
     */
    static getNextScheduledRun(now: Date, timezone = 'Asia/Ho_Chi_Minh', customSlots?: number[]): Date {
        const parts = CryptoDigestScheduler.getVietnamTimeParts(now, timezone);
        const currentTotalMinutes = parts.hour * 60 + parts.minute;

        const targetSlots = customSlots && customSlots.length > 0 ? [...customSlots].sort((a, b) => a - b) : [5 * 60, 11 * 60, 17 * 60];

        let targetMinuteOfDay = targetSlots.find((slot) => slot > currentTotalMinutes);
        let daysToAdd = 0;

        if (targetMinuteOfDay === undefined) {
            // All slots for today passed, target first slot tomorrow
            targetMinuteOfDay = targetSlots[0];
            daysToAdd = 1;
        }

        const targetHour = Math.floor(targetMinuteOfDay / 60);
        const targetMin = targetMinuteOfDay % 60;

        return CryptoDigestScheduler.createDateInTimezone(parts.year, parts.month, parts.day + daysToAdd, targetHour, targetMin, timezone);
    }

    /**
     * Determines the initial target run on startup.
     * Checks if the most recent scheduled slot occurred within graceMinutes (default 60m)
     * and should be triggered as a catch-up run.
     */
    determineInitialRunTarget(now: Date, timezone = 'Asia/Ho_Chi_Minh', slots: number[], graceMinutes = 60): Date {
        const parts = CryptoDigestScheduler.getVietnamTimeParts(now, timezone);
        const currentTotalMinutes = parts.hour * 60 + parts.minute;

        // Check if there is a slot that passed recently (within graceMinutes)
        const recentPassedSlot = [...slots].reverse().find((slot) => currentTotalMinutes >= slot && currentTotalMinutes - slot <= graceMinutes);

        if (recentPassedSlot !== undefined) {
            // Trigger immediately to catch up the missed slot
            return now;
        }

        return CryptoDigestScheduler.getNextScheduledRun(now, timezone, slots);
    }

    /**
     * Extracts date/time parts in the configured timezone
     */
    static getVietnamTimeParts(
        date: Date,
        timezone = 'Asia/Ho_Chi_Minh'
    ): {
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
    static computeWindowFrom(now: Date, timezone = 'Asia/Ho_Chi_Minh', fallbackHours = 12, lastDeliveredAt?: Date): Date {
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
        const slots = this.digestService.configService.getScheduleSlots();
        const slotNames = this.digestService.configService.getScheduleSlotNames();
        const now = new Date();

        this.nextRunAt = this.determineInitialRunTarget(now, config.timezone, slots);
        logger.info(`[crypto-digest.scheduler] Started CryptoDigestScheduler (${slotNames.join(', ')} ${config.timezone}). Next target run at: ${this.nextRunAt.toISOString()}`);

        // Run immediate check in case catch-up is due
        this.checkSchedule().catch((err) => {
            logger.error(`[crypto-digest.scheduler.error] ${err.message}`);
        });

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
     * Checks if current time has reached or passed the scheduled nextRunAt target
     */
    async checkSchedule(): Promise<void> {
        if (!this.isRunning || !this.nextRunAt || this.isExecuting) {
            return;
        }

        const now = new Date();
        if (now.getTime() >= this.nextRunAt.getTime()) {
            const config = this.digestService.configService.getConfig();
            const parts = CryptoDigestScheduler.getVietnamTimeParts(now, config.timezone);
            const slotKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;

            if (this.lastTriggeredSlot !== slotKey) {
                this.lastTriggeredSlot = slotKey;
                logger.info(`[crypto-digest.scheduler] Scheduled slot triggered at ${now.toISOString()} (target was: ${this.nextRunAt.toISOString()}) in ${config.timezone}`);
                await this.tick();
            } else {
                // Already triggered for this slot, advance nextRunAt to next scheduled slot
                const slots = this.digestService.configService.getScheduleSlots();
                this.nextRunAt = CryptoDigestScheduler.getNextScheduledRun(now, config.timezone, slots);
            }
        }
    }

    async tick(options: { force?: boolean } = {}): Promise<void> {
        if (this.isExecuting && !options.force) {
            logger.warn('[crypto-digest.scheduler] Digest execution already in progress, skipping tick');
            return;
        }

        const config = this.digestService.configService.getConfig();
        const slots = this.digestService.configService.getScheduleSlots();
        this.isExecuting = true;
        this.lastRunAt = new Date();

        try {
            logger.info('[crypto-digest.scheduler] Triggering scheduled digest generation...');
            await this.digestService.generateAndSendDigest();
        } catch (error: any) {
            logger.error(`[crypto-digest.scheduler.failed] ${error.message}`);
        } finally {
            this.isExecuting = false;
            this.nextRunAt = CryptoDigestScheduler.getNextScheduledRun(new Date(), config.timezone, slots);
            logger.info(`[crypto-digest.scheduler] Next scheduled run updated to: ${this.nextRunAt.toISOString()}`);
        }
    }

    getStatus() {
        const config = this.digestService.configService.getConfig();
        const slotNames = this.digestService.configService.getScheduleSlotNames();
        return {
            isRunning: this.isRunning,
            isExecuting: this.isExecuting,
            timezone: config.timezone,
            scheduleSlots: slotNames,
            lastRunAt: this.lastRunAt,
            nextRunAt: this.nextRunAt,
        };
    }
}
