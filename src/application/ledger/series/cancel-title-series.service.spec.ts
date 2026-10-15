import { CancelTitleSeriesService } from '@/application/ledger/series/cancel-title-series.service.js';
import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { creationLines } from '@/domain/ledger/posting.policy.js';
import { fakeClock, fakeUow, journalFixture, titleFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new CancelTitleSeriesService(uow, fakeClock);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const series = SeriesEntity.create({
    id: 's1',
    companyId: 'c1',
    kind: 'RECURRING',
    frequency: 'MONTHLY',
    totalCount: 3,
    baseDescription: 'Aluguel',
    firstIssueDate: day('2026-10-05'),
    firstExpirationDate: day('2026-10-10'),
});
const titles = [1, 2, 3].map(index =>
    titleFixture({
        id: `t${index}`,
        seriesId: 's1',
        seriesIndex: index,
        description: `Aluguel (${index})`,
    }),
);
const original = (id: string, date: Date) =>
    journalFixture(
        'TITLE_CREATION',
        id,
        creationLines(
            { type: 'INCOME', controlAccountId: 'ar', resultAccountId: 'rev' },
            100000,
            'x',
        ),
        date,
    );

beforeEach(() => {
    tx.series.lock.mockReset().mockResolvedValue(series);
    tx.series.titles.mockReset().mockResolvedValue(titles);
    tx.titles.idsWithEntries.mockReset().mockResolvedValue(new Set());
    tx.journal.findAll
        .mockReset()
        .mockResolvedValue([
            original('t1', day('2026-10-05')),
            original('t2', day('2026-11-05')),
            original('t3', day('2026-12-05')),
        ]);
    tx.journal.writeAll.mockReset();
    tx.titles.deleteAll.mockReset();
    tx.series.delete.mockReset();
});

describe('CancelTitleSeriesService', () => {
    it('estorna e exclui os títulos sem baixas em lote, cada estorno na data mais tardia', async () => {
        const result = await service.execute('c1', 's1');
        expect(result).toEqual({ cancelled: 3, kept: 0 });
        expect(tx.journal.findAll).toHaveBeenCalledWith('TITLE_CREATION', ['t1', 't2', 't3']);
        expect(tx.journal.writeAll).toHaveBeenCalledTimes(1);
        const reversals = tx.journal.writeAll.mock.calls[0][0];
        expect(
            reversals.map((j: { referenceType: string; referenceId: string; date: Date }) => [
                j.referenceType,
                j.referenceId,
                j.date.toISOString().slice(0, 10),
            ]),
        ).toEqual([
            ['TITLE_CANCELLATION', 't1', '2026-10-14'],
            ['TITLE_CANCELLATION', 't2', '2026-11-05'],
            ['TITLE_CANCELLATION', 't3', '2026-12-05'],
        ]);
        expect(tx.titles.deleteAll).toHaveBeenCalledWith(['t1', 't2', 't3']);
        expect(tx.series.delete).toHaveBeenCalledWith('s1');
    });

    it('mantém os títulos que têm baixa e a série quando sobra algum', async () => {
        tx.titles.idsWithEntries.mockResolvedValue(new Set(['t1']));
        const result = await service.execute('c1', 's1');
        expect(result).toEqual({ cancelled: 2, kept: 1 });
        expect(tx.journal.findAll).toHaveBeenCalledWith('TITLE_CREATION', ['t2', 't3']);
        expect(tx.titles.deleteAll).toHaveBeenCalledWith(['t2', 't3']);
        expect(tx.series.delete).not.toHaveBeenCalled();
    });

    it('todos com baixa: nada é estornado nem excluído', async () => {
        tx.titles.idsWithEntries.mockResolvedValue(new Set(['t1', 't2', 't3']));
        const result = await service.execute('c1', 's1');
        expect(result).toEqual({ cancelled: 0, kept: 3 });
        expect(tx.journal.writeAll).not.toHaveBeenCalled();
        expect(tx.series.delete).not.toHaveBeenCalled();
    });

    it('série de outra empresa lança SERIES_NOT_FOUND', async () => {
        tx.series.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x')).rejects.toMatchObject({
            code: 'SERIES_NOT_FOUND',
        });
    });

    it('lançamento de criação ausente é erro interno e não exclui nada', async () => {
        tx.journal.findAll.mockResolvedValue([original('t1', day('2026-10-05'))]);
        await expect(service.execute('c1', 's1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
        expect(tx.titles.deleteAll).not.toHaveBeenCalled();
    });
});
