import {
    toPeriodClosingResponse,
    toPeriodClosingsResponse,
} from '@/presentation/ledger/period-closing.mapper.js';

const row = {
    id: 'p1',
    companyId: 'c1',
    throughDate: new Date('2026-09-30T00:00:00.000Z'),
    closingEntryId: null,
    createdAt: new Date('2026-10-14T12:00:00.000Z'),
};

describe('period closing mappers', () => {
    it('toPeriodClosingResponse devolve o mês, a data e a data de criação em ISO', () => {
        expect(toPeriodClosingResponse(row)).toEqual({
            id: 'p1',
            month: '2026-09',
            throughDate: '2026-09-30',
            closingEntryId: null,
            createdAt: '2026-10-14T12:00:00.000Z',
        });
    });

    it('toPeriodClosingsResponse traz a trava vigente (ou null) e os itens', () => {
        expect(
            toPeriodClosingsResponse({ closedThrough: row.throughDate, items: [row] }),
        ).toMatchObject({
            closedThrough: '2026-09-30',
            items: [{ id: 'p1', month: '2026-09' }],
        });
        expect(toPeriodClosingsResponse({ closedThrough: null, items: [] })).toEqual({
            closedThrough: null,
            items: [],
        });
    });
});
