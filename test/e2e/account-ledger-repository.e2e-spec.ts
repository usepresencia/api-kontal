import type { IAccountLedgerRepository } from '@/domain/repositories/account-ledger.repository.interface.js';
import { ACCOUNT_LEDGER_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { postJournal, seedReportPlan } from '@test/e2e/support/report-fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('razão da conta (Postgres real)', () => {
    it('saldo acumulado por janela antes da paginação, totais, dias e contrapartidas', async () => {
        const a = await seedReportPlan(db(), 'A');
        const { bank, sales, admin } = a.accounts;
        await postJournal(db(), a.company.id, '2026-09-30', [
            [bank, '10.00', '0'],
            [sales, '0', '10.00'],
        ]);
        await postJournal(db(), a.company.id, '2026-10-01', [
            [bank, '5.00', '0'],
            [sales, '0', '5.00'],
        ]);
        await postJournal(db(), a.company.id, '2026-10-01', [
            [admin, '2.00', '0'],
            [bank, '0', '2.00'],
        ]);
        await postJournal(db(), a.company.id, '2026-10-20', [
            [bank, '1.00', '0'],
            [sales, '0', '1.00'],
        ]);
        const repo = resolve<IAccountLedgerRepository>(ACCOUNT_LEDGER_REPOSITORY);
        const range = [day('2026-10-01'), day('2026-10-31')] as const;
        await expect(repo.totals(a.company.id, [bank], ...range)).resolves.toEqual({
            openingDebit: 1000,
            openingCredit: 0,
            debit: 600,
            credit: 200,
        });
        const second = await repo.items(a.company.id, [bank], ...range, { page: 2, pageSize: 2 });
        expect(second.total).toBe(3);
        expect(second.items.map(item => [item.debit, item.credit, item.running])).toEqual([
            [100, 0, 400],
        ]);
        expect(second.items[0].counterparts).toEqual([{ code: '3.1', name: 'Conta 3.1' }]);
        await expect(repo.days(a.company.id, [bank], ...range)).resolves.toEqual([
            { date: day('2026-10-01'), debit: 500, credit: 200 },
            { date: day('2026-10-20'), debit: 100, credit: 0 },
        ]);
        const both = await repo.totals(a.company.id, [bank, sales], ...range);
        expect(both).toEqual({ openingDebit: 1000, openingCredit: 1000, debit: 600, credit: 800 });
    });
});
