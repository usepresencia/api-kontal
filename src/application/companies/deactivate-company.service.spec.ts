import { DeactivateCompanyService } from '@/application/companies/deactivate-company.service.js';
import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { companyDataFixture } from '@test/support/company-data.js';

const companies = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
} satisfies ICompanyProfileRepository;
const service = new DeactivateCompanyService(companies);

beforeEach(() => {
    companies.findById.mockReset();
    companies.update.mockReset().mockResolvedValue(undefined);
});

describe('DeactivateCompanyService', () => {
    it('desativa a empresa e persiste', async () => {
        companies.findById.mockResolvedValue(
            CompanyProfileEntity.create({ id: 'c1', ...companyDataFixture }),
        );
        await service.execute('c1');
        expect(companies.update).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'c1', isActive: false }),
        );
    });

    it('empresa inexistente lança COMPANY_NOT_FOUND', async () => {
        companies.findById.mockResolvedValue(null);
        await expect(service.execute('x')).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
        expect(companies.update).not.toHaveBeenCalled();
    });
});
