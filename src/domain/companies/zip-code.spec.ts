import { isValidZipCode, normalizeZipCode } from '@/domain/companies/zip-code.js';

describe('zip code', () => {
    it('normaliza para só dígitos', () => {
        expect(normalizeZipCode('01310-100')).toBe('01310100');
    });

    it.each(['01310100', '01310-100', ' 01310-100 '])('aceita %j', zip => {
        expect(isValidZipCode(zip)).toBe(true);
    });

    it.each(['', '1310100', '013101000', 'abcdefgh', '01310-10a'])('rejeita %j', zip => {
        expect(isValidZipCode(zip)).toBe(false);
    });
});
