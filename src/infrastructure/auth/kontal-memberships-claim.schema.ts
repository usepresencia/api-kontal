import { z } from 'zod';
import { MembershipRole } from '@/domain/auth/membership-role.js';

/** Limite de empresas por claim: o Firebase aceita até 1000 bytes de claims por usuário. */
export const MAX_CLAIM_COMPANIES = 8;

const entrySchema = z.object({
    companyId: z.uuid(),
    role: z.enum(MembershipRole),
});

/** Claim `kontalMemberships`: empresas do Kontal que o usuário acessa e o papel em cada uma. */
export const kontalMembershipsClaimSchema = z.array(entrySchema).max(MAX_CLAIM_COMPANIES);

export type KontalMembershipClaimEntry = z.infer<typeof entrySchema>;

/** Claim válida ou lista vazia (claim ausente ou malformada não dá acesso). */
export function parseKontalMembershipsClaim(claim: unknown): KontalMembershipClaimEntry[] {
    const parsed = kontalMembershipsClaimSchema.safeParse(claim);
    if (!parsed.success) return [];
    const byCompany = new Map(parsed.data.map(entry => [entry.companyId, entry]));
    return [...byCompany.values()];
}
