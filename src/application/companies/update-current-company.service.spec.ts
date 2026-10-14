import { UpdateCurrentCompanyService } from '@/application/companies/update-current-company.service.js';
import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { companyDataFixture } from '@test/support/company-data.js';

const companies = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
} satisfies ICompanyProfileRepository;
const service = new UpdateCurrentCompanyService(companies);

beforeEach(() => {
    companies.findById.mockReset();
    companies.update.mockReset().mockResolvedValue(undefined);
});

describe('UpdateCurrentCompanyService', () => {
    it('aplica as alterações, persiste e devolve a empresa atualizada', async () => {
        companies.findById.mockResolvedValue(
            CompanyProfileEntity.create({ id: 'c1', ...companyDataFixture }),
        );
        const updated = await service.execute('c1', { ...companyDataFixture, name: 'Novo Nome' });
        expect(updated).toMatchObject({ id: 'c1', name: 'Novo Nome' });
        expect(companies.update).toHaveBeenCalledWith(updated);
    });

    it('dados inválidos não chegam ao repositório', async () => {
        companies.findById.mockResolvedValue(
            CompanyProfileEntity.create({ id: 'c1', ...companyDataFixture }),
        );
        await expect(
            service.execute('c1', { ...companyDataFixture, email: 'x' }),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
        expect(companies.update).not.toHaveBeenCalled();
    });

    it('empresa inexistente lança COMPANY_NOT_FOUND', async () => {
        companies.findById.mockResolvedValue(null);
        await expect(service.execute('x', companyDataFixture)).rejects.toMatchObject({
            code: 'COMPANY_NOT_FOUND',
        });
    });
});
