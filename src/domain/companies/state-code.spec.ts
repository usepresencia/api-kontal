import {
    BRAZILIAN_STATES,
    isValidStateCode,
    normalizeStateCode,
} from '@/domain/companies/state-code.js';

describe('state code', () => {
    it('normaliza para maiúsculas sem espaços', () => {
        expect(normalizeStateCode(' sp ')).toBe('SP');
    });

    it('lista as 27 unidades da federação', () => {
        expect(BRAZILIAN_STATES).toHaveLength(27);
    });

    it.each(['SP', 'sp', ' rj ', 'DF', 'TO'])('aceita %j', uf => {
        expect(isValidStateCode(uf)).toBe(true);
    });

    it.each(['', 'S', 'SPP', 'XX', 'São Paulo', '12'])('rejeita %j', uf => {
        expect(isValidStateCode(uf)).toBe(false);
    });
});
