import type { CompanyEntity } from '@/domain/entities/company.entity.js';
import type { MembershipEntity } from '@/domain/entities/membership.entity.js';

export interface MembershipWithCompany {
    membership: MembershipEntity;
    company: CompanyEntity;
}

export interface IMembershipRepository {
    /** Devolve a membership mesmo inativa. */
    findByUserAndCompany(userId: string, companyId: string): Promise<MembershipEntity | null>;
    /** Memberships ativas de empresas ativas, com a empresa. */
    findActiveByUserId(userId: string): Promise<MembershipWithCompany[]>;
}
