import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { postJournal, seedReportPlan } from '@test/e2e/support/report-fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('repositório do fechamento (Postgres real)', () => {
    it('menor data de lançamento, saldos de resultado sem apuração e ciclo do fechamento', async () => {
        const a = await seedReportPlan(db(), 'A');
        const b = await seedReportPlan(db(), 'B');
        const { bank, sales, admin } = a.accounts;
        await postJournal(db(), a.company.id, '2026-03-10', [
            [bank, '10.00', '0'],
            [sales, '0', '10.00'],
        ]);
        await postJournal(db(), a.company.id, '2026-05-02', [
            [admin, '4.00', '0'],
            [bank, '0', '4.00'],
        ]);
        await postJournal(db(), a.company.id, '2027-01-02', [
            [bank, '1.00', '0'],
            [sales, '0', '1.00'],
        ]);
        await postJournal(db(), b.company.id, '2026-01-01', [
            [b.accounts.bank, '99.00', '0'],
            [b.accounts.sales, '0', '99.00'],
        ]);
        const closing = JournalEntryEntity.create({
            id: crypto.randomUUID(),
            companyId: a.company.id,
            date: day('2026-12-31'),
            description: 'Apuração',
            referenceType: 'CLOSING',
            referenceId: 'cl1',
            lines: [
                { accountId: sales, debit: 10000, credit: 0, memo: '' },
                { accountId: admin, debit: 0, credit: 10000, memo: '' },
            ],
        });
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        await uow.run(tx => tx.journal.writeAll([closing]));

        await uow.run(async tx => {
            expect(await tx.journal.earliestDate(a.company.id)).toEqual(day('2026-03-10'));
            const balances = await tx.periods.resultBalances(
                a.company.id,
                a.plan.id,
                day('2026-01-01'),
                day('2026-12-31'),
            );
            expect(balances.sort((x, y) => x.accountId.localeCompare(y.accountId))).toEqual(
                [
                    { accountId: sales, debit: 0, credit: 1000 },
                    { accountId: admin, debit: 400, credit: 0 },
                ].sort((x, y) => x.accountId.localeCompare(y.accountId)),
            );

            const company = await tx.periods.lockCompany(a.company.id);
            expect(company).toEqual({ closedThrough: null });
            const row = {
                id: crypto.randomUUID(),
                companyId: a.company.id,
                throughDate: day('2026-03-31'),
                closingEntryId: null,
                createdAt: new Date(),
            };
            await tx.periods.insert(row);
            await tx.periods.setClosedThrough(a.company.id, row.throughDate);
            expect((await tx.periods.latest(a.company.id))?.id).toBe(row.id);
            await tx.periods.delete(row.id);
            await tx.periods.setClosedThrough(a.company.id, null);
            expect(await tx.periods.latest(a.company.id)).toBeNull();
        });
        expect(
            await uow.run(tx => tx.periods.lockCompany('00000000-0000-4000-8000-000000000000')),
        ).toBeNull();
        expect(
            (await db().company.findUniqueOrThrow({ where: { id: a.company.id } })).closedThrough,
        ).toBeNull();
    });
});
