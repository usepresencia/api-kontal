import { ListEntriesService } from '@/application/ledger/entries/list-entries.service.js';
import { fakeEntryRead, fakeTitleRead } from '@test/support/ledger-fakes.js';

const entries = fakeEntryRead();
const titles = fakeTitleRead();
const service = new ListEntriesService(entries, titles);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const page = { items: [], page: 1, pageSize: 10, total: 0 };

beforeEach(() => {
    entries.list.mockReset().mockResolvedValue(page);
    titles.find.mockReset();
});

describe('ListEntriesService: período de pagamento', () => {
    it('repassa o filtro quando o período é válido ou tem um limite só', async () => {
        const filter = { paidFrom: day('2026-10-01'), paidTo: day('2026-10-31') };
        await expect(service.execute('c1', filter, { page: 1, pageSize: 10 })).resolves.toBe(page);
        expect(entries.list).toHaveBeenCalledWith('c1', filter, { page: 1, pageSize: 10 });
        await service.execute('c1', { paidFrom: day('2026-10-01') }, { page: 1, pageSize: 10 });
        await service.execute('c1', { paidTo: day('2026-10-01') }, { page: 1, pageSize: 10 });
        await service.execute(
            'c1',
            { paidFrom: day('2026-10-01'), paidTo: day('2026-10-01') },
            { page: 1, pageSize: 10 },
        );
        expect(entries.list).toHaveBeenCalledTimes(4);
    });

    it('início depois do fim lança DATE_RANGE_INVALID sem consultar', async () => {
        await expect(
            service.execute(
                'c1',
                { paidFrom: day('2026-11-01'), paidTo: day('2026-10-01') },
                { page: 1, pageSize: 10 },
            ),
        ).rejects.toMatchObject({ code: 'DATE_RANGE_INVALID' });
        expect(entries.list).not.toHaveBeenCalled();
    });
});
