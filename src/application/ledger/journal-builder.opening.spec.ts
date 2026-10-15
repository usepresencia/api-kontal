import { creationJournal } from '@/application/ledger/journal-builder.js';
import { titleFixture } from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('creationJournal: título de implantação', () => {
    it('receita: D a receber / C saldos iniciais pelo saldo em aberto, na data de implantação', () => {
        const title = titleFixture({
            resultAccountId: 'open',
            amount: 100000,
            settledAmount: 40000,
            isOpening: true,
            openingDate: day('2026-10-05'),
        });
        const journal = creationJournal(title);
        expect(journal.date).toEqual(day('2026-10-05'));
        expect(journal.totalDebits).toBe(60000);
        expect(journal.lines.map(line => [line.accountId, line.debit, line.credit])).toEqual([
            ['ar', 60000, 0],
            ['open', 0, 60000],
        ]);
    });

    it('despesa: D saldos iniciais / C a pagar', () => {
        const title = titleFixture({
            type: 'EXPENSE',
            controlAccountId: 'ap',
            resultAccountId: 'open',
            amount: 30000,
            isOpening: true,
            openingDate: day('2026-10-05'),
        });
        expect(
            creationJournal(title).lines.map(line => [line.accountId, line.debit, line.credit]),
        ).toEqual([
            ['open', 30000, 0],
            ['ap', 0, 30000],
        ]);
    });

    it('título comum continua na data de emissão pelo valor total', () => {
        const journal = creationJournal(titleFixture());
        expect(journal.date).toEqual(day('2026-10-01'));
        expect(journal.totalDebits).toBe(100000);
    });
});
