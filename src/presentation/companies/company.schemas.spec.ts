import { companyBodySchema, saveLogoSchema } from '@/presentation/companies/company.schemas.js';

const valid = {
    name: ' Padaria ',
    socialReason: 'Padaria LTDA',
    cnpj: '11.222.333/0001-81',
    openingDate: '2020-05-01',
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
        state: 'sp',
    },
};

describe('companyBodySchema', () => {
    it('aceita um corpo válido, apara textos e converte a data de abertura para Date UTC', () => {
        const parsed = companyBodySchema.parse(valid);
        expect(parsed.name).toBe('Padaria');
        expect(parsed.openingDate).toEqual(new Date('2020-05-01T00:00:00.000Z'));
        expect(parsed.address.complement).toBeUndefined();
    });

    it('aceita complemento nulo ou preenchido', () => {
        expect(
            companyBodySchema.safeParse({
                ...valid,
                address: { ...valid.address, complement: null },
            }).success,
        ).toBe(true);
        expect(
            companyBodySchema.safeParse({
                ...valid,
                address: { ...valid.address, complement: 'Sala 2' },
            }).success,
        ).toBe(true);
    });

    it.each([
        ['CNPJ com dígito verificador errado', { cnpj: '11.222.333/0001-82' }],
        ['CNPJ de dígitos repetidos', { cnpj: '11111111111111' }],
        ['e-mail inválido', { email: 'sem-arroba' }],
        ['data em formato brasileiro', { openingDate: '01/05/2020' }],
        ['data inexistente', { openingDate: '2020-13-45' }],
        ['nome vazio', { name: '  ' }],
        ['telefone acima de 20 caracteres', { phone: '1'.repeat(21) }],
        ['CEP inválido', { address: { ...valid.address, zipCode: '123' } }],
        ['UF inválida', { address: { ...valid.address, state: 'XX' } }],
        ['logradouro vazio', { address: { ...valid.address, street: '' } }],
    ])('rejeita %s', (_label, overrides) => {
        expect(companyBodySchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
    });

    it('rejeita corpo sem endereço', () => {
        const { address: _address, ...withoutAddress } = valid;
        expect(companyBodySchema.safeParse(withoutAddress).success).toBe(false);
    });
});

describe('saveLogoSchema', () => {
    it('aceita uma URL', () => {
        expect(
            saveLogoSchema.safeParse({ url: 'https://res.cloudinary.com/x/y.png' }).success,
        ).toBe(true);
    });

    it.each([[{}], [{ url: 'não é url' }], [{ url: '' }], [{ url: 123 }]])('rejeita %j', body => {
        expect(saveLogoSchema.safeParse(body).success).toBe(false);
    });
});
