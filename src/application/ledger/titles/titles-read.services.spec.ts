import { GetTitleService } from '@/application/ledger/titles/get-title.service.js';
import { ListTitlesService } from '@/application/ledger/titles/list-titles.service.js';
import { fakeTitleRead, titleFixture } from '@test/support/ledger-fakes.js';

const reads = fakeTitleRead();

beforeEach(() => {
    reads.find.mockReset();
    reads.list.mockReset();
});

describe('GetTitleService', () => {
    it('devolve o título com o nome do preset', async () => {
        reads.find.mockResolvedValue({ title: titleFixture(), presetName: 'Preset' });
        await expect(new GetTitleService(reads).execute('c1', 't1')).resolves.toMatchObject({
            presetName: 'Preset',
        });
        expect(reads.find).toHaveBeenCalledWith('c1', 't1');
    });

    it('título de outra empresa ou inexistente lança TITLE_NOT_FOUND', async () => {
        reads.find.mockResolvedValue(null);
        await expect(new GetTitleService(reads).execute('c1', 'x')).rejects.toMatchObject({
            code: 'TITLE_NOT_FOUND',
        });
    });
});

describe('ListTitlesService', () => {
    it('repassa empresa, filtro e página', async () => {
        const page = { items: [], page: 1, pageSize: 10, total: 0 };
        reads.list.mockResolvedValue(page);
        await expect(
            new ListTitlesService(reads).execute(
                'c1',
                { type: 'INCOME' },
                { page: 1, pageSize: 10 },
            ),
        ).resolves.toBe(page);
        expect(reads.list).toHaveBeenCalledWith(
            'c1',
            { type: 'INCOME' },
            { page: 1, pageSize: 10 },
        );
    });
});
