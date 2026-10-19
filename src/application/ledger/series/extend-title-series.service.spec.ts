import { ExtendTitleSeriesService } from '@/application/ledger/series/extend-title-series.service.js';
import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { PartyEntity } from '@/domain/entities/party.entity.js';
import { fakeUow, partyFixture, titleFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new ExtendTitleSeriesService(uow);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const series = (overrides: Record<string, unknown> = {}) =>
    SeriesEntity.create({
        id: 's1',
        companyId: 'c1',
        kind: 'RECURRING',
        frequency: 'MONTHLY',
        totalCount: 3,
        baseDescription: 'Aluguel',
        firstIssueDate: day('2026-11-05'),
        firstExpirationDate: day('2026-11-10'),
        ...overrides,
    } as never);
const last = titleFixture({
    id: 't3',
    seriesId: 's1',
    seriesIndex: 3,
    type: 'EXPENSE',
    controlAccountId: 'ap',
    resultAccountId: 'exp',
    amount: 250000,
    description: 'Aluguel (3)',
    feesPercentageMonthly: 0.02,
});

beforeEach(() => {
    tx.parties.find.mockReset().mockResolvedValue(partyFixture);
    tx.series.lock.mockReset().mockResolvedValue(series());
    tx.series.lastTitle.mockReset().mockResolvedValue(last);
    tx.series.save.mockReset();
    tx.titles.insertAll.mockReset();
    tx.journal.writeAll.mockReset();
});

describe('ExtendTitleSeriesService', () => {
    it('continua a numeração, repete preset, contas, valor e juros e atualiza a quantidade', async () => {
        const result = await service.execute('c1', 's1', { count: 2 });
        expect(tx.series.lock).toHaveBeenCalledWith('c1', 's1');
        expect(
            result.titles.map(t => [
                t.seriesIndex,
                t.description,
                t.expirationDate.toISOString().slice(0, 10),
            ]),
        ).toEqual([
            [4, 'Aluguel (4)', '2027-02-10'],
            [5, 'Aluguel (5)', '2027-03-10'],
        ]);
        expect(result.titles[0]).toMatchObject({
            presetId: 'pr1',
            controlAccountId: 'ap',
            resultAccountId: 'exp',
            amount: 250000,
            feesPercentageMonthly: 0.02,
            seriesId: 's1',
        });
        expect(result.series.totalCount).toBe(5);
        expect(tx.series.save.mock.calls[0][0].totalCount).toBe(5);
        expect(tx.titles.insertAll).toHaveBeenCalledTimes(1);
        expect(tx.journal.writeAll.mock.calls[0][0]).toHaveLength(2);
    });

    it('aceita data final no lugar de quantidade', async () => {
        const result = await service.execute('c1', 's1', { until: day('2027-02-10') });
        expect(result.titles).toHaveLength(1);
    });

    it('série parcelada lança SERIES_NOT_EXTENDABLE', async () => {
        tx.series.lock.mockResolvedValue(series({ kind: 'INSTALLMENT' }));
        await expect(service.execute('c1', 's1', { count: 1 })).rejects.toMatchObject({
            code: 'SERIES_NOT_EXTENDABLE',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });

    it('passar de 120 por série lança SERIES_LIMIT_EXCEEDED e sem fim lança SERIES_INVALID', async () => {
        tx.series.lock.mockResolvedValue(series({ totalCount: 100 }));
        await expect(service.execute('c1', 's1', { count: 30 })).rejects.toMatchObject({
            code: 'SERIES_LIMIT_EXCEEDED',
        });
        await expect(service.execute('c1', 's1', {})).rejects.toMatchObject({
            code: 'SERIES_INVALID',
        });
        expect(tx.series.save).not.toHaveBeenCalled();
    });

    it('série de outra empresa lança SERIES_NOT_FOUND', async () => {
        tx.series.lock.mockResolvedValue(null);
        await expect(service.execute('c1', 'x', { count: 1 })).rejects.toMatchObject({
            code: 'SERIES_NOT_FOUND',
        });
    });

    it('série sem títulos é erro interno', async () => {
        tx.series.lastTitle.mockResolvedValue(null);
        await expect(service.execute('c1', 's1', { count: 1 })).rejects.toMatchObject({
            code: 'INTERNAL_ERROR',
        });
    });
});

describe('ExtendTitleSeriesService: contraparte da série', () => {
    const party = (changes: Partial<Parameters<typeof PartyEntity.create>[0]>) =>
        PartyEntity.create({
            id: 'pt1',
            companyId: 'c1',
            kind: 'SUPPLIER',
            name: 'Copel',
            socialReason: 'Companhia Paranaense de Energia',
            document: '11.222.333/0001-81',
            email: '',
            phone: '',
            address: null,
            defaultPresetId: 'pr1',
            ...changes,
        });

    it('contraparte desativada depois da criação lança PARTY_INACTIVE e não grava', async () => {
        tx.parties.find.mockResolvedValue(party({ isActive: false }));
        await expect(service.execute('c1', 's1', { count: 2 })).rejects.toMatchObject({
            code: 'PARTY_INACTIVE',
        });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });

    it('contraparte que passou a ser só cliente lança PARTY_KIND_MISMATCH numa série a pagar', async () => {
        tx.parties.find.mockResolvedValue(party({ kind: 'CLIENT' }));
        await expect(service.execute('c1', 's1', { count: 2 })).rejects.toMatchObject({
            code: 'PARTY_KIND_MISMATCH',
        });
    });
});
