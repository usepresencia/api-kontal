import { toDailyJournalResponse } from '@/presentation/reports/daily-journal.mapper.js';
import { journalFixture, journalViewFixture } from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('toDailyJournalResponse', () => {
    it('devolve a página de dias com totais em texto e os lançamentos no formato da consulta', () => {
        const view = journalViewFixture(
            journalFixture(
                'MANUAL',
                'm1',
                [
                    { accountId: 'a', debit: 1050, credit: 0, memo: '' },
                    { accountId: 'b', debit: 0, credit: 1050, memo: '' },
                ],
                day('2026-10-02'),
            ),
            { number: 5 },
        );
        const response = toDailyJournalResponse({
            billingPlanId: 'p1',
            start: day('2026-10-01'),
            end: day('2026-10-31'),
            days: {
                items: [{ date: day('2026-10-02'), debits: 1050, credits: 1050, entries: [view] }],
                page: 1,
                pageSize: 7,
                total: 1,
            },
        });
        expect(response).toMatchObject({
            billingPlanId: 'p1',
            start: '2026-10-01',
            end: '2026-10-31',
            page: 1,
            pageSize: 7,
            total: 1,
        });
        expect(response.items[0]).toMatchObject({
            date: '2026-10-02',
            totalDebits: '10.50',
            totalCredits: '10.50',
        });
        expect(response.items[0].entries[0]).toMatchObject({ number: 5, totalDebits: '10.50' });
    });
});
