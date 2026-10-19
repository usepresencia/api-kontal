import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    LEDGER_TOTALS_REPOSITORY,
    LEDGER_UNIT_OF_WORK,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { postJournal, seedReportPlan } from '@test/e2e/support/report-fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('relatórios e lançamentos de apuração (Postgres real)', () => {
    it('o DRE não vê a apuração; o balancete e o balanço veem', async () => {
        const { company, plan, accounts } = await seedReportPlan(db());
        const { bank, sales, admin } = accounts;
        await postJournal(db(), company.id, '2026-12-10', [
            [bank, '10.00', '0'],
            [sales, '0', '10.00'],
        ]);
        await postJournal(db(), company.id, '2026-12-15', [
            [admin, '4.00', '0'],
            [bank, '0', '4.00'],
        ]);
        const closing = JournalEntryEntity.create({
            id: crypto.randomUUID(),
            companyId: company.id,
            date: day('2026-12-31'),
            description: 'Apuração',
            referenceType: 'CLOSING',
            referenceId: crypto.randomUUID(),
            lines: [
                { accountId: sales, debit: 1000, credit: 0, memo: '' },
                { accountId: admin, debit: 0, credit: 400, memo: '' },
                { accountId: bank, debit: 0, credit: 600, memo: '' },
            ],
        });
        await resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK).run(tx =>
            tx.journal.writeAll([closing]),
        );
        const totals = resolve<ILedgerTotalsRepository>(LEDGER_TOTALS_REPOSITORY);
        const range = [day('2026-01-01'), day('2026-12-31')] as const;

        const movements = await totals.monthlyMovements(company.id, plan.id, ...range);
        expect(movements.find(item => item.accountId === sales)).toEqual({
            accountId: sales,
            month: '2026-12',
            debit: 0,
            credit: 1000,
        });
        expect(movements.find(item => item.accountId === admin)).toEqual({
            accountId: admin,
            month: '2026-12',
            debit: 400,
            credit: 0,
        });

        const trial = await totals.trialBalance(company.id, plan.id, ...range);
        expect(trial.find(item => item.accountId === sales)).toMatchObject({
            debit: 1000,
            credit: 1000,
        });
        const balances = await totals.balancesUntil(company.id, plan.id, day('2026-12-31'));
        expect(balances.find(item => item.accountId === sales)).toEqual({
            accountId: sales,
            debit: 1000,
            credit: 1000,
        });
    });
});
