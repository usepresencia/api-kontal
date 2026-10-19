import { GetCurrentCompanyService } from '@/application/companies/get-current-company.service.js';
import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { companyDataFixture } from '@test/support/company-data.js';

const companies = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
} satisfies ICompanyProfileRepository;
const service = new GetCurrentCompanyService(companies);

describe('GetCurrentCompanyService', () => {
    it('devolve a empresa', async () => {
        const profile = CompanyProfileEntity.create({ id: 'c1', ...companyDataFixture });
        companies.findById.mockResolvedValue(profile);
        await expect(service.execute('c1')).resolves.toBe(profile);
    });

    it('empresa inexistente lança COMPANY_NOT_FOUND', async () => {
        companies.findById.mockResolvedValue(null);
        await expect(service.execute('x')).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    });
});
