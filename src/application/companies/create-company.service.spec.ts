import { CreateCompanyService } from '@/application/companies/create-company.service.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { companyDataFixture } from '@test/support/company-data.js';

const companies = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
} satisfies ICompanyProfileRepository;
const service = new CreateCompanyService(companies);

beforeEach(() => {
    companies.create.mockReset().mockResolvedValue(undefined);
});

describe('CreateCompanyService', () => {
    it('cria a empresa normalizada com um id novo e a persiste', async () => {
        const profile = await service.execute(companyDataFixture);
        expect(profile.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(profile.cnpj).toBe('11222333000181');
        expect(profile.address.zipCode).toBe('01310100');
        expect(companies.create).toHaveBeenCalledWith(profile);
    });

    it('dados inválidos não chegam ao repositório', async () => {
        await expect(service.execute({ ...companyDataFixture, cnpj: '123' })).rejects.toMatchObject(
            {
                code: 'VALIDATION_ERROR',
            },
        );
        expect(companies.create).not.toHaveBeenCalled();
    });

    it('propaga o erro de CNPJ duplicado do repositório', async () => {
        const conflict = Object.assign(new Error('dup'), { code: 'CNPJ_ALREADY_REGISTERED' });
        companies.create.mockRejectedValue(conflict);
        await expect(service.execute(companyDataFixture)).rejects.toBe(conflict);
    });
});
