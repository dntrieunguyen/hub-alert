/**
 * Vietnamese output validator, CJK character detector, generic filler detector,
 * and URL validator according to Sections 7, 8, 21, and 31.
 */

// Regex for CJK Han characters, Japanese Hiragana/Katakana, Korean Hangul
const CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
const CONSECUTIVE_CJK_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]{3,}/;

// Generic AI filler phrases that signal low-effort hallucination or generic padding
const GENERIC_FILLER_PATTERNS = [
    /sự kiện đang thu hút sự quan tâm/i,
    /có thể tác động ngắn hạn tới thị trường crypto/i,
    /động lực then chốt/i,
    /tạo biến động giao dịch/i,
    /đáng để nhà đầu tư theo dõi/i,
    /thu hút lượng lớn sự chú ý/i,
    /có thể tạo biến động/i,
];

/**
 * Validates that user-facing text is written in Vietnamese and does NOT contain
 * untranslated Chinese, Japanese, or Korean text (excluding tickers / proper nouns).
 *
 * Returns false if:
 * - The text has 3 or more consecutive CJK characters (e.g. 隧道股份, 陆家嘴信托)
 * - The CJK character ratio exceeds 5% of total text length.
 */
export function validateVietnameseOutput(text?: string | null): boolean {
    if (!text || text.trim().length === 0) {
        return false;
    }

    const clean = text.trim();

    // If there is any sequence of 3+ consecutive CJK characters, it's raw foreign text
    if (CONSECUTIVE_CJK_REGEX.test(clean)) {
        return false;
    }

    // Check overall CJK ratio
    const matches = clean.match(CJK_REGEX);
    if (matches && matches.length > 0) {
        const ratio = matches.length / clean.length;
        if (ratio > 0.05) {
            return false;
        }
    }

    return true;
}

/**
 * Detects whether a summary or whyItMatters text relies on forbidden generic AI filler phrases
 * without providing concrete factual explanations.
 */
export function detectGenericFiller(text?: string | null): boolean {
    if (!text) {
        return false;
    }

    for (const pattern of GENERIC_FILLER_PATTERNS) {
        if (pattern.test(text)) {
            return true;
        }
    }

    return false;
}

/**
 * Validates whether a URL is a legitimate http/https web link.
 * Prevents `<|Title>` or empty URL markup in Google Chat messages.
 */
export function isValidHttpUrl(url?: string | null): boolean {
    if (!url || typeof url !== 'string') {
        return false;
    }

    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return false;
    }

    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}
