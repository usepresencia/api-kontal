import { toJournalResponse } from '@/presentation/ledger/journal.mapper.js';
import { journalFixture, journalViewFixture } from '@test/support/ledger-fakes.js';

describe('toJournalResponse', () => {
    it('devolve número, valores em texto, débitos antes dos créditos e conta com código e nome', () => {
        const entry = journalFixture(
            'SETTLEMENT',
            'e1',
            [
                { accountId: 'ar', debit: 0, credit: 100000, memo: 'm1' },
                { accountId: 'dc', debit: 3000, credit: 0, memo: 'm2' },
                { accountId: 'bank', debit: 104000, credit: 0, memo: 'm3' },
                { accountId: 'jr', debit: 0, credit: 7000, memo: 'm4' },
            ],
            new Date('2026-10-10T00:00:00.000Z'),
        );
        const response = toJournalResponse(
            journalViewFixture(entry, {
                number: 42,
                reversedBy: 'rv',
                accounts: {
                    ar: { code: '1.2', name: 'Clientes' },
                    dc: { code: '4.2', name: 'Descontos concedidos' },
                    bank: { code: '1.1', name: 'Banco' },
                    jr: { code: '3.2', name: 'Juros recebidos' },
                },
            }),
        );
        expect(response).toMatchObject({
            id: 'j-e1',
            number: 42,
            date: '2026-10-10',
            description: 'original',
            referenceType: 'SETTLEMENT',
            referenceId: 'e1',
            totalDebits: '1070.00',
            totalCredits: '1070.00',
            reversedBy: 'rv',
        });
        expect(response.lines.map(l => [l.accountCode, l.debit, l.credit])).toEqual([
            ['1.1', '1040.00', '0.00'],
            ['4.2', '30.00', '0.00'],
            ['1.2', '0.00', '1000.00'],
            ['3.2', '0.00', '70.00'],
        ]);
        expect(response.lines[0]).toEqual({
            accountId: 'bank',
            accountCode: '1.1',
            accountName: 'Banco',
            debit: '1040.00',
            credit: '0.00',
            memo: 'm3',
        });
        expect(typeof response.createdAt).toBe('string');
    });
});
