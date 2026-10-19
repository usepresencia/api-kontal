import { SaveCompanyLogoService } from '@/application/companies/save-company-logo.service.js';
import type { ICompanyLogoStorage } from '@/domain/companies/company-logo-storage.port.js';
import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import { companyDataFixture } from '@test/support/company-data.js';

const companies = {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    list: vi.fn(),
} satisfies ICompanyProfileRepository;
const storage = { signUpload: vi.fn(), isOwnLogoUrl: vi.fn() } satisfies ICompanyLogoStorage;
const service = new SaveCompanyLogoService(companies, storage);
const url = 'https://res.cloudinary.com/demo/image/upload/v1/kontal/companies/c1/logo.png';

beforeEach(() => {
    companies.findById
        .mockReset()
        .mockResolvedValue(CompanyProfileEntity.create({ id: 'c1', ...companyDataFixture }));
    companies.update.mockReset().mockResolvedValue(undefined);
    storage.isOwnLogoUrl.mockReset().mockReturnValue(true);
});

describe('SaveCompanyLogoService', () => {
    it('grava a URL do logo da própria empresa', async () => {
        const company = await service.execute('c1', url);
        expect(company.logoUrl).toBe(url);
        expect(storage.isOwnLogoUrl).toHaveBeenCalledWith('c1', url);
        expect(companies.update).toHaveBeenCalledWith(company);
    });

    it('URL que não é o logo da empresa lança LOGO_URL_INVALID sem tocar no banco', async () => {
        storage.isOwnLogoUrl.mockReturnValue(false);
        await expect(service.execute('c1', url)).rejects.toMatchObject({
            code: 'LOGO_URL_INVALID',
        });
        expect(companies.findById).not.toHaveBeenCalled();
        expect(companies.update).not.toHaveBeenCalled();
    });

    it('empresa inexistente lança COMPANY_NOT_FOUND', async () => {
        companies.findById.mockResolvedValue(null);
        await expect(service.execute('c1', url)).rejects.toMatchObject({
            code: 'COMPANY_NOT_FOUND',
        });
    });

    it('propaga MEDIA_NOT_CONFIGURED do armazenamento', async () => {
        const unconfigured = Object.assign(new Error('x'), { code: 'MEDIA_NOT_CONFIGURED' });
        storage.isOwnLogoUrl.mockImplementation(() => {
            throw unconfigured;
        });
        await expect(service.execute('c1', url)).rejects.toBe(unconfigured);
    });
});
