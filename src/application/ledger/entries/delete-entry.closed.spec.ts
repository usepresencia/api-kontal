import { DeleteEntryService } from '@/application/ledger/entries/delete-entry.service.js';
import {
    entryFixture,
    fakeClock,
    fakeUow,
    journalFixture,
    titleFixture,
} from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function setup(closedThrough: Date | null) {
    const { uow, tx } = fakeUow();
    tx.entries.find.mockResolvedValue(entryFixture());
    tx.titles.lock.mockResolvedValue(titleFixture({ settledAmount: 100000 }));
    tx.entries.hasWriteOff.mockResolvedValue(false);
    tx.journal.closedThrough.mockResolvedValue(closedThrough);
    tx.journal.find.mockResolvedValue(
        journalFixture('SETTLEMENT', 'e1', [
            { accountId: 'bank', debit: 100000, credit: 0, memo: '' },
            { accountId: 'ar', debit: 0, credit: 100000, memo: '' },
        ]),
    );
    return { tx, service: new DeleteEntryService(uow, fakeClock) };
}

describe('DeleteEntryService: período fechado', () => {
    it('baixa paga até a data da trava não é excluída', async () => {
        const { tx, service } = setup(day('2026-10-10'));
        await expect(service.execute('c1', 'e1')).rejects.toMatchObject({ code: 'PERIOD_CLOSED' });
        expect(tx.entries.delete).not.toHaveBeenCalled();
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
    });

    it('baixa paga depois da trava ou sem trava é excluída e estornada', async () => {
        for (const closed of [day('2026-10-09'), null]) {
            const { tx, service } = setup(closed);
            await service.execute('c1', 'e1');
            expect(tx.entries.delete).toHaveBeenCalledWith('e1');
            expect(tx.journal.writeAll).toHaveBeenCalledTimes(1);
        }
    });
});
