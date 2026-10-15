import { GetTrialBalanceService } from '@/application/reports/get-trial-balance.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';
import { fakeLedgerTotals, fakeReportAccounts, reportAccount } from '@test/support/report-fakes.js';

const plans = fakePlans();
const accounts = fakeReportAccounts();
const totals = fakeLedgerTotals();
const service = new GetTrialBalanceService(plans, accounts, totals);
const start = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-10-31T00:00:00.000Z');

beforeEach(() => {
    for (const fake of [plans, accounts, totals])
        for (const fn of Object.values(fake)) fn.mockReset();
    plans.findById.mockResolvedValue(planFixture);
    accounts.list.mockResolvedValue([
        reportAccount('bank', '1.1', AccountNature.ASSET),
        reportAccount('sales', '3.1', AccountNature.REVENUE),
    ]);
    totals.trialBalance.mockResolvedValue([
        { accountId: 'bank', openingDebit: 0, openingCredit: 0, debit: 700, credit: 0 },
        { accountId: 'sales', openingDebit: 0, openingCredit: 0, debit: 0, credit: 700 },
    ]);
});

describe('GetTrialBalanceService', () => {
    it('monta o balancete do plano com as contas e a agregação do período', async () => {
        const result = await service.execute('c1', {
            start,
            end,
            billingPlanId: 'p1',
            maxLevel: 2,
        });
        expect(accounts.list).toHaveBeenCalledWith('c1', 'p1');
        expect(totals.trialBalance).toHaveBeenCalledWith('c1', 'p1', start, end);
        expect(result).toMatchObject({ billingPlanId: 'p1', start, end });
        expect(result.report.totals).toMatchObject({ debits: 700, credits: 700 });
        expect(result.report.lines).toHaveLength(2);
    });

    it('período invertido é recusado antes de qualquer consulta', async () => {
        await expect(service.execute('c1', { start: end, end: start })).rejects.toMatchObject({
            code: 'DATE_RANGE_INVALID',
        });
        expect(totals.trialBalance).not.toHaveBeenCalled();
    });
});
