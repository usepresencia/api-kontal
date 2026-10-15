import { TitleEntity } from '@/domain/entities/title.entity.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const base = {
    id: 't1',
    companyId: 'c1',
    presetId: 'pr1',
    accounts: { controlAccountId: 'ar', resultAccountId: 'open' },
    type: 'INCOME' as const,
    description: 'Cliente antigo',
    amount: 100000,
    today: day('2026-10-14'),
    expirationDate: day('2026-12-01'),
};

describe('TitleEntity.create: implantação', () => {
    it('grava a data, o pago anterior, o saldo em aberto e emite na data de implantação', () => {
        const title = TitleEntity.create({
            ...base,
            opening: { openingDate: day('2026-10-01'), settledAmount: 40000 },
        });
        expect(title).toMatchObject({
            isOpening: true,
            status: 'OPEN',
            settledAmount: 40000,
            remainingAmount: 60000,
        });
        expect(title.openingDate).toEqual(day('2026-10-01'));
        expect(title.issueDate).toEqual(day('2026-10-01'));
        expect(title.paymentFloorDate).toEqual(day('2026-10-01'));
    });

    it('mantém a emissão original informada', () => {
        const title = TitleEntity.create({
            ...base,
            issueDate: day('2026-01-10'),
            opening: { openingDate: day('2026-10-01'), settledAmount: 0 },
        });
        expect(title.issueDate).toEqual(day('2026-01-10'));
        expect(title.paymentFloorDate).toEqual(day('2026-10-01'));
    });

    it('título comum segue sem implantação', () => {
        const title = TitleEntity.create(base);
        expect(title).toMatchObject({ isOpening: false, settledAmount: 0 });
        expect(title.openingDate).toBeNull();
    });
});
