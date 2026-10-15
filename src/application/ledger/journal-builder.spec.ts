import {
    creationJournal,
    reversalJournal,
    settlementJournal,
} from '@/application/ledger/journal-builder.js';
import { creationLines } from '@/domain/ledger/posting.policy.js';
import { journalFixture, titleFixture } from '@test/support/ledger-fakes.js';

describe('creationJournal', () => {
    it('receita: D a receber / C receita, na data de emissão, referenciando o título', () => {
        const title = titleFixture();
        const journal = creationJournal(title);
        expect(journal).toMatchObject({
            companyId: 'c1',
            referenceType: 'TITLE_CREATION',
            referenceId: 't1',
            date: title.issueDate,
            totalDebits: 100000,
            totalCredits: 100000,
        });
        expect(journal.lines.map(l => [l.accountId, l.debit, l.credit])).toEqual([
            ['ar', 100000, 0],
            ['rev', 0, 100000],
        ]);
        expect(journal.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('despesa: D despesa / C a pagar', () => {
        const journal = creationJournal(
            titleFixture({ type: 'EXPENSE', controlAccountId: 'ap', resultAccountId: 'exp' }),
        );
        expect(journal.lines.map(l => [l.accountId, l.debit, l.credit])).toEqual([
            ['exp', 100000, 0],
            ['ap', 0, 100000],
        ]);
    });
});

describe('reversalJournal', () => {
    const original = journalFixture(
        'TITLE_CREATION',
        't1',
        creationLines(
            { type: 'INCOME', controlAccountId: 'ar', resultAccountId: 'rev' },
            100000,
            'Venda',
        ),
        new Date('2026-12-05T00:00:00.000Z'),
    );

    it('inverte as linhas e usa a data mais tardia entre o evento e o original', () => {
        const journal = reversalJournal({
            original,
            referenceType: 'TITLE_CANCELLATION',
            referenceId: 't1',
            eventDate: new Date('2026-10-14T00:00:00.000Z'),
            description: 'cancelamento',
        });
        expect(journal.date).toEqual(new Date('2026-12-05T00:00:00.000Z'));
        expect(journal.referenceType).toBe('TITLE_CANCELLATION');
        expect(journal.lines.map(l => [l.accountId, l.debit, l.credit])).toEqual([
            ['ar', 0, 100000],
            ['rev', 100000, 0],
        ]);
    });

    it('evento depois do original usa a data do evento', () => {
        const journal = reversalJournal({
            original,
            referenceType: 'TITLE_CANCELLATION',
            referenceId: 't1',
            eventDate: new Date('2027-01-10T00:00:00.000Z'),
            description: 'cancelamento',
        });
        expect(journal.date).toEqual(new Date('2027-01-10T00:00:00.000Z'));
    });
});

describe('settlementJournal', () => {
    it('monta o lançamento da baixa com a referência da baixa', () => {
        const journal = settlementJournal({
            title: titleFixture(),
            entryId: 'e1',
            date: new Date('2026-10-10T00:00:00.000Z'),
            description: 'Baixa',
            lines: [
                { accountId: 'bank', debit: 100, credit: 0, memo: '' },
                { accountId: 'ar', debit: 0, credit: 100, memo: '' },
            ],
        });
        expect(journal).toMatchObject({
            referenceType: 'SETTLEMENT',
            referenceId: 'e1',
            companyId: 'c1',
            totalDebits: 100,
        });
    });
});
