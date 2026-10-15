import { GetAccountLedgerService } from '@/application/reports/get-account-ledger.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import type { IAccountLedgerRepository } from '@/domain/repositories/account-ledger.repository.interface.js';
import { accountFixture, fakeAccounts, viewFixture } from '@test/support/billing-fakes.js';
import { fakeReportAccounts, reportAccount, synthetic } from '@test/support/report-fakes.js';

const accounts = fakeAccounts();
const reportAccounts = fakeReportAccounts();
const ledger = {
    totals: vi.fn(),
    items: vi.fn(),
    days: vi.fn(),
} satisfies IAccountLedgerRepository;
const service = new GetAccountLedgerService(accounts, reportAccounts, ledger);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const input = {
    accountId: 'a1',
    start: day('2026-10-01'),
    end: day('2026-10-31'),
    page: 1,
    pageSize: 10,
};

beforeEach(() => {
    for (const fake of [accounts, reportAccounts, ledger])
        for (const fn of Object.values(fake)) fn.mockReset();
    accounts.findById.mockResolvedValue(viewFixture(accountFixture({ id: 'a1' })));
    reportAccounts.list.mockResolvedValue([
        reportAccount('a1', '1', AccountNature.ASSET, synthetic),
        reportAccount('a11', '1.1', AccountNature.ASSET, { parentId: 'a1' }),
        reportAccount('a2', '2', AccountNature.LIABILITY),
    ]);
    ledger.totals.mockResolvedValue({
        openingDebit: 1000,
        openingCredit: 0,
        debit: 500,
        credit: 200,
    });
    ledger.items.mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0 });
    ledger.days.mockResolvedValue([]);
});

describe('GetAccountLedgerService', () => {
    it('sintética soma as descendentes; padrão lista os lançamentos paginados', async () => {
        const result = await service.execute('c1', input);
        expect(reportAccounts.list).toHaveBeenCalledWith('c1', 'p1');
        const ids = ledger.totals.mock.calls[0][1] as string[];
        expect([...ids].sort()).toEqual(['a1', 'a11']);
        expect(ledger.items).toHaveBeenCalledWith('c1', ids, input.start, input.end, {
            page: 1,
            pageSize: 10,
        });
        expect(ledger.days).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            openingBalance: { amount: 1000, side: 'D' },
            closingBalance: { amount: 1300, side: 'D' },
            days: null,
        });
        expect(result.account.code).toBe('1');
    });

    it('groupBy=day devolve os dias e não pagina', async () => {
        const result = await service.execute('c1', { ...input, groupBy: 'day' });
        expect(ledger.days).toHaveBeenCalled();
        expect(ledger.items).not.toHaveBeenCalled();
        expect(result.items).toBeNull();
        expect(result.days).toEqual([]);
    });

    it('conta de outra empresa: BILLING_ACCOUNT_NOT_FOUND; período invertido: DATE_RANGE_INVALID', async () => {
        accounts.findById.mockResolvedValueOnce(null);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'BILLING_ACCOUNT_NOT_FOUND',
        });
        await expect(
            service.execute('c1', { ...input, start: input.end, end: input.start }),
        ).rejects.toMatchObject({
            code: 'DATE_RANGE_INVALID',
        });
        expect(ledger.totals).not.toHaveBeenCalled();
    });
});
