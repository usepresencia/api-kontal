import type { CompanyEntity } from '@/domain/entities/company.entity.js';

export interface ICompanyRepository {
    findById(id: string): Promise<CompanyEntity | null>;
    findAllActive(): Promise<CompanyEntity[]>;
}
