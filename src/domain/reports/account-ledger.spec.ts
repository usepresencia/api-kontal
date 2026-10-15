import { ledgerBalances, ledgerDays, ledgerItems } from '@/domain/reports/account-ledger.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('ledgerBalances', () => {
    it('saldo anterior e final com lado a partir dos totais', () => {
        expect(
            ledgerBalances({ openingDebit: 1000, openingCredit: 300, debit: 200, credit: 1500 }),
        ).toEqual({
            opening: { amount: 700, side: 'D' },
            closing: { amount: 600, side: 'C' },
            openingRaw: 700,
        });
    });
});

describe('ledgerItems', () => {
    it('soma o saldo anterior ao saldo acumulado do período de cada lançamento', () => {
        const row = (number: number, debit: number, credit: number, running: number) => ({
            journalEntryId: `j${number}`,
            number,
            date: day('2026-10-01'),
            description: 'd',
            referenceType: 'MANUAL' as const,
            debit,
            credit,
            running,
            counterparts: [],
        });
        const items = ledgerItems(500, [row(1, 0, 800, -800), row(2, 400, 0, -400)]);
        expect(items.map(item => [item.number, item.balance])).toEqual([
            [1, { amount: 300, side: 'C' }],
            [2, { amount: 100, side: 'D' }],
        ]);
        expect('running' in items[0]).toBe(false);
    });
});

describe('ledgerDays', () => {
    it('acumula o saldo dia a dia a partir do saldo anterior', () => {
        expect(
            ledgerDays(100, [
                { date: day('2026-10-01'), debit: 50, credit: 0 },
                { date: day('2026-10-02'), debit: 0, credit: 300 },
            ]),
        ).toEqual([
            {
                date: day('2026-10-01'),
                debits: 50,
                credits: 0,
                balance: { amount: 150, side: 'D' },
            },
            {
                date: day('2026-10-02'),
                debits: 0,
                credits: 300,
                balance: { amount: 150, side: 'C' },
            },
        ]);
    });
});
