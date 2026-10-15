import { GetJournalEntryService } from '@/application/ledger/journal/get-journal-entry.service.js';
import { ListJournalEntriesService } from '@/application/ledger/journal/list-journal-entries.service.js';
import { fakeJournalRead, journalFixture, journalViewFixture } from '@test/support/ledger-fakes.js';

const reads = fakeJournalRead();
const view = journalViewFixture(
    journalFixture('TITLE_CREATION', 't1', [
        { accountId: 'a', debit: 100, credit: 0, memo: '' },
        { accountId: 'b', debit: 0, credit: 100, memo: '' },
    ]),
);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeEach(() => {
    reads.find.mockReset();
    reads.list.mockReset();
});

describe('GetJournalEntryService', () => {
    it('devolve o lançamento da empresa ou JOURNAL_ENTRY_NOT_FOUND', async () => {
        const service = new GetJournalEntryService(reads);
        reads.find.mockResolvedValueOnce(view);
        await expect(service.execute('c1', 'j1')).resolves.toBe(view);
        expect(reads.find).toHaveBeenCalledWith('c1', 'j1');
        reads.find.mockResolvedValueOnce(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({
            code: 'JOURNAL_ENTRY_NOT_FOUND',
        });
    });
});

describe('ListJournalEntriesService', () => {
    const page = { items: [view], page: 1, pageSize: 10, total: 1 };
    const service = new ListJournalEntriesService(reads);

    it('repassa empresa, filtro e página; aceita um limite só', async () => {
        reads.list.mockResolvedValue(page);
        await expect(
            service.execute('c1', { from: day('2026-10-01') }, { page: 1, pageSize: 10 }),
        ).resolves.toBe(page);
        await expect(
            service.execute('c1', { to: day('2026-10-01') }, { page: 1, pageSize: 10 }),
        ).resolves.toBe(page);
        expect(reads.list).toHaveBeenCalledWith(
            'c1',
            { to: day('2026-10-01') },
            { page: 1, pageSize: 10 },
        );
    });

    it('período invertido lança DATE_RANGE_INVALID sem consultar', async () => {
        await expect(
            service.execute(
                'c1',
                { from: day('2026-11-01'), to: day('2026-10-01') },
                { page: 1, pageSize: 10 },
            ),
        ).rejects.toMatchObject({ code: 'DATE_RANGE_INVALID' });
        expect(reads.list).not.toHaveBeenCalled();
    });
});
