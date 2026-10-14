import { Inject, Injectable } from '@nestjs/common';
import { requireCompany } from '@/application/companies/require-company.js';
import type {
    CompanyData,
    CompanyProfileEntity,
} from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class UpdateCurrentCompanyService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
    ) {}

    /** Substitui os dados cadastrais e o endereço da empresa. */
    async execute(companyId: string, data: CompanyData): Promise<CompanyProfileEntity> {
        const company = await requireCompany(this.companies, companyId);
        const updated = company.withChanges(data);
        await this.companies.update(updated);
        return updated;
    }
}
