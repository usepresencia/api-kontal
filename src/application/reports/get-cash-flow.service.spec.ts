import { GetCashFlowService } from '@/application/reports/get-cash-flow.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import type { ICashFlowRepository } from '@/domain/repositories/cash-flow.repository.interface.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';
import { fakeReportAccounts, reportAccount } from '@test/support/report-fakes.js';

const plans = fakePlans();
const accounts = fakeReportAccounts();
const cash = { totals: vi.fn(), payments: vi.fn() } satisfies ICashFlowRepository;
const service = new GetCashFlowService(plans, accounts, cash);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const start = day('2026-10-01');
const end = day('2026-10-31');

beforeEach(() => {
    for (const fake of [plans, accounts, cash])
        for (const fn of Object.values(fake)) fn.mockReset();
    plans.findById.mockResolvedValue(planFixture);
    accounts.list.mockResolvedValue([reportAccount('bank', '1.1', AccountNature.ASSET)]);
    cash.totals.mockResolvedValue([
        { accountId: 'bank', bucket: '2026-10-05', type: 'INCOME', amount: 61500 },
    ]);
    cash.payments.mockResolvedValue([]);
});

describe('GetCashFlowService', () => {
    it('sem agrupamento lê só a agregação e devolve totais e contas', async () => {
        const result = await service.execute('c1', { start, end, billingPlanId: 'p1' });
        expect(cash.totals).toHaveBeenCalledWith('c1', 'p1', start, end, undefined);
        expect(cash.payments).not.toHaveBeenCalled();
        expect(result.report.totals.net).toBe(61500);
        expect(result.days).toBeNull();
    });

    it('groupBy=month não lê pagamentos', async () => {
        const result = await service.execute('c1', {
            start,
            end,
            billingPlanId: 'p1',
            groupBy: 'month',
        });
        expect(cash.payments).not.toHaveBeenCalled();
        expect(result.report.buckets).toHaveLength(1);
        expect(result.days).toBeNull();
    });

    it('groupBy=day lê os pagamentos e anexa a cada dia', async () => {
        cash.payments.mockResolvedValue([
            {
                entryId: 'e1',
                titleId: 't1',
                titleDescription: 'Venda',
                type: 'INCOME',
                accountId: 'bank',
                accountCode: '1.1',
                accountName: 'Banco',
                paymentMethod: 'PIX',
                paidAt: day('2026-10-05'),
                amount: 61500,
            },
        ]);
        const result = await service.execute('c1', {
            start,
            end,
            billingPlanId: 'p1',
            groupBy: 'day',
        });
        expect(cash.payments).toHaveBeenCalledWith('c1', 'p1', start, end);
        expect(result.days?.[0].payments).toHaveLength(1);
    });

    it('período invertido é recusado; groupBy=day aceita até 366 dias', async () => {
        await expect(service.execute('c1', { start: end, end: start })).rejects.toMatchObject({
            code: 'DATE_RANGE_INVALID',
        });
        await expect(
            service.execute('c1', {
                start: day('2026-01-01'),
                end: day('2027-01-02'),
                billingPlanId: 'p1',
                groupBy: 'day',
            }),
        ).rejects.toMatchObject({ code: 'DATE_RANGE_INVALID' });
        await expect(
            service.execute('c1', {
                start: day('2026-01-01'),
                end: day('2026-12-31'),
                billingPlanId: 'p1',
                groupBy: 'day',
            }),
        ).resolves.toBeDefined();
        await expect(
            service.execute('c1', {
                start: day('2020-01-01'),
                end: day('2026-12-31'),
                billingPlanId: 'p1',
                groupBy: 'month',
            }),
        ).resolves.toBeDefined();
        expect(cash.totals).toHaveBeenCalledTimes(2);
    });
});
