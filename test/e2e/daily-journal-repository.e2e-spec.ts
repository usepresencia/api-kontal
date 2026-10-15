import type { IDailyJournalRepository } from '@/domain/repositories/daily-journal.repository.interface.js';
import { DAILY_JOURNAL_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { postJournal, seedReportPlan } from '@test/e2e/support/report-fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('livro diário (Postgres real)', () => {
    it('pagina os dias com movimento do período e carrega os lançamentos em ordem de número', async () => {
        const a = await seedReportPlan(db(), 'A');
        const b = await seedReportPlan(db(), 'B');
        const { bank, sales } = a.accounts;
        await postJournal(db(), a.company.id, '2026-09-30', [
            [bank, '1.00', '0'],
            [sales, '0', '1.00'],
        ]);
        const first = await postJournal(db(), a.company.id, '2026-10-01', [
            [bank, '2.00', '0'],
            [sales, '0', '2.00'],
        ]);
        const second = await postJournal(db(), a.company.id, '2026-10-01', [
            [bank, '3.00', '0'],
            [sales, '0', '3.00'],
        ]);
        await postJournal(db(), a.company.id, '2026-10-31', [
            [bank, '4.00', '0'],
            [sales, '0', '4.00'],
        ]);
        await postJournal(db(), b.company.id, '2026-10-15', [
            [b.accounts.bank, '8.00', '0'],
            [b.accounts.sales, '0', '8.00'],
        ]);
        const repo = resolve<IDailyJournalRepository>(DAILY_JOURNAL_REPOSITORY);
        const page = await repo.days(
            a.company.id,
            a.plan.id,
            day('2026-10-01'),
            day('2026-10-31'),
            { page: 1, pageSize: 1 },
        );
        expect(page.total).toBe(2);
        expect(page.items).toEqual([{ date: day('2026-10-01'), debits: 500, credits: 500 }]);
        const entries = await repo.entriesOn(a.company.id, a.plan.id, [day('2026-10-01')]);
        expect(entries.map(view => view.entry.id)).toEqual([first.id, second.id]);
        expect(entries[0].number).toBeLessThan(entries[1].number);
        expect(entries[0].accounts[bank]).toEqual({ code: '1.1', name: 'Conta 1.1' });
    });
});
