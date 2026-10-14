import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const data = {
    name: ' Padaria Pão Quente ',
    socialReason: 'Padaria Pão Quente LTDA',
    cnpj: '11.222.333/0001-81',
    openingDate: new Date('2020-05-01T00:00:00.000Z'),
    cnae: '1091-1/02',
    taxRegime: 'Simples Nacional',
    email: ' Contato@Padaria.com ',
    phone: '+55 11 99999-0000',
    address: {
        zipCode: '01310-100',
        street: 'Av. Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'sp',
    },
};

const create = (overrides: Record<string, unknown> = {}) =>
    CompanyProfileEntity.create({ id: 'c1', ...data, ...overrides });

describe('CompanyProfileEntity.create', () => {
    it('normaliza CNPJ, e-mail, nome e endereço e começa ativa e sem logo', () => {
        const company = create();
        expect(company).toMatchObject({
            id: 'c1',
            name: 'Padaria Pão Quente',
            cnpj: '11222333000181',
            email: 'contato@padaria.com',
            logoUrl: null,
            isActive: true,
        });
        expect(company.address).toMatchObject({
            zipCode: '01310100',
            state: 'SP',
            complement: null,
        });
    });

    it.each([
        ['CNPJ inválido', { cnpj: '11222333000182' }],
        ['e-mail inválido', { email: 'sem-arroba' }],
        ['nome vazio', { name: '  ' }],
        ['razão social vazia', { socialReason: '' }],
        ['CNAE vazio', { cnae: '' }],
        ['regime tributário vazio', { taxRegime: '' }],
        ['telefone vazio', { phone: '' }],
        ['telefone acima de 20 caracteres', { phone: '1'.repeat(21) }],
        ['CEP inválido', { address: { ...data.address, zipCode: '123' } }],
        ['UF inválida', { address: { ...data.address, state: 'XX' } }],
        ['logradouro vazio', { address: { ...data.address, street: '' } }],
    ])('rejeita %s com DomainError VALIDATION_ERROR', (_label, overrides) => {
        expect(() => create(overrides)).toThrow(DomainError);
        expect(() => create(overrides)).toThrow(
            expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        );
    });

    it('guarda o complemento quando informado', () => {
        const company = create({ address: { ...data.address, complement: ' Sala 2 ' } });
        expect(company.address.complement).toBe('Sala 2');
    });
});

describe('CompanyProfileEntity: alterações', () => {
    it('withChanges revalida e preserva id, logo, status e criação', () => {
        const original = create().withLogo('https://x/logo.png');
        const changed = original.withChanges({ ...data, name: 'Padaria Nova' });
        expect(changed).toMatchObject({
            id: 'c1',
            name: 'Padaria Nova',
            logoUrl: 'https://x/logo.png',
            isActive: true,
            createdAt: original.createdAt,
        });
        expect(() => original.withChanges({ ...data, email: 'x' })).toThrow(DomainError);
    });

    it('withLogo define e remove o logo', () => {
        expect(create().withLogo('https://x/logo.png').logoUrl).toBe('https://x/logo.png');
        expect(create().withLogo('https://x/logo.png').withLogo(null).logoUrl).toBeNull();
    });

    it('deactivate marca como inativa sem mexer no resto', () => {
        const inactive = create().deactivate();
        expect(inactive.isActive).toBe(false);
        expect(inactive.cnpj).toBe('11222333000181');
    });
});

describe('CompanyProfileEntity.fromPersistence', () => {
    it('reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const company = CompanyProfileEntity.fromPersistence({
            id: 'c9',
            name: 'X',
            socialReason: 'X LTDA',
            cnpj: '11222333000181',
            openingDate: new Date('2020-01-01'),
            cnae: '1',
            taxRegime: 'MEI',
            email: 'a@b.com',
            phone: '1',
            logoUrl: null,
            isActive: false,
            createdAt,
            address: {
                zipCode: '01310100',
                street: 'Rua',
                number: '1',
                complement: null,
                neighborhood: 'B',
                city: 'C',
                state: 'SP',
            },
        });
        expect(company.isActive).toBe(false);
        expect(company.createdAt).toBe(createdAt);
        expect(company.address.city).toBe('C');
    });
});
