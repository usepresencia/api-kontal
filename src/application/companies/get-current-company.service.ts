import { Inject, Injectable } from '@nestjs/common';
import { requireCompany } from '@/application/companies/require-company.js';
import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetCurrentCompanyService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
    ) {}

    execute(companyId: string): Promise<CompanyProfileEntity> {
        return requireCompany(this.companies, companyId);
    }
}
