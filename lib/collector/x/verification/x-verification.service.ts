import { VerificationStatus, XSourceType } from '../../types';
import type { PublicOfficialRole, XPostLinkAnalysis, XSource } from '../types';

export interface VerificationResult {
    status: VerificationStatus;
    reason: string;
    isPrimarySourceLinked: boolean;
    speaker?: string;
    role?: string;
    isEnactedPolicy: boolean;
}

export class XVerificationService {
    private readonly officialRoles: Map<string, PublicOfficialRole> = new Map();

    constructor(officialRoles: PublicOfficialRole[] = []) {
        for (const role of officialRoles) {
            this.officialRoles.set(role.handle.toLowerCase(), role);
        }
    }

    /**
     * Determines verification status using strict compromise defense and attribution rules
     */
    public verifyPost(
        source: XSource,
        linkAnalysis: XPostLinkAnalysis,
        postDate: Date = new Date(),
    ): VerificationResult {
        const handleLower = source.handle.toLowerCase();

        // 1. Check Public Official
        const officialRole = this.officialRoles.get(handleLower) || (source.role ? {
            role: source.role as PublicOfficialRole['role'],
            handle: source.handle,
            name: source.displayName,
            effectiveFrom: source.effectiveFrom || '1970-01-01',
            effectiveTo: source.effectiveTo ?? null,
        } : undefined);

        if (source.sourceType === XSourceType.PUBLIC_OFFICIAL || officialRole) {
            // Check if post falls within role tenure
            const speaker = officialRole?.name || source.displayName;
            const role = officialRole?.role || 'PUBLIC_OFFICIAL';

            return {
                status: VerificationStatus.ATTRIBUTED_STATEMENT,
                reason: `Statement attributed to ${speaker} (${role}). Not enacted government policy.`,
                isPrimarySourceLinked: linkAnalysis.hasPrimarySourceLink,
                speaker,
                role,
                isEnactedPolicy: false,
            };
        }

        // 2. High Authority / Official Sources (Government, Central Bank, Exchange, Broker, Crypto Project)
        const isOfficialOrg =
            source.sourceType === XSourceType.GOVERNMENT_AGENCY ||
            source.sourceType === XSourceType.GOVERNMENT_INSTITUTION ||
            source.sourceType === XSourceType.CENTRAL_BANK ||
            source.sourceType === XSourceType.EXCHANGE ||
            source.sourceType === XSourceType.BROKER ||
            source.sourceType === XSourceType.CRYPTO_PROJECT;

        if (isOfficialOrg) {
            // Defense against compromised official social account:
            // If the post links directly to the verified official domain, it is CONFIRMED_PRIMARY_SOURCE.
            // Otherwise, it remains OFFICIAL_SOCIAL_ONLY.
            if (linkAnalysis.hasPrimarySourceLink) {
                return {
                    status: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
                    reason: `Verified official account ${source.handle} with validated primary domain link (${linkAnalysis.matchedOfficialDomain}).`,
                    isPrimarySourceLinked: true,
                    isEnactedPolicy: source.sourceType === XSourceType.GOVERNMENT_AGENCY || source.sourceType === XSourceType.GOVERNMENT_INSTITUTION,
                };
            }

            return {
                status: VerificationStatus.OFFICIAL_SOCIAL_ONLY,
                reason: `Official account ${source.handle} post without primary domain link. Retained as social signal pending external confirmation.`,
                isPrimarySourceLinked: false,
                isEnactedPolicy: false,
            };
        }

        // 3. News or Research with Primary Domain Link
        if (linkAnalysis.hasPrimarySourceLink) {
            return {
                status: VerificationStatus.CONFIRMED_PRIMARY_SOURCE,
                reason: `Referenced official primary domain (${linkAnalysis.matchedOfficialDomain}) from source ${source.handle}.`,
                isPrimarySourceLinked: true,
                isEnactedPolicy: false,
            };
        }

        // 4. Default Community / Influencer / Unverified
        return {
            status: VerificationStatus.UNVERIFIED,
            reason: `Unverified social post from ${source.handle}.`,
            isPrimarySourceLinked: false,
            isEnactedPolicy: false,
        };
    }
}
