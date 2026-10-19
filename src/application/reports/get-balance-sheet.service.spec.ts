import { GetBalanceSheetService } from '@/application/reports/get-balance-sheet.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';
import { fakeLedgerTotals, fakeReportAccounts, reportAccount } from '@test/support/report-fakes.js';

const plans = fakePlans();
const accounts = fakeReportAccounts();
const totals = fakeLedgerTotals();
const service = new GetBalanceSheetService(plans, accounts, totals);
const date = new Date('2026-10-31T00:00:00.000Z');

beforeEach(() => {
    for (const fake of [plans, accounts, totals])
        for (const fn of Object.values(fake)) fn.mockReset();
    plans.findDefault.mockResolvedValue(planFixture);
    accounts.list.mockResolvedValue([
        reportAccount('bank', '1.1', AccountNature.ASSET),
        reportAccount('capital', '5.1', AccountNature.EQUITY),
    ]);
    totals.balancesUntil.mockResolvedValue([
        { accountId: 'bank', debit: 1000, credit: 0 },
        { accountId: 'capital', debit: 0, credit: 1000 },
    ]);
});

describe('GetBalanceSheetService', () => {
    it('usa o plano padrão e os saldos acumulados até a data', async () => {
        const result = await service.execute('c1', { date });
        expect(totals.balancesUntil).toHaveBeenCalledWith('c1', planFixture.id, date);
        expect(accounts.list).toHaveBeenCalledWith('c1', planFixture.id);
        expect(result).toMatchObject({ billingPlanId: planFixture.id, date });
        expect(result.sheet.assets.total).toBe(1000);
        expect(result.sheet.liabilitiesAndEquity).toBe(1000);
    });
});
