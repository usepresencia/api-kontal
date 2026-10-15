import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { toSeriesDetailResponse, toSeriesResponse } from '@/presentation/ledger/series.mapper.js';
import { titleFixture } from '@test/support/ledger-fakes.js';

const series = SeriesEntity.create({
    id: 's1',
    companyId: 'c1',
    kind: 'RECURRING',
    frequency: 'MONTHLY',
    totalCount: 2,
    baseDescription: 'Aluguel',
    firstIssueDate: new Date('2026-11-05T00:00:00.000Z'),
    firstExpirationDate: new Date('2026-11-10T00:00:00.000Z'),
    createdAt: new Date('2026-10-14T12:00:00.000Z'),
});

describe('series mappers', () => {
    it('toSeriesResponse devolve a série com datas YYYY-MM-DD', () => {
        expect(toSeriesResponse(series)).toEqual({
            id: 's1',
            kind: 'RECURRING',
            frequency: 'MONTHLY',
            totalCount: 2,
            baseDescription: 'Aluguel',
            firstIssueDate: '2026-11-05',
            firstExpirationDate: '2026-11-10',
            createdAt: '2026-10-14T12:00:00.000Z',
        });
    });

    it('toSeriesDetailResponse acrescenta os títulos (sem nome de preset)', () => {
        const detail = toSeriesDetailResponse(series, [
            titleFixture({ seriesId: 's1', seriesIndex: 1 }),
        ]);
        expect(detail.id).toBe('s1');
        expect(detail.titles).toHaveLength(1);
        expect(detail.titles[0]).toMatchObject({
            id: 't1',
            seriesIndex: 1,
            presetName: null,
            amount: '1000.00',
        });
    });
});
