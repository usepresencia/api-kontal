import { sided } from '@/domain/reports/sided.js';

describe('sided', () => {
    it.each([
        [1500, { amount: 1500, side: 'D' }],
        [0, { amount: 0, side: 'D' }],
        [-1500, { amount: 1500, side: 'C' }],
    ])('saldo bruto %i → %j', (raw, expected) => {
        expect(sided(raw)).toEqual(expected);
    });
});
