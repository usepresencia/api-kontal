import { Inject, Injectable } from '@nestjs/common';
import { requireCompany } from '@/application/companies/require-company.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class DeactivateCompanyService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
    ) {}

    /** Desativa a empresa (não apaga dados). */
    async execute(id: string): Promise<void> {
        const company = await requireCompany(this.companies, id);
        await this.companies.update(company.deactivate());
    }
}
