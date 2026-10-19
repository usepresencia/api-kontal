import { ClosePeriodService } from '@/application/ledger/periods/close-period.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';
import { bankRef, fakeClock, fakeUow } from '@test/support/ledger-fakes.js';
import { fakeReportAccounts, reportAccount } from '@test/support/report-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const failing = (promise: Promise<unknown>, code: string) =>
    expect(promise).rejects.toMatchObject({ code });

function setup(clock: { today(): Date } = fakeClock) {
    const { uow, tx } = fakeUow();
    const plans = fakePlans();
    const reportAccounts = fakeReportAccounts();
    tx.periods.lockCompany.mockResolvedValue({ closedThrough: null });
    tx.journal.earliestDate.mockResolvedValue(day('2026-03-10'));
    plans.findById.mockResolvedValue(planFixture);
    plans.findDefault.mockResolvedValue(planFixture);
    reportAccounts.list.mockResolvedValue([
        reportAccount('rev', '3.1', AccountNature.REVENUE),
        reportAccount('exp', '4.1', AccountNature.EXPENSE),
        reportAccount('ret', '2.1', AccountNature.EQUITY),
    ]);
    return { tx, plans, service: new ClosePeriodService(uow, clock, plans, reportAccounts) };
}

describe('ClosePeriodService: meses comuns', () => {
    it('fecha o mês do lançamento mais antigo: grava o fechamento e a trava, sem lançamento', async () => {
        const { tx, service } = setup();
        const row = await service.execute('c1', { month: '2026-03' });
        expect(tx.periods.lockCompany).toHaveBeenCalledWith('c1');
        expect(row).toMatchObject({
            companyId: 'c1',
            throughDate: day('2026-03-31'),
            closingEntryId: null,
        });
        expect(tx.periods.insert).toHaveBeenCalledWith(row);
        expect(tx.periods.setClosedThrough).toHaveBeenCalledWith('c1', day('2026-03-31'));
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('depois do primeiro, só o mês seguinte ao último fechado', async () => {
        const { tx, service } = setup();
        tx.periods.lockCompany.mockResolvedValue({ closedThrough: day('2026-03-31') });
        await service.execute('c1', { month: '2026-04' });
        await failing(service.execute('c1', { month: '2026-06' }), 'PERIOD_CLOSING_INVALID');
        expect(tx.periods.insert).toHaveBeenCalledTimes(1);
    });

    it('mês corrente, primeiro mês errado e conta de lucros fora de dezembro são recusados sem gravar', async () => {
        const { tx, service } = setup();
        await failing(service.execute('c1', { month: '2026-10' }), 'PERIOD_CLOSING_INVALID');
        await failing(service.execute('c1', { month: '2026-04' }), 'PERIOD_CLOSING_INVALID');
        await failing(
            service.execute('c1', { month: '2026-03', retainedEarningsAccountId: 'ret' }),
            'PERIOD_CLOSING_INVALID',
        );
        expect(tx.periods.insert).not.toHaveBeenCalled();
        expect(tx.periods.setClosedThrough).not.toHaveBeenCalled();
    });

    it('empresa inexistente responde COMPANY_NOT_FOUND', async () => {
        const { tx, service } = setup();
        tx.periods.lockCompany.mockResolvedValue(null);
        await failing(service.execute('c1', { month: '2026-03' }), 'COMPANY_NOT_FOUND');
    });

    it('sem lançamentos qualquer mês encerrado pode ser o primeiro', async () => {
        const { tx, service } = setup();
        tx.journal.earliestDate.mockResolvedValue(null);
        await service.execute('c1', { month: '2026-07' });
        expect(tx.periods.setClosedThrough).toHaveBeenCalledWith('c1', day('2026-07-31'));
    });
});

describe('ClosePeriodService: dezembro e apuração', () => {
    const later = { today: () => day('2027-02-10') };
    const retRef = {
        ...bankRef,
        id: 'ret',
        accountType: AccountType.ANALYTIC,
        nature: AccountNature.EQUITY,
    };

    function december() {
        const ctx = setup(later);
        ctx.tx.periods.lockCompany.mockResolvedValue({ closedThrough: day('2026-11-30') });
        ctx.tx.accounts.findRefs.mockResolvedValue([retRef]);
        ctx.tx.periods.resultBalances.mockResolvedValue([
            { accountId: 'rev', debit: 0, credit: 100000 },
            { accountId: 'exp', debit: 40000, credit: 0 },
        ]);
        return ctx;
    }

    it('grava a apuração em 31/12 referenciando o fechamento e guarda o id do lançamento', async () => {
        const { tx, service } = december();
        const row = await service.execute('c1', {
            month: '2026-12',
            retainedEarningsAccountId: 'ret',
        });
        expect(tx.periods.resultBalances).toHaveBeenCalledWith(
            'c1',
            'p1',
            day('2026-01-01'),
            day('2026-12-31'),
        );
        const [[entry]] = tx.journal.writeAll.mock.calls[0];
        expect(entry).toMatchObject({
            referenceType: 'CLOSING',
            referenceId: row.id,
            date: day('2026-12-31'),
        });
        expect(
            entry.lines.map((line: { accountId: string; debit: number; credit: number }) => [
                line.accountId,
                line.debit,
                line.credit,
            ]),
        ).toEqual([
            ['rev', 100000, 0],
            ['exp', 0, 40000],
            ['ret', 0, 60000],
        ]);
        expect(row.closingEntryId).toBe(entry.id);
        expect(tx.periods.setClosedThrough).toHaveBeenCalledWith('c1', day('2026-12-31'));
    });

    it('ano sem resultado fecha sem lançamento', async () => {
        const { tx, service } = december();
        tx.periods.resultBalances.mockResolvedValue([]);
        const row = await service.execute('c1', {
            month: '2026-12',
            retainedEarningsAccountId: 'ret',
        });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
        expect(row.closingEntryId).toBeNull();
    });

    it('sem a conta, com conta inválida ou sem plano padrão, nada é gravado', async () => {
        const { tx, plans, service } = december();
        await failing(
            service.execute('c1', { month: '2026-12' }),
            'RETAINED_EARNINGS_ACCOUNT_INVALID',
        );
        tx.accounts.findRefs.mockResolvedValue([{ ...retRef, nature: AccountNature.ASSET }]);
        await failing(
            service.execute('c1', { month: '2026-12', retainedEarningsAccountId: 'ret' }),
            'RETAINED_EARNINGS_ACCOUNT_INVALID',
        );
        tx.accounts.findRefs.mockResolvedValue([retRef]);
        plans.findDefault.mockResolvedValue(null);
        await failing(
            service.execute('c1', { month: '2026-12', retainedEarningsAccountId: 'ret' }),
            'BILLING_PLAN_REQUIRED',
        );
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
        expect(tx.periods.insert).not.toHaveBeenCalled();
    });

    it('usa o plano informado quando há mais de um', async () => {
        const { tx, plans, service } = december();
        await service.execute('c1', {
            month: '2026-12',
            retainedEarningsAccountId: 'ret',
            billingPlanId: 'p1',
        });
        expect(plans.findById).toHaveBeenCalledWith('c1', 'p1');
        expect(tx.periods.resultBalances).toHaveBeenCalledWith(
            'c1',
            'p1',
            expect.any(Date),
            expect.any(Date),
        );
    });
});
