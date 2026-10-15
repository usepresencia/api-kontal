import { GetEntryService } from '@/application/ledger/entries/get-entry.service.js';
import { ListEntriesService } from '@/application/ledger/entries/list-entries.service.js';
import { UpdateEntryService } from '@/application/ledger/entries/update-entry.service.js';
import {
    fakeEntryRead,
    fakeTitleRead,
    fakeUow,
    entryFixture,
    titleFixture,
} from '@test/support/ledger-fakes.js';

const reads = fakeEntryRead();
const titles = fakeTitleRead();

beforeEach(() => {
    reads.find.mockReset().mockResolvedValue({
        entry: entryFixture(),
        titleDescription: 'Venda',
        billingAccountName: 'Banco',
    });
    reads.list.mockReset();
    titles.find.mockReset().mockResolvedValue({ title: titleFixture(), presetName: 'Preset' });
});

describe('UpdateEntryService', () => {
    it('altera descrição e forma de pagamento e devolve a leitura', async () => {
        const { uow, tx } = fakeUow();
        tx.entries.find.mockResolvedValue(entryFixture());
        const view = await new UpdateEntryService(uow, reads).execute('c1', 'e1', {
            description: 'novo',
            paymentMethod: 'CASH',
        });
        expect(tx.entries.save.mock.calls[0][0]).toMatchObject({
            description: 'novo',
            paymentMethod: 'CASH',
            principalAmount: 30000,
        });
        expect(view.titleDescription).toBe('Venda');
    });

    it('baixa de outra empresa lança ENTRY_NOT_FOUND', async () => {
        const { uow, tx } = fakeUow();
        tx.entries.find.mockResolvedValue(null);
        await expect(
            new UpdateEntryService(uow, reads).execute('c1', 'x', {}),
        ).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
        expect(tx.entries.save).not.toHaveBeenCalled();
    });
});

describe('GetEntryService', () => {
    it('devolve a baixa e lança ENTRY_NOT_FOUND quando não acha', async () => {
        const service = new GetEntryService(reads);
        await expect(service.execute('c1', 'e1')).resolves.toMatchObject({
            billingAccountName: 'Banco',
        });
        reads.find.mockResolvedValue(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({ code: 'ENTRY_NOT_FOUND' });
    });
});

describe('ListEntriesService', () => {
    const page = { items: [], page: 1, pageSize: 10, total: 0 };

    it('sem filtro de título lista direto', async () => {
        reads.list.mockResolvedValue(page);
        await expect(
            new ListEntriesService(reads, titles).execute('c1', {}, { page: 1, pageSize: 10 }),
        ).resolves.toBe(page);
        expect(titles.find).not.toHaveBeenCalled();
    });

    it('com filtro de título confirma que o título é da empresa antes de listar', async () => {
        reads.list.mockResolvedValue(page);
        await new ListEntriesService(reads, titles).execute(
            'c1',
            { titleId: 't1' },
            { page: 1, pageSize: 10 },
        );
        expect(titles.find).toHaveBeenCalledWith('c1', 't1');
        expect(reads.list).toHaveBeenCalledWith('c1', { titleId: 't1' }, { page: 1, pageSize: 10 });
    });

    it('título de outra empresa lança TITLE_NOT_FOUND', async () => {
        titles.find.mockResolvedValue(null);
        await expect(
            new ListEntriesService(reads, titles).execute(
                'c1',
                { titleId: 'x' },
                { page: 1, pageSize: 10 },
            ),
        ).rejects.toMatchObject({ code: 'TITLE_NOT_FOUND' });
        expect(reads.list).not.toHaveBeenCalled();
    });
});
