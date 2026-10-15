import { createTitleSchema } from '@/presentation/ledger/title.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const base = {
    presetId: uuid,
    type: 'INCOME',
    description: 'Cliente',
    amount: '1000.00',
    expirationDate: '2026-12-01',
};

describe('createTitleSchema: campos de implantação', () => {
    it('converte data e valor pago e os deixa opcionais', () => {
        expect(createTitleSchema.parse(base).isOpening).toBeUndefined();
        const parsed = createTitleSchema.parse({
            ...base,
            isOpening: true,
            openingDate: '2026-10-01',
            settledAmount: '400.00',
        });
        expect(parsed).toMatchObject({
            isOpening: true,
            openingDate: new Date('2026-10-01T00:00:00.000Z'),
            settledAmount: 40000,
        });
    });

    it.each([{ isOpening: 'sim' }, { openingDate: '01/10/2026' }, { settledAmount: '1.001' }])(
        'rejeita %j',
        overrides => {
            expect(createTitleSchema.safeParse({ ...base, ...overrides }).success).toBe(false);
        },
    );
});
