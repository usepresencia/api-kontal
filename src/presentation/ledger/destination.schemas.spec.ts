import { createSeriesSchema } from '@/presentation/ledger/series.schemas.js';
import { createTitleSchema } from '@/presentation/ledger/title.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const title = {
    partyId: uuid,
    presetId: uuid,
    type: 'EXPENSE',
    description: 'Compra',
    amount: '10.00',
    expirationDate: '2026-11-30',
};
const series = {
    kind: 'INSTALLMENT',
    partyId: uuid,
    presetId: uuid,
    type: 'EXPENSE',
    description: 'Máquina',
    amount: '10.00',
    expirationDate: '2026-11-30',
    count: 2,
};

describe('destinationAccountId nos schemas', () => {
    it('é opcional e UUID no título e na série', () => {
        expect(createTitleSchema.parse(title).destinationAccountId).toBeUndefined();
        expect(
            createTitleSchema.parse({ ...title, destinationAccountId: uuid }).destinationAccountId,
        ).toBe(uuid);
        expect(createTitleSchema.safeParse({ ...title, destinationAccountId: 'x' }).success).toBe(
            false,
        );
        expect(
            createSeriesSchema.parse({ ...series, destinationAccountId: uuid })
                .destinationAccountId,
        ).toBe(uuid);
        expect(createSeriesSchema.safeParse({ ...series, destinationAccountId: 'x' }).success).toBe(
            false,
        );
    });
});
