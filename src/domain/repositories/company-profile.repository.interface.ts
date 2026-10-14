import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

export interface ICompanyProfileRepository {
    /** @throws DomainError CNPJ_ALREADY_REGISTERED se o CNPJ já existe */
    create(profile: CompanyProfileEntity): Promise<void>;
    findById(id: string): Promise<CompanyProfileEntity | null>;
    /** @throws DomainError CNPJ_ALREADY_REGISTERED se o CNPJ já existe em outra empresa */
    update(profile: CompanyProfileEntity): Promise<void>;
    list(page: PageRequest): Promise<Page<CompanyProfileEntity>>;
}
