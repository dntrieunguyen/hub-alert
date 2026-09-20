export interface TrendScoreInput {
    mentionVelocity: number; // mentions per hour
    uniqueSources: number;
    avgEngagement?: number; // 0 - 100 normalized
    avgCredibility: number; // 0 - 100
    latestMentionAgeMinutes: number;
}

export class TrendScoreService {
    calculateTrendScore(input: TrendScoreInput): number {
        // 1. Velocity score (0 - 100): 1 mention/hr -> 10 pts, 10+ mentions/hr -> 100 pts
        const velocityScore = Math.min(100, input.mentionVelocity * 10);

        // 2. Unique sources score (0 - 100): 1 source = 20 pts, 5+ sources = 100 pts
        const uniqueSourceScore = Math.min(100, input.uniqueSources * 20);

        // 3. Engagement score (0 - 100)
        const engagementScore = input.avgEngagement ?? 50;

        // 4. Credibility score (0 - 100)
        const credibilityScore = Math.min(100, Math.max(0, input.avgCredibility));

        // 5. Recency score (0 - 100)
        let recencyScore = 10;
        if (input.latestMentionAgeMinutes <= 15) {
            recencyScore = 100;
        } else if (input.latestMentionAgeMinutes <= 60) {
            recencyScore = 85;
        } else if (input.latestMentionAgeMinutes <= 180) {
            recencyScore = 60;
        } else if (input.latestMentionAgeMinutes <= 360) {
            recencyScore = 40;
        } else if (input.latestMentionAgeMinutes <= 1440) {
            recencyScore = 20;
        }

        const composite =
            velocityScore * 0.3 +
            uniqueSourceScore * 0.2 +
            engagementScore * 0.15 +
            credibilityScore * 0.2 +
            recencyScore * 0.15;

        return Math.min(100, Math.max(0, Math.round(composite)));
    }
}
