import { ListCompaniesService } from '@/application/companies/list-companies.service.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';

const companies = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
} satisfies ICompanyProfileRepository;

describe('ListCompaniesService', () => {
    it('repassa a página pedida ao repositório e devolve o resultado', async () => {
        const result = { items: [], page: 2, pageSize: 5, total: 0 };
        companies.list.mockResolvedValue(result);
        await expect(
            new ListCompaniesService(companies).execute({ page: 2, pageSize: 5 }),
        ).resolves.toBe(result);
        expect(companies.list).toHaveBeenCalledWith({ page: 2, pageSize: 5 });
    });
});
