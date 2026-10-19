import { GetTitleSeriesService } from '@/application/ledger/series/get-title-series.service.js';
import { ListTitleSeriesService } from '@/application/ledger/series/list-title-series.service.js';
import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { fakeSeriesRead, titleFixture } from '@test/support/ledger-fakes.js';

const reads = fakeSeriesRead();
const series = SeriesEntity.create({
    id: 's1',
    companyId: 'c1',
    kind: 'INSTALLMENT',
    frequency: 'MONTHLY',
    totalCount: 1,
    baseDescription: 'x',
    firstIssueDate: new Date('2026-10-01T00:00:00.000Z'),
    firstExpirationDate: new Date('2026-11-01T00:00:00.000Z'),
});

describe('GetTitleSeriesService', () => {
    it('devolve a série com os títulos', async () => {
        reads.find.mockResolvedValue({ series, titles: [titleFixture()] });
        await expect(new GetTitleSeriesService(reads).execute('c1', 's1')).resolves.toMatchObject({
            titles: [expect.anything()],
        });
        expect(reads.find).toHaveBeenCalledWith('c1', 's1');
    });

    it('série de outra empresa lança SERIES_NOT_FOUND', async () => {
        reads.find.mockResolvedValue(null);
        await expect(new GetTitleSeriesService(reads).execute('c1', 'x')).rejects.toMatchObject({
            code: 'SERIES_NOT_FOUND',
        });
    });
});

describe('ListTitleSeriesService', () => {
    it('repassa empresa, filtro e página', async () => {
        const page = { items: [series], page: 1, pageSize: 10, total: 1 };
        reads.list.mockResolvedValue(page);
        await expect(
            new ListTitleSeriesService(reads).execute(
                'c1',
                { kind: 'INSTALLMENT' },
                { page: 1, pageSize: 10 },
            ),
        ).resolves.toBe(page);
        expect(reads.list).toHaveBeenCalledWith(
            'c1',
            { kind: 'INSTALLMENT' },
            { page: 1, pageSize: 10 },
        );
    });
});
