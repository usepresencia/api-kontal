import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';

describe('JournalRefType', () => {
    it('inclui os lançamentos automáticos e os manuais', () => {
        expect(Object.values(JournalRefType)).toEqual([
            'TITLE_CREATION',
            'TITLE_CANCELLATION',
            'SETTLEMENT',
            'SETTLEMENT_REVERSAL',
            'MANUAL',
            'MANUAL_REVERSAL',
            'CLOSING',
            'CLOSING_REVERSAL',
        ]);
    });
});
