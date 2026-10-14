import { Inject, Injectable } from '@nestjs/common';
import { effectiveRoleForPlatform } from '@/domain/auth/effective-role.js';
import type { MembershipRole } from '@/domain/auth/membership-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import { COMPANY_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

export interface CompanySummary {
    companyId: string;
    name: string;
    role: MembershipRole;
    isActive: boolean;
}

@Injectable()
export class AccessibleCompaniesService {
    constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: ICompanyRepository) {}

    /** Empresas que o usuário acessa: todas as ativas para platform user; as memberships ativas para os demais. */
    async list(user: SessionUser): Promise<CompanySummary[]> {
        if (user.isPlatformUser) {
            const role = effectiveRoleForPlatform(user.platformRole);
            const all = await this.companies.findAllActive();
            return all.map(c => ({ companyId: c.id, name: c.name, role, isActive: c.isActive }));
        }
        return user.memberships
            .filter(m => m.isActive)
            .map(m => ({
                companyId: m.companyId,
                name: m.company.name,
                role: m.role,
                isActive: m.isActive,
            }));
    }
}
