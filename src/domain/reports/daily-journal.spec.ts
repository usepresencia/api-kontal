import { assembleDays } from '@/domain/reports/daily-journal.js';
import { journalFixture, journalViewFixture } from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const lines = [
    { accountId: 'a', debit: 100, credit: 0, memo: '' },
    { accountId: 'b', debit: 0, credit: 100, memo: '' },
];

describe('assembleDays', () => {
    it('agrupa os lançamentos no dia de cada um, mantendo a ordem recebida', () => {
        const first = journalViewFixture(journalFixture('MANUAL', 'm1', lines, day('2026-10-01')), {
            number: 1,
        });
        const second = journalViewFixture(
            journalFixture('MANUAL', 'm2', lines, day('2026-10-03')),
            { number: 2 },
        );
        const third = journalViewFixture(journalFixture('MANUAL', 'm3', lines, day('2026-10-03')), {
            number: 3,
        });
        const days = assembleDays(
            [
                { date: day('2026-10-01'), debits: 100, credits: 100 },
                { date: day('2026-10-03'), debits: 200, credits: 200 },
            ],
            [first, second, third],
        );
        expect(days.map(item => [item.debits, item.entries.map(view => view.number)])).toEqual([
            [100, [1]],
            [200, [2, 3]],
        ]);
    });

    it('dia sem lançamentos carregados fica com lista vazia', () => {
        expect(
            assembleDays([{ date: day('2026-10-01'), debits: 0, credits: 0 }], [])[0].entries,
        ).toEqual([]);
    });
});
