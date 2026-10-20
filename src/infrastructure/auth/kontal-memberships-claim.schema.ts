import { z } from 'zod';
import { MembershipRole } from '@/domain/auth/membership-role.js';
import {
    MAX_CLAIM_COMPANIES,
    type KontalMembershipEntry,
} from '@/domain/auth/kontal-memberships-claim.js';

const entrySchema = z.object({
    companyId: z.uuid(),
    role: z.enum(MembershipRole),
});

/** Claim `kontalMemberships`: empresas do Kontal que o usuário acessa e o papel em cada uma. */
export const kontalMembershipsClaimSchema = z.array(entrySchema).max(MAX_CLAIM_COMPANIES);

/** Claim válida ou lista vazia (claim ausente ou malformada não dá acesso). */
export function parseKontalMembershipsClaim(claim: unknown): KontalMembershipEntry[] {
    const parsed = kontalMembershipsClaimSchema.safeParse(claim);
    if (!parsed.success) return [];
    const byCompany = new Map(parsed.data.map(entry => [entry.companyId, entry]));
    return [...byCompany.values()];
}
