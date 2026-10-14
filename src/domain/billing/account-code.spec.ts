import { MAX_ACCOUNT_LEVEL, nextAccountCode, toSortKey } from '@/domain/billing/account-code.js';

describe('nextAccountCode', () => {
    it('conta raiz sem irmãos começa em 1', () => {
        expect(nextAccountCode(null, 1, [])).toBe('1');
    });

    it('conta raiz usa o maior sufixo + 1', () => {
        expect(nextAccountCode(null, 1, ['1', '2', '3'])).toBe('4');
    });

    it('filha herda o código do pai (níveis 2 e 3 sem preenchimento)', () => {
        expect(nextAccountCode('1', 2, [])).toBe('1.1');
        expect(nextAccountCode('1', 2, ['1.1'])).toBe('1.2');
        expect(nextAccountCode('1.2', 3, ['1.2.1', '1.2.2'])).toBe('1.2.3');
    });

    it('níveis 4 e 5 usam 3 dígitos', () => {
        expect(nextAccountCode('1.2.3', 4, [])).toBe('1.2.3.001');
        expect(nextAccountCode('1.2.3', 4, ['1.2.3.001'])).toBe('1.2.3.002');
        expect(nextAccountCode('1.2.3.001', 5, [])).toBe('1.2.3.001.001');
    });

    it('depois de uma exclusão usa o maior sufixo, não a contagem', () => {
        expect(nextAccountCode('1', 2, ['1.1', '1.3'])).toBe('1.4');
    });

    it('compara sufixos como números (1.10 vem depois de 1.9)', () => {
        expect(nextAccountCode('1', 2, ['1.2', '1.10', '1.9'])).toBe('1.11');
    });

    it('o limite de níveis é 5', () => {
        expect(MAX_ACCOUNT_LEVEL).toBe(5);
    });
});

describe('toSortKey', () => {
    it('ordena códigos como números por segmento', () => {
        const codes = ['1.10', '1.2', '1', '1.2.1', '2', '1.9'];
        const sorted = [...codes].sort((a, b) => (toSortKey(a) < toSortKey(b) ? -1 : 1));
        expect(sorted).toEqual(['1', '1.2', '1.2.1', '1.9', '1.10', '2']);
    });

    it('preenche cada segmento com zeros à esquerda', () => {
        expect(toSortKey('1.2.3.001')).toBe('000000001.000000002.000000003.000000001');
    });
});
