import { nextCnpj } from '@test/e2e/support/fixtures.js';

/** Corpo válido de criação ou edição de empresa, com CNPJ único. */
export function companyPayload(overrides: Record<string, unknown> = {}) {
    return {
        name: 'Padaria Pão Quente',
        socialReason: 'Padaria Pão Quente LTDA',
        cnpj: nextCnpj(),
        openingDate: '2020-05-01',
        cnae: '1091-1/02',
        taxRegime: 'Simples Nacional',
        email: 'contato@padaria.com',
        phone: '11999990000',
        address: {
            zipCode: '01310-100',
            street: 'Av. Paulista',
            number: '1000',
            complement: 'Sala 2',
            neighborhood: 'Bela Vista',
            city: 'São Paulo',
            state: 'sp',
        },
        ...overrides,
    };
}
