import { DeleteEntryService } from '@/application/ledger/entries/delete-entry.service.js';
import {
    fakeClock,
    fakeUow,
    entryFixture,
    journalFixture,
    titleFixture,
} from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new DeleteEntryService(uow, fakeClock);
const original = (date = new Date('2026-10-10T00:00:00.000Z')) =>
    journalFixture(
        'SETTLEMENT',
        'e1',
        [
            { accountId: 'bank', debit: 30000, credit: 0, memo: 'm' },
            { accountId: 'ar', debit: 0, credit: 30000, memo: 'm' },
        ],
        date,
    );
const rows = (journal: {
    lines: readonly { accountId: string; debit: number; credit: number }[];
}) => journal.lines.map(l => [l.accountId, l.debit, l.credit]);

beforeEach(() => {
    tx.entries.find.mockReset().mockResolvedValue(entryFixture());
    tx.titles.lock.mockReset().mockResolvedValue(titleFixture({ settledAmount: 30000 }));
    tx.entries.hasWriteOff.mockReset().mockResolvedValue(false);
    tx.journal.find.mockReset().mockResolvedValue(original());
    tx.entries.delete.mockReset();
    tx.titles.save.mockReset();
    tx.journal.writeAll.mockReset();
});

describe('DeleteEntryService', () => {
    it('trava o título, posta o estorno, reabre o saldo e exclui a baixa', async () => {
        await service.execute('c1', 'e1');
        expect(tx.titles.lock).toHaveBeenCalledWith('c1', 't1');
        expect(tx.journal.find).toHaveBeenCalledWith('SETTLEMENT', 'e1');
        const [[journals]] = tx.journal.writeAll.mock.calls;
        expect(journals[0]).toMatchObject({
            referenceType: 'SETTLEMENT_REVERSAL',
            referenceId: 'e1',
            date: new Date('2026-10-14T00:00:00.000Z'),
        });
        expect(rows(journals[0])).toEqual([
            ['bank', 0, 30000],
            ['ar', 30000, 0],
        ]);
        expect(tx.titles.save.mock.calls[0][0]).toMatchObject({ settledAmount: 0, status: 'OPEN' });
        expect(tx.entries.delete).toHaveBeenCalledWith('e1');
    });

    it('baixa de data futura (não ocorre, mas o original pode estar adiante) estorna na data do original', async () => {
        tx.journal.find.mockResolvedValue(original(new Date('2026-12-01T00:00:00.000Z')));
        await service.execute('c1', 'e1');
        expect(tx.journal.writeAll.mock.calls[0][0][0].date).toEqual(
            new Date('2026-12-01T00:00:00.000Z'),
        );
    });

    it('excluir a baixa por perda reabre o título pelo valor da perda', async () => {
        tx.entries.find.mockResolvedValue(
            entryFixture({
                kind: 'WRITE_OFF',
                billingAccountId: null,
                paymentMethod: null,
                principalAmount: 70000,
                totalAmount: 0,
            }),
        );
        tx.titles.lock.mockResolvedValue(
            titleFixture({ status: 'WRITTEN_OFF', settledAmount: 100000 }),
        );
        tx.journal.find.mockResolvedValue(original());
        await service.execute('c1', 'e1');
        expect(tx.titles.save.mock.calls[0][0]).toMatchObject({
            settledAmount: 30000,
            status: 'OPEN',
        });
    });

    it('excluir pagamento de título que tem baixa por perda lança ENTRY_DELETE_BLOCKED', async () => {
        tx.entries.hasWriteOff.mockResolvedValue(true);
        await expect(service.execute('c1', 'e1')).rejects.toMatchObject({
            code: 'ENTRY_DELETE_BLOCKED',
        });
        expect(tx.entries.delete).not.toHaveBeenCalled();
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('baixa de outra empresa ou inexistente lança ENTRY_NOT_FOUND', async () => {
        tx.entries.find.mockResolvedValue(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
        expect(tx.titles.lock).not.toHaveBeenCalled();
    });

    it('baixa excluída por outra requisição durante a espera do lock lança ENTRY_NOT_FOUND', async () => {
        tx.entries.find.mockResolvedValueOnce(entryFixture()).mockResolvedValueOnce(null);
        await expect(service.execute('c1', 'e1')).rejects.toMatchObject({
            code: 'ENTRY_NOT_FOUND',
        });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('lançamento da baixa ausente é erro interno e não exclui', async () => {
        tx.journal.find.mockResolvedValue(null);
        await expect(service.execute('c1', 'e1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(tx.entries.delete).not.toHaveBeenCalled();
    });
});
