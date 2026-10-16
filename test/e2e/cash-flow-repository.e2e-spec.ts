import type { ICashFlowRepository } from '@/domain/repositories/cash-flow.repository.interface.js';
import { CASH_FLOW_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { seedLedger } from '@test/e2e/support/ledger-fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function seed(name: string) {
    const ledger = await seedLedger(db(), { name });
    const title = (type: 'INCOME' | 'EXPENSE') =>
        db().title.create({
            data: {
                companyId: ledger.company.id,
                presetId: ledger.preset.id,
                partyId: ledger.party.id,
                controlAccountId:
                    type === 'INCOME' ? ledger.accounts.receivable : ledger.accounts.payable,
                resultAccountId:
                    type === 'INCOME' ? ledger.accounts.revenue : ledger.accounts.expense,
                type,
                description: `Título ${type}`,
                amount: '1000.00',
                issueDate: day('2026-09-01'),
                expirationDate: day('2026-12-01'),
            },
        });
    const entry = (
        titleId: string,
        accountId: string | null,
        paidAt: string,
        total: string,
        kind: 'PAYMENT' | 'WRITE_OFF' = 'PAYMENT',
    ) =>
        db().entry.create({
            data: {
                titleId,
                kind,
                billingAccountId: accountId,
                principalAmount: total,
                totalAmount: total,
                paidAt: day(paidAt),
                paymentMethod: kind === 'PAYMENT' ? 'PIX' : null,
            },
        });
    return { ...ledger, title, entry };
}

describe('fluxo de caixa (Postgres real)', () => {
    it('agrega só pagamentos do plano da empresa, no período inclusivo, por conta, mês e dia', async () => {
        const a = await seed('A');
        const b = await seed('B');
        const income = await a.title('INCOME');
        const expense = await a.title('EXPENSE');
        await a.entry(income.id, a.accounts.bank, '2026-09-30', '1.00');
        await a.entry(income.id, a.accounts.bank, '2026-10-01', '2.00');
        await a.entry(expense.id, a.accounts.bank, '2026-10-31', '4.00');
        await a.entry(income.id, a.accounts.bank, '2026-11-01', '8.00');
        await a.entry(income.id, null, '2026-10-15', '16.00', 'WRITE_OFF');
        const foreign = await b.title('INCOME');
        await b.entry(foreign.id, b.accounts.bank, '2026-10-15', '32.00');
        const repo = resolve<ICashFlowRepository>(CASH_FLOW_REPOSITORY);
        const range = [day('2026-10-01'), day('2026-10-31')] as const;

        const none = await repo.totals(a.company.id, a.plan.id, ...range, undefined);
        expect(none.map(item => [item.bucket, item.type, item.amount]).sort()).toEqual([
            ['', 'EXPENSE', 400],
            ['', 'INCOME', 200],
        ]);
        const byDay = await repo.totals(a.company.id, a.plan.id, ...range, 'day');
        expect(byDay.map(item => item.bucket).sort()).toEqual(['2026-10-01', '2026-10-31']);
        const byMonth = await repo.totals(a.company.id, a.plan.id, ...range, 'month');
        expect(byMonth.every(item => item.bucket === '2026-10')).toBe(true);

        const payments = await repo.payments(a.company.id, a.plan.id, ...range);
        expect(
            payments.map(item => [item.paidAt.toISOString().slice(0, 10), item.type, item.amount]),
        ).toEqual([
            ['2026-10-01', 'INCOME', 200],
            ['2026-10-31', 'EXPENSE', 400],
        ]);
        expect(payments[0]).toMatchObject({
            accountCode: '1.1',
            titleDescription: 'Título INCOME',
            paymentMethod: 'PIX',
        });
        expect(await repo.payments(a.company.id, b.plan.id, ...range)).toEqual([]);
    });
});
