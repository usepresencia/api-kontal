import { DeleteTitleService } from '@/application/ledger/titles/delete-title.service.js';
import { creationLines } from '@/domain/ledger/posting.policy.js';
import { fakeClock, fakeUow, journalFixture, titleFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new DeleteTitleService(uow, fakeClock);
const original = (date: Date) =>
    journalFixture(
        'TITLE_CREATION',
        't1',
        creationLines(
            { type: 'INCOME', controlAccountId: 'ar', resultAccountId: 'rev' },
            100000,
            'Venda',
        ),
        date,
    );

beforeEach(() => {
    tx.titles.lock.mockReset().mockResolvedValue(titleFixture());
    tx.titles.countEntries.mockReset().mockResolvedValue(0);
    tx.titles.deleteAll.mockReset();
    tx.journal.find.mockReset().mockResolvedValue(original(new Date('2026-10-01T00:00:00.000Z')));
    tx.journal.writeAll.mockReset();
});

describe('DeleteTitleService', () => {
    it('posta o estorno da criação na data de hoje e exclui o título', async () => {
        await service.execute('c1', 't1');
        expect(tx.journal.find).toHaveBeenCalledWith('TITLE_CREATION', 't1');
        const [[reversals]] = tx.journal.writeAll.mock.calls;
        expect(reversals).toHaveLength(1);
        expect(reversals[0]).toMatchObject({
            referenceType: 'TITLE_CANCELLATION',
            referenceId: 't1',
            date: new Date('2026-10-14T00:00:00.000Z'),
        });
        expect(
            reversals[0].lines.map((l: { accountId: string; debit: number; credit: number }) => [
                l.accountId,
                l.debit,
                l.credit,
            ]),
        ).toEqual([
            ['ar', 0, 100000],
            ['rev', 100000, 0],
        ]);
        expect(tx.titles.deleteAll).toHaveBeenCalledWith(['t1']);
    });

    it('título com competência futura estorna na data do lançamento original', async () => {
        tx.journal.find.mockResolvedValue(original(new Date('2027-06-05T00:00:00.000Z')));
        await service.execute('c1', 't1');
        expect(tx.journal.writeAll.mock.calls[0][0][0].date).toEqual(
            new Date('2027-06-05T00:00:00.000Z'),
        );
    });

    it('título com baixas lança TITLE_HAS_ENTRIES e não grava nada', async () => {
        tx.titles.countEntries.mockResolvedValue(2);
        await expect(service.execute('c1', 't1')).rejects.toMatchObject({
            code: 'TITLE_HAS_ENTRIES',
        });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
        expect(tx.titles.deleteAll).not.toHaveBeenCalled();
    });

    it('título de outra empresa lança TITLE_NOT_FOUND', async () => {
        tx.titles.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({ code: 'TITLE_NOT_FOUND' });
    });

    it('lançamento de criação ausente é erro interno e não exclui', async () => {
        tx.journal.find.mockResolvedValue(null);
        await expect(service.execute('c1', 't1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(tx.titles.deleteAll).not.toHaveBeenCalled();
    });
});
