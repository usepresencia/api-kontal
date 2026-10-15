import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { toCompanyResponse } from '@/presentation/companies/company.mapper.js';
import { companyDataFixture } from '@test/support/company-data.js';

describe('toCompanyResponse', () => {
    it('devolve o cadastro em camelCase, com data de abertura YYYY-MM-DD e criação em ISO', () => {
        const createdAt = new Date('2026-10-14T12:00:00.000Z');
        const company = CompanyProfileEntity.create({
            id: 'c1',
            createdAt,
            ...companyDataFixture,
        }).withLogo('https://x/logo.png');
        expect(toCompanyResponse(company)).toEqual({
            id: 'c1',
            name: 'Padaria Pão Quente',
            socialReason: 'Padaria Pão Quente LTDA',
            cnpj: '11222333000181',
            openingDate: '2020-05-01',
            cnae: '1091-1/02',
            taxRegime: 'Simples Nacional',
            email: 'contato@padaria.com',
            phone: '11999990000',
            logoUrl: 'https://x/logo.png',
            isActive: true,
            address: {
                zipCode: '01310100',
                street: 'Av. Paulista',
                number: '1000',
                complement: null,
                neighborhood: 'Bela Vista',
                city: 'São Paulo',
                state: 'SP',
            },
            createdAt: '2026-10-14T12:00:00.000Z',
        });
    });
});
