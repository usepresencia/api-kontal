import { appendCnpjCheckDigits, isValidCnpj, normalizeCnpj } from '@/domain/companies/cnpj.js';

describe('normalizeCnpj', () => {
    it('remove tudo que não é dígito', () => {
        expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181');
    });
});

describe('isValidCnpj', () => {
    it.each([
        ['sem pontuação', '11222333000181'],
        ['com pontuação', '11.222.333/0001-81'],
        ['primeiro dígito verificador zero', '00000007000103'],
        ['segundo dígito verificador zero', '00000002000180'],
    ])('aceita CNPJ válido %s', (_label, cnpj) => {
        expect(isValidCnpj(cnpj)).toBe(true);
    });

    it.each([
        ['primeiro dígito errado', '11222333000191'],
        ['segundo dígito errado', '11222333000182'],
        ['dígitos repetidos', '11111111111111'],
        ['curto demais', '1122233300018'],
        ['longo demais', '112223330001811'],
        ['vazio', ''],
        ['só letras', 'abcdefghijklmn'],
    ])('rejeita CNPJ inválido: %s', (_label, cnpj) => {
        expect(isValidCnpj(cnpj)).toBe(false);
    });
});

describe('appendCnpjCheckDigits', () => {
    it('completa a base de 12 dígitos com os verificadores', () => {
        expect(appendCnpjCheckDigits('112223330001')).toBe('11222333000181');
    });

    it('gera CNPJs que passam na validação', () => {
        for (const base of ['000000010001', '000000020001', '123456780001']) {
            expect(isValidCnpj(appendCnpjCheckDigits(base))).toBe(true);
        }
    });
});
