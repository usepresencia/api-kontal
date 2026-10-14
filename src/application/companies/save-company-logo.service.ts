import { Inject, Injectable } from '@nestjs/common';
import { requireCompany } from '@/application/companies/require-company.js';
import type { ICompanyLogoStorage } from '@/domain/companies/company-logo-storage.port.js';
import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { LOGO_STORAGE } from '@/infrastructure/media/media.tokens.js';
import { COMPANY_PROFILE_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class SaveCompanyLogoService {
    constructor(
        @Inject(COMPANY_PROFILE_REPOSITORY) private readonly companies: ICompanyProfileRepository,
        @Inject(LOGO_STORAGE) private readonly storage: ICompanyLogoStorage,
    ) {}

    /**
     * Grava a URL do logo depois de confirmar que ela é o logo desta empresa.
     * @throws DomainError LOGO_URL_INVALID
     */
    async execute(companyId: string, url: string): Promise<CompanyProfileEntity> {
        if (!this.storage.isOwnLogoUrl(companyId, url)) {
            throw new DomainError(
                ErrorCode.LOGO_URL_INVALID,
                'URL de logo inválida para esta empresa',
            );
        }
        const company = (await requireCompany(this.companies, companyId)).withLogo(url);
        await this.companies.update(company);
        return company;
    }
}
