import { withoutUndefined } from '@/utils/without-undefined.js';

describe('withoutUndefined', () => {
    it('remove chaves com valor undefined e mantém null, 0 e string vazia', () => {
        expect(withoutUndefined({ a: 1, b: undefined, c: null, d: 0, e: '' })).toEqual({
            a: 1,
            c: null,
            d: 0,
            e: '',
        });
    });
});
