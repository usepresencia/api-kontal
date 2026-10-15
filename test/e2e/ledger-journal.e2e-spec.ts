import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { db, resolve } = useTestApp();
const date = new Date('2026-10-14T00:00:00.000Z');

async function seed() {
    const company = await createCompanyFixture(db(), { name: 'Empresa' });
    const plan = await createPlanFixture(db(), company.id);
    const root = await createAccountFixture(db(), { billingPlanId: plan.id, code: '1', level: 1 });
    const a = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        parentId: root.id,
        code: '1.1',
        level: 2,
        accountType: 'ANALYTIC',
    });
    const b = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        parentId: root.id,
        code: '1.2',
        level: 2,
        accountType: 'ANALYTIC',
    });
    return { company, a, b };
}
const entry = (companyId: string, a: string, b: string, referenceId: string) =>
    JournalEntryEntity.create({
        id: crypto.randomUUID(),
        companyId,
        date,
        description: 'Teste',
        referenceType: 'TITLE_CREATION',
        referenceId,
        lines: [
            { accountId: a, debit: 150050, credit: 0, memo: 'D' },
            { accountId: b, debit: 0, credit: 150050, memo: 'C' },
        ],
    });

describe('unidade de trabalho do razão (Postgres real)', () => {
    it('grava lançamentos e linhas em lote e lê de volta pela referência', async () => {
        const { company, a, b } = await seed();
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        await uow.run(tx =>
            tx.journal.writeAll([
                entry(company.id, a.id, b.id, 'r1'),
                entry(company.id, a.id, b.id, 'r2'),
            ]),
        );
        const found = await uow.run(tx => tx.journal.find('TITLE_CREATION', 'r1'));
        expect(found).toMatchObject({
            referenceId: 'r1',
            totalDebits: 150050,
            totalCredits: 150050,
        });
        expect(found?.lines).toHaveLength(2);
        expect(await db().journalEntry.count()).toBe(2);
    });

    it('reverte tudo quando a função falha depois de gravar', async () => {
        const { company, a, b } = await seed();
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        await expect(
            uow.run(async tx => {
                await tx.journal.writeAll([entry(company.id, a.id, b.id, 'r1')]);
                throw new Error('falhou depois de gravar');
            }),
        ).rejects.toThrow('falhou depois de gravar');
        expect(await db().journalEntry.count()).toBe(0);
        expect(await db().journalLine.count()).toBe(0);
    });

    it('referência repetida responde CONFLICT e não deixa nada pela metade', async () => {
        const { company, a, b } = await seed();
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        await uow.run(tx => tx.journal.writeAll([entry(company.id, a.id, b.id, 'dup')]));
        await expect(
            uow.run(tx =>
                tx.journal.writeAll([
                    entry(company.id, a.id, b.id, 'novo'),
                    entry(company.id, a.id, b.id, 'dup'),
                ]),
            ),
        ).rejects.toMatchObject({ code: 'CONFLICT' });
        expect(await db().journalEntry.count()).toBe(1);
    });

    it('lê o preset e as referências de contas da empresa dentro da transação', async () => {
        const { company, a } = await seed();
        const preset = await db().preset.create({
            data: {
                billingPlanId: (await db().billingPlan.findFirstOrThrow()).id,
                name: 'P',
                accounts: { create: [{ role: 'receivable', accountId: a.id }] },
            },
        });
        const uow = resolve<ILedgerUnitOfWork>(LEDGER_UNIT_OF_WORK);
        const found = await uow.run(tx => tx.presets.find(company.id, preset.id));
        expect(found?.accounts.receivable).toBe(a.id);
        expect(
            await uow.run(tx => tx.presets.find('00000000-0000-4000-8000-000000000000', preset.id)),
        ).toBeNull();
        const refs = await uow.run(tx => tx.accounts.findRefs(company.id, [a.id]));
        expect(refs).toEqual([
            {
                id: a.id,
                billingPlanId: preset.billingPlanId,
                accountType: 'ANALYTIC',
                nature: 'ASSET',
                isActive: true,
            },
        ]);
    });
});
