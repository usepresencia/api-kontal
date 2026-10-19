import type { MembershipRole } from '@/domain/auth/membership-role.js';
import type { CompanyEntity } from '@/domain/entities/company.entity.js';
import type { MembershipEntity } from '@/domain/entities/membership.entity.js';

export interface MembershipWithCompany {
    membership: MembershipEntity;
    company: CompanyEntity;
}

export interface MembershipGrant {
    companyId: string;
    role: MembershipRole;
}

export interface IMembershipRepository {
    /** Devolve a membership mesmo inativa. */
    findByUserAndCompany(userId: string, companyId: string): Promise<MembershipEntity | null>;
    /** Memberships ativas de empresas ativas, com a empresa. */
    findActiveByUserId(userId: string): Promise<MembershipWithCompany[]>;
    /**
     * Alinha as memberships do usuário aos `grants`: cria ou reativa cada empresa existente com
     * o papel informado e desativa as demais. Ignora empresas que não existem e só grava quando
     * há diferença.
     */
    reconcile(userId: string, grants: MembershipGrant[]): Promise<void>;
}
