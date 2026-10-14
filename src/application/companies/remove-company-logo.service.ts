import { Inject, Injectable } from '@nestjs/common';
import { requireCompany } from '@/application/companies/require-company.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class RemoveCompanyLogoService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
    ) {}

    /** Limpa a URL do logo da empresa. */
    async execute(companyId: string): Promise<void> {
        const company = await requireCompany(this.companies, companyId);
        await this.companies.update(company.withLogo(null));
    }
}
