import { GetDailyJournalService } from '@/application/reports/get-daily-journal.service.js';
import type { IDailyJournalRepository } from '@/domain/repositories/daily-journal.repository.interface.js';
import { fakePlans, planFixture } from '@test/support/billing-fakes.js';
import { journalFixture, journalViewFixture } from '@test/support/ledger-fakes.js';

const plans = fakePlans();
const journal = { days: vi.fn(), entriesOn: vi.fn() } satisfies IDailyJournalRepository;
const service = new GetDailyJournalService(plans, journal);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const input = {
    start: day('2026-10-01'),
    end: day('2026-10-31'),
    billingPlanId: 'p1',
    page: 1,
    pageSize: 7,
};

beforeEach(() => {
    for (const fake of [plans, journal]) for (const fn of Object.values(fake)) fn.mockReset();
    plans.findById.mockResolvedValue(planFixture);
});

describe('GetDailyJournalService', () => {
    it('lê a página de dias e só os lançamentos desses dias', async () => {
        const view = journalViewFixture(
            journalFixture(
                'MANUAL',
                'm1',
                [
                    { accountId: 'a', debit: 100, credit: 0, memo: '' },
                    { accountId: 'b', debit: 0, credit: 100, memo: '' },
                ],
                day('2026-10-02'),
            ),
        );
        journal.days.mockResolvedValue({
            items: [{ date: day('2026-10-02'), debits: 100, credits: 100 }],
            page: 1,
            pageSize: 7,
            total: 1,
        });
        journal.entriesOn.mockResolvedValue([view]);
        const result = await service.execute('c1', input);
        expect(journal.days).toHaveBeenCalledWith('c1', 'p1', input.start, input.end, {
            page: 1,
            pageSize: 7,
        });
        expect(journal.entriesOn).toHaveBeenCalledWith('c1', 'p1', [day('2026-10-02')]);
        expect(result.days).toMatchObject({ page: 1, pageSize: 7, total: 1 });
        expect(result.days.items[0].entries).toEqual([view]);
    });

    it('período invertido é recusado antes de consultar', async () => {
        await expect(
            service.execute('c1', { ...input, start: input.end, end: input.start }),
        ).rejects.toMatchObject({
            code: 'DATE_RANGE_INVALID',
        });
        expect(journal.days).not.toHaveBeenCalled();
    });
});
