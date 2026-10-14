import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';

/**
 * Carrega a empresa pelo id.
 * @throws DomainError COMPANY_NOT_FOUND
 */
export async function requireCompany(
    companies: ICompanyProfileRepository,
    id: string,
): Promise<CompanyProfileEntity> {
    const company = await companies.findById(id);
    if (!company) throw new DomainError(ErrorCode.COMPANY_NOT_FOUND, 'Empresa não encontrada');
    return company;
}
