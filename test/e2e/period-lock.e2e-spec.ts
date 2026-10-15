import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { seedReportPlan } from '@test/e2e/support/report-fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const entry = (
    companyId: string,
    bank: string,
    sales: string,
    date: string,
    referenceType: 'MANUAL' | 'CLOSING',
) =>
    JournalEntryEntity.create({
        id: crypto.randomUUID(),
        companyId,
        date: day(date),
        description: 'Teste',
        referenceType,
        referenceId: crypto.randomUUID(),
        lines: [
            { accountId: bank, debit: 100, credit: 0, memo: '' },
            { accountId: sales, debit: 0, credit: 100, memo: '' },
        ],
    });

describe('trava de período no razão (Postgres real)', () => {
    it('recusa data até a trava, aceita depois, e isenta a apuração', async () => {
        const { company, accounts } = await seedReportPlan(db());
        await db().company.update({
            where: { id: company.id },
            data: { closedThrough: day('2026-09-30') },
        });
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        const write = (date: string, type: 'MANUAL' | 'CLOSING') =>
            uow.run(tx =>
                tx.journal.writeAll([entry(company.id, accounts.bank, accounts.sales, date, type)]),
            );

        await expect(write('2026-09-30', 'MANUAL')).rejects.toMatchObject({
            code: 'PERIOD_CLOSED',
        });
        await expect(write('2026-01-01', 'MANUAL')).rejects.toMatchObject({
            code: 'PERIOD_CLOSED',
        });
        expect(await db().journalEntry.count()).toBe(0);
        await write('2026-10-01', 'MANUAL');
        await write('2026-09-30', 'CLOSING');
        expect(await db().journalEntry.count()).toBe(2);
    });

    it('a trava de uma empresa não afeta a outra', async () => {
        const a = await seedReportPlan(db(), 'A');
        const b = await seedReportPlan(db(), 'B');
        await db().company.update({
            where: { id: a.company.id },
            data: { closedThrough: day('2026-09-30') },
        });
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        await uow.run(tx =>
            tx.journal.writeAll([
                entry(b.company.id, b.accounts.bank, b.accounts.sales, '2026-01-15', 'MANUAL'),
            ]),
        );
        expect(await db().journalEntry.count({ where: { companyId: b.company.id } })).toBe(1);
    });

    it('lê a trava da empresa', async () => {
        const { company } = await seedReportPlan(db());
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        expect(await uow.run(tx => tx.journal.closedThrough(company.id))).toBeNull();
        await db().company.update({
            where: { id: company.id },
            data: { closedThrough: day('2026-09-30') },
        });
        expect(await uow.run(tx => tx.journal.closedThrough(company.id))).toEqual(
            day('2026-09-30'),
        );
    });
});
