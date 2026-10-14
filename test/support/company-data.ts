import type { CompanyData } from '@/domain/entities/company-profile.entity.js';

export const companyDataFixture: CompanyData = {
    name: 'Padaria Pão Quente',
    socialReason: 'Padaria Pão Quente LTDA',
    cnpj: '11.222.333/0001-81',
    openingDate: new Date('2020-05-01T00:00:00.000Z'),
    cnae: '1091-1/02',
    taxRegime: 'Simples Nacional',
    email: 'contato@padaria.com',
    phone: '11999990000',
    address: {
        zipCode: '01310-100',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
    },
};
