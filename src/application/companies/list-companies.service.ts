import { Inject, Injectable } from '@nestjs/common';
import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListCompaniesService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
    ) {}

    execute(page: PageRequest): Promise<Page<CompanyProfileEntity>> {
        return this.companies.list(page);
    }
}
