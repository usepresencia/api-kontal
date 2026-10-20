import type { MembershipRole } from '@/domain/auth/membership-role.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/** Limite de empresas por claim: o Firebase aceita até 1000 bytes de claims por usuário. */
export const MAX_CLAIM_COMPANIES = 8;

/** Uma empresa da claim `kontalMemberships` e o papel do usuário nela. */
export interface KontalMembershipEntry {
    companyId: string;
    role: MembershipRole;
}

/**
 * Inclui a empresa na claim ou troca o papel dela, mantendo as demais.
 * @throws DomainError CLAIM_LIMIT_EXCEEDED se passar de `MAX_CLAIM_COMPANIES` empresas
 */
export function grantMembership(
    entries: readonly KontalMembershipEntry[],
    entry: KontalMembershipEntry,
): KontalMembershipEntry[] {
    const next = [...entries.filter(item => item.companyId !== entry.companyId), entry];
    if (next.length > MAX_CLAIM_COMPANIES) {
        throw new DomainError(
            ErrorCode.CLAIM_LIMIT_EXCEEDED,
            `O usuário já tem acesso a ${MAX_CLAIM_COMPANIES} empresas`,
        );
    }
    return next;
}

/** Tira a empresa da claim, mantendo as demais. */
export function revokeMembership(
    entries: readonly KontalMembershipEntry[],
    companyId: string,
): KontalMembershipEntry[] {
    return entries.filter(item => item.companyId !== companyId);
}
