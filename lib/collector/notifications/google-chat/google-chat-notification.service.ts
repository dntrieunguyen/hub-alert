import logger from '@/utils/logger';

import type { NotificationConfigService } from '../config/notification-config.service';
import type { GoogleChatMessage } from '../types';

export interface SendMessageOptions {
    eventId?: string;
    severity?: string;
    customFetch?: typeof fetch;
}

export class GoogleChatNotificationService {
    private configService: NotificationConfigService;
    private timeoutMs: number;
    private maxRetries: number;
    private retryBackoffMs: number[];
    private fetchFn: typeof fetch;

    constructor(
        configService: NotificationConfigService,
        options: {
            timeoutMs?: number;
            maxRetries?: number;
            retryBackoffMs?: number[];
            fetchFn?: typeof fetch;
        } = {}
    ) {
        this.configService = configService;
        this.timeoutMs = options.timeoutMs ?? 5000;
        this.maxRetries = options.maxRetries ?? 3;
        this.retryBackoffMs = options.retryBackoffMs ?? [1000, 3000];
        this.fetchFn = options.fetchFn ?? globalThis.fetch;
    }

    /**
     * Sends a text message to Google Chat Space
     */
    async sendText(text: string, options: SendMessageOptions = {}): Promise<void> {
        return this.sendMessage({ text }, options);
    }

    /**
     * Sends a GoogleChatMessage with timeout and retry backoff
     */
    async sendMessage(message: GoogleChatMessage, options: SendMessageOptions = {}): Promise<void> {
        if (!this.configService.isEnabled()) {
            logger.info(
                JSON.stringify({
                    event: 'notification.google_chat.skipped',
                    reason: 'disabled',
                    eventId: options.eventId,
                })
            );
            return;
        }

        const webhookUrl = this.configService.getWebhookUrl();
        if (!webhookUrl) {
            logger.warn(
                JSON.stringify({
                    event: 'notification.google_chat.skipped',
                    reason: 'missing_webhook_url',
                    eventId: options.eventId,
                })
            );
            return;
        }

        logger.info(
            JSON.stringify({
                event: 'notification.google_chat.started',
                eventId: options.eventId,
                severity: options.severity,
            })
        );

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                await this.executePost(webhookUrl, message);

                logger.info(
                    JSON.stringify({
                        event: 'notification.google_chat.sent',
                        eventId: options.eventId,
                        severity: options.severity,
                        attempt,
                    })
                );
                return;
            } catch (error: any) {
                lastError = error;
                const statusCode = error.statusCode;
                const isRetryable = this.isRetryableError(statusCode, error.name === 'AbortError' || error.name === 'TimeoutError');

                logger.warn(
                    JSON.stringify({
                        event: 'notification.google_chat.attempt_failed',
                        eventId: options.eventId,
                        attempt,
                        statusCode: statusCode || 'NETWORK_ERROR',
                        errorType: error.name || 'Error',
                        isRetryable,
                    })
                );

                if (!isRetryable || attempt >= this.maxRetries) {
                    break;
                }

                // Wait backoff before next attempt
                const backoff = this.retryBackoffMs[attempt - 1] ?? 3000;
                await new Promise((resolve) => setTimeout(resolve, backoff));
            }
        }

        // Final failure log: NEVER include webhook URL
        logger.error(
            JSON.stringify({
                event: 'notification.google_chat.failed',
                eventId: options.eventId,
                errorType: lastError?.name || 'Error',
                errorMessage: lastError?.message || 'Unknown notification error',
            })
        );

        throw lastError || new Error('Google Chat notification failed');
    }

    private async executePost(webhookUrl: string, message: GoogleChatMessage): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await this.fetchFn(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
                body: JSON.stringify(message),
                signal: controller.signal,
            });

            if (!response.ok) {
                const error: any = new Error(`Google Chat request failed with status: ${response.status}`);
                error.statusCode = response.status;
                throw error;
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                const timeoutErr: any = new Error(`Google Chat request timed out after ${this.timeoutMs}ms`);
                timeoutErr.name = 'TimeoutError';
                throw timeoutErr;
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private isRetryableError(statusCode?: number, isTimeout = false): boolean {
        if (isTimeout) {
            return true;
        }
        if (!statusCode) {
            return true; // Network errors are retryable
        }
        // Retry 429 and 5xx errors
        return statusCode === 429 || (statusCode >= 500 && statusCode <= 504);
    }
}
