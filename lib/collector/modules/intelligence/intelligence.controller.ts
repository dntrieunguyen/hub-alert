import type { Context } from 'hono';

import type { IntelligenceService } from './intelligence.service';

export class IntelligenceController {
    constructor(private readonly intelligenceService: IntelligenceService) {}

    aiStatus = (c: Context) => {
        return c.json(this.intelligenceService.getAiStatus());
    };
}
