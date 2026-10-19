import { toSeriesEntity } from '@/infrastructure/persistence/series.prisma.mapper.js';

describe('toSeriesEntity', () => {
    it('reidrata a série a partir do banco', () => {
        const day = new Date('2026-10-14T00:00:00.000Z');
        const series = toSeriesEntity({
            id: 's1',
            companyId: 'c1',
            kind: 'RECURRING',
            frequency: 'MONTHLY',
            totalCount: 12,
            baseDescription: 'Aluguel',
            firstIssueDate: day,
            firstExpirationDate: day,
            createdAt: day,
        });
        expect(series).toMatchObject({
            id: 's1',
            kind: 'RECURRING',
            frequency: 'MONTHLY',
            totalCount: 12,
            baseDescription: 'Aluguel',
        });
    });
});
