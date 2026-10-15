import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import {
    LEDGER_TOTALS_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { db, resolve } = useTestApp();
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function seed(name: string) {
    const company = await createCompanyFixture(db(), { name });
    const plan = await createPlanFixture(db(), company.id);
    const assetRoot = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        code: '1',
        level: 1,
        nature: 'ASSET',
    });
    const bank = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        parentId: assetRoot.id,
        code: '1.1',
        level: 2,
        nature: 'ASSET',
        accountType: 'ANALYTIC',
    });
    const revenueRoot = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        code: '3',
        level: 1,
        nature: 'REVENUE',
    });
    const sales = await createAccountFixture(db(), {
        billingPlanId: plan.id,
        parentId: revenueRoot.id,
        code: '3.1',
        level: 2,
        nature: 'REVENUE',
        accountType: 'ANALYTIC',
    });
    return { company, plan, bank, sales };
}

async function sale(
    companyId: string,
    date: string,
    ref: string,
    bankId: string,
    salesId: string,
    amount: string,
) {
    await db().journalEntry.create({
        data: {
            companyId,
            date: day(date),
            referenceType: 'TITLE_CREATION',
            referenceId: ref,
            totalDebits: amount,
            totalCredits: amount,
            lines: {
                create: [
                    { accountId: bankId, debit: amount },
                    { accountId: salesId, credit: amount },
                ],
            },
        },
    });
}

describe('repositórios de relatório (Postgres real)', () => {
    it('monthlyMovements: só receitas e despesas, por mês, período inclusivo e escopo da empresa', async () => {
        const a = await seed('A');
        const b = await seed('B');
        await sale(a.company.id, '2026-09-30', 'r0', a.bank.id, a.sales.id, '1.00');
        await sale(a.company.id, '2026-10-01', 'r1', a.bank.id, a.sales.id, '2.00');
        await sale(a.company.id, '2026-10-31', 'r2', a.bank.id, a.sales.id, '4.00');
        await sale(a.company.id, '2026-11-01', 'r3', a.bank.id, a.sales.id, '8.00');
        await sale(b.company.id, '2026-10-15', 'r4', b.bank.id, b.sales.id, '16.00');
        const repo = resolve<ILedgerTotalsRepository>(LEDGER_TOTALS_REPOSITORY);
        await expect(
            repo.monthlyMovements(a.company.id, a.plan.id, day('2026-10-01'), day('2026-10-31')),
        ).resolves.toEqual([{ accountId: a.sales.id, month: '2026-10', debit: 0, credit: 600 }]);
    });

    it('trialBalance: saldo anterior (antes do início) e movimento do período de todas as naturezas', async () => {
        const a = await seed('A');
        await sale(a.company.id, '2026-09-30', 'r0', a.bank.id, a.sales.id, '1.00');
        await sale(a.company.id, '2026-10-10', 'r1', a.bank.id, a.sales.id, '2.00');
        await sale(a.company.id, '2026-11-01', 'r2', a.bank.id, a.sales.id, '4.00');
        const repo = resolve<ILedgerTotalsRepository>(LEDGER_TOTALS_REPOSITORY);
        const rows = await repo.trialBalance(
            a.company.id,
            a.plan.id,
            day('2026-10-01'),
            day('2026-10-31'),
        );
        expect(rows.sort((x, y) => x.accountId.localeCompare(y.accountId))).toEqual(
            [
                {
                    accountId: a.bank.id,
                    openingDebit: 100,
                    openingCredit: 0,
                    debit: 200,
                    credit: 0,
                },
                {
                    accountId: a.sales.id,
                    openingDebit: 0,
                    openingCredit: 100,
                    debit: 0,
                    credit: 200,
                },
            ].sort((x, y) => x.accountId.localeCompare(y.accountId)),
        );
    });

    it('balancesUntil: acumulado até a data (inclusiva) de todas as naturezas', async () => {
        const a = await seed('A');
        await sale(a.company.id, '2026-10-10', 'r1', a.bank.id, a.sales.id, '2.00');
        await sale(a.company.id, '2026-10-31', 'r2', a.bank.id, a.sales.id, '4.00');
        await sale(a.company.id, '2026-11-01', 'r3', a.bank.id, a.sales.id, '8.00');
        const repo = resolve<ILedgerTotalsRepository>(LEDGER_TOTALS_REPOSITORY);
        const rows = await repo.balancesUntil(a.company.id, a.plan.id, day('2026-10-31'));
        expect(rows.find(r => r.accountId === a.bank.id)).toEqual({
            accountId: a.bank.id,
            debit: 600,
            credit: 0,
        });
        expect(rows.find(r => r.accountId === a.sales.id)).toEqual({
            accountId: a.sales.id,
            debit: 0,
            credit: 600,
        });
    });

    it('lista as contas do plano da empresa em ordem natural e nada de outro plano', async () => {
        const a = await seed('A');
        const b = await seed('B');
        const repo = resolve<IReportAccountRepository>(REPORT_ACCOUNT_REPOSITORY);
        expect((await repo.list(a.company.id, a.plan.id)).map(x => x.code)).toEqual([
            '1',
            '1.1',
            '3',
            '3.1',
        ]);
        expect(await repo.list(a.company.id, b.plan.id)).toEqual([]);
    });
});
