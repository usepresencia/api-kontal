import {
    closingJournal,
    closingReversalJournal,
    creationJournal,
    manualJournal,
    manualReversalJournal,
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

describe('manualJournal', () => {
    it('cria o lançamento MANUAL com referência ao próprio id', () => {
        const entry = manualJournal({
            companyId: 'c1',
            date: new Date('2026-10-10T00:00:00.000Z'),
            description: 'Aporte de capital',
            lines: [
                { accountId: 'bank', debit: 1000, credit: 0, memo: '' },
                { accountId: 'capital', debit: 0, credit: 1000, memo: '' },
            ],
        });
        expect(entry).toMatchObject({
            companyId: 'c1',
            referenceType: 'MANUAL',
            referenceId: entry.id,
            description: 'Aporte de capital',
            totalDebits: 1000,
        });
    });
});

describe('manualReversalJournal', () => {
    const original = journalFixture(
        'MANUAL',
        'm1',
        [
            { accountId: 'bank', debit: 1000, credit: 0, memo: 'x' },
            { accountId: 'capital', debit: 0, credit: 1000, memo: 'x' },
        ],
        new Date('2026-10-01T00:00:00.000Z'),
    );

    it('inverte as linhas, aponta para o original e usa a data mais tardia entre hoje e a do original', () => {
        const today = new Date('2026-10-14T00:00:00.000Z');
        const reversal = manualReversalJournal({ original, today });
        expect(reversal).toMatchObject({
            referenceType: 'MANUAL_REVERSAL',
            referenceId: original.id,
            date: today,
            description: 'Estorno: original',
        });
        expect(reversal.lines.map(line => [line.accountId, line.debit, line.credit])).toEqual([
            ['bank', 0, 1000],
            ['capital', 1000, 0],
        ]);
        const early = manualReversalJournal({
            original,
            today: new Date('2026-09-01T00:00:00.000Z'),
            description: 'Correção',
        });
        expect(early.date).toEqual(original.date);
        expect(early.description).toBe('Correção');
    });
});

describe('closingJournal e closingReversalJournal', () => {
    const lines = [
        { accountId: 'rev', debit: 100000, credit: 0, memo: 'Apuração' },
        { accountId: 'exp', debit: 0, credit: 40000, memo: 'Apuração' },
        { accountId: 'ret', debit: 0, credit: 60000, memo: 'Apuração' },
    ];

    it('closingJournal cria o lançamento CLOSING referenciando o fechamento, na data informada', () => {
        const entry = closingJournal({
            companyId: 'c1',
            closingId: 'cl1',
            date: new Date('2026-12-31T00:00:00.000Z'),
            lines,
        });
        expect(entry).toMatchObject({
            companyId: 'c1',
            referenceType: 'CLOSING',
            referenceId: 'cl1',
            description: 'Apuração do resultado do exercício',
            totalDebits: 100000,
        });
        expect(entry.date).toEqual(new Date('2026-12-31T00:00:00.000Z'));
    });

    it('closingReversalJournal inverte as linhas na mesma data, com o mesmo fechamento como referência', () => {
        const original = closingJournal({
            companyId: 'c1',
            closingId: 'cl1',
            date: new Date('2026-12-31T00:00:00.000Z'),
            lines,
        });
        const reversal = closingReversalJournal(original);
        expect(reversal).toMatchObject({ referenceType: 'CLOSING_REVERSAL', referenceId: 'cl1' });
        expect(reversal.date).toEqual(original.date);
        expect(reversal.lines.map(line => [line.accountId, line.debit, line.credit])).toEqual([
            ['rev', 0, 100000],
            ['exp', 40000, 0],
            ['ret', 60000, 0],
        ]);
    });
});
