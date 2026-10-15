import { GetDreService } from '@/application/reports/get-dre.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';
import { fakeLedgerTotals, fakeReportAccounts, reportAccount } from '@test/support/report-fakes.js';

const plans = fakePlans();
const accounts = fakeReportAccounts();
const totals = fakeLedgerTotals();
const service = new GetDreService(plans, accounts, totals);
const start = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-10-31T00:00:00.000Z');

beforeEach(() => {
    for (const fake of [plans, accounts, totals])
        for (const fn of Object.values(fake)) fn.mockReset();
    plans.findById.mockResolvedValue(planFixture);
    accounts.list.mockResolvedValue([reportAccount('rev', '3.1', AccountNature.REVENUE)]);
    totals.monthlyMovements.mockResolvedValue([
        { accountId: 'rev', month: '2026-10', debit: 0, credit: 5000 },
    ]);
});

describe('GetDreService', () => {
    it('monta o DRE do plano a partir das contas e das somas mensais do período', async () => {
        const result = await service.execute('c1', { start, end, billingPlanId: 'p1' });
        expect(accounts.list).toHaveBeenCalledWith('c1', 'p1');
        expect(totals.monthlyMovements).toHaveBeenCalledWith('c1', 'p1', start, end);
        expect(result).toMatchObject({ billingPlanId: 'p1', start, end });
        expect(result.report.lines.netResult).toBe(5000);
        expect(result.report.months).toBeNull();
    });

    it('groupBy=month devolve a série mensal', async () => {
        const result = await service.execute('c1', {
            start,
            end,
            billingPlanId: 'p1',
            groupBy: 'month',
        });
        expect(result.report.months).toEqual([
            { month: '2026-10', revenues: 5000, expenses: 0, result: 5000 },
        ]);
    });

    it('período invertido é recusado antes de qualquer consulta', async () => {
        await expect(service.execute('c1', { start: end, end: start })).rejects.toMatchObject({
            code: 'DATE_RANGE_INVALID',
        });
        expect(plans.findById).not.toHaveBeenCalled();
        expect(totals.monthlyMovements).not.toHaveBeenCalled();
    });
});
