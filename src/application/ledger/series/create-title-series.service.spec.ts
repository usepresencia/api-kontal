import { CreateTitleSeriesService } from '@/application/ledger/series/create-title-series.service.js';
import { fakeClock, fakeUow, presetFixture } from '@test/support/ledger-fakes.js';

const { uow, tx } = fakeUow();
const service = new CreateTitleSeriesService(uow, fakeClock);
const base = {
    presetId: 'pr1',
    type: 'INCOME' as const,
    description: 'Venda',
    amount: 90000,
    issueDate: new Date('2026-10-14T00:00:00.000Z'),
    expirationDate: new Date('2026-11-10T00:00:00.000Z'),
};
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

beforeEach(() => {
    tx.presets.find.mockReset().mockResolvedValue(presetFixture);
    tx.series.insert.mockReset();
    tx.titles.insertAll.mockReset();
    tx.journal.writeAll.mockReset();
});

describe('CreateTitleSeriesService: parcelado', () => {
    it('gera N títulos e N lançamentos em lote, com a mesma emissão e vencimentos mensais', async () => {
        const { series, titles } = await service.execute('c1', {
            ...base,
            kind: 'INSTALLMENT',
            count: 3,
        });
        expect(series).toMatchObject({
            kind: 'INSTALLMENT',
            frequency: 'MONTHLY',
            totalCount: 3,
            baseDescription: 'Venda',
        });
        expect(
            titles.map(t => [
                t.seriesIndex,
                t.description,
                t.amount,
                t.issueDate.toISOString().slice(0, 10),
                t.expirationDate.toISOString().slice(0, 10),
            ]),
        ).toEqual([
            [1, 'Venda (1/3)', 30000, '2026-10-14', '2026-11-10'],
            [2, 'Venda (2/3)', 30000, '2026-10-14', '2026-12-10'],
            [3, 'Venda (3/3)', 30000, '2026-10-14', '2027-01-10'],
        ]);
        expect(
            titles.every(
                t =>
                    t.seriesId === series.id &&
                    t.controlAccountId === 'ar' &&
                    t.resultAccountId === 'rev',
            ),
        ).toBe(true);
        expect(tx.series.insert).toHaveBeenCalledTimes(1);
        expect(tx.titles.insertAll).toHaveBeenCalledTimes(1);
        expect(tx.titles.insertAll).toHaveBeenCalledWith(titles);
        const [[journals]] = tx.journal.writeAll.mock.calls;
        expect(tx.journal.writeAll).toHaveBeenCalledTimes(1);
        expect(journals).toHaveLength(3);
        expect(journals.map((j: { referenceId: string }) => j.referenceId)).toEqual(
            titles.map(t => t.id),
        );
    });

    it('distribui a sobra de centavos e a soma é o total', async () => {
        const { titles } = await service.execute('c1', {
            ...base,
            kind: 'INSTALLMENT',
            count: 3,
            amount: 10000,
        });
        expect(titles.map(t => t.amount)).toEqual([3334, 3333, 3333]);
    });

    it.each([
        ['sem quantidade', {}],
        ['com data final', { count: 3, until: day('2027-01-10') }],
        ['com uma parcela', { count: 1 }],
    ])('parcelado %s lança SERIES_INVALID e não grava', async (_label, extra) => {
        await expect(
            service.execute('c1', { ...base, kind: 'INSTALLMENT', ...extra }),
        ).rejects.toMatchObject({ code: 'SERIES_INVALID' });
        expect(tx.series.insert).not.toHaveBeenCalled();
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });

    it('mais de 60 parcelas lança SERIES_LIMIT_EXCEEDED', async () => {
        await expect(
            service.execute('c1', { ...base, kind: 'INSTALLMENT', count: 61, amount: 100000 }),
        ).rejects.toMatchObject({ code: 'SERIES_LIMIT_EXCEEDED' });
    });
});

describe('CreateTitleSeriesService: recorrente', () => {
    const recurring = {
        ...base,
        kind: 'RECURRING' as const,
        amount: 250000,
        issueDate: day('2026-11-05'),
        expirationDate: day('2026-11-10'),
    };

    it('por quantidade: valor igual, emissão e vencimento avançam juntos', async () => {
        const { series, titles } = await service.execute('c1', {
            ...recurring,
            type: 'EXPENSE',
            count: 3,
        });
        expect(series).toMatchObject({
            kind: 'RECURRING',
            totalCount: 3,
            firstIssueDate: day('2026-11-05'),
            firstExpirationDate: day('2026-11-10'),
        });
        expect(
            titles.map(t => [
                t.description,
                t.amount,
                t.issueDate.toISOString().slice(0, 10),
                t.expirationDate.toISOString().slice(0, 10),
            ]),
        ).toEqual([
            ['Venda (1)', 250000, '2026-11-05', '2026-11-10'],
            ['Venda (2)', 250000, '2026-12-05', '2026-12-10'],
            ['Venda (3)', 250000, '2027-01-05', '2027-01-10'],
        ]);
        expect(titles[0]).toMatchObject({
            controlAccountId: 'ap',
            resultAccountId: 'exp',
            type: 'EXPENSE',
        });
        expect(
            tx.journal.writeAll.mock.calls[0][0].map((j: { date: Date }) =>
                j.date.toISOString().slice(0, 10),
            ),
        ).toEqual(['2026-11-05', '2026-12-05', '2027-01-05']);
    });

    it('por data final', async () => {
        const { titles } = await service.execute('c1', {
            ...recurring,
            until: day('2027-01-10'),
            frequency: 'MONTHLY',
        });
        expect(titles).toHaveLength(3);
    });

    it('sem fim lança SERIES_INVALID', async () => {
        await expect(service.execute('c1', recurring)).rejects.toMatchObject({
            code: 'SERIES_INVALID',
        });
    });
});

describe('CreateTitleSeriesService: recusas', () => {
    it('preset inexistente lança PRESET_NOT_FOUND, inativo PRESET_INACTIVE e sem conta do tipo TITLE_NOT_POSTABLE', async () => {
        tx.presets.find.mockResolvedValue(null);
        await expect(
            service.execute('c1', { ...base, kind: 'INSTALLMENT', count: 2 }),
        ).rejects.toMatchObject({ code: 'PRESET_NOT_FOUND' });
        tx.presets.find.mockResolvedValue({
            ...presetFixture,
            isActive: false,
            accounts: presetFixture.accounts,
            id: 'pr1',
            name: 'x',
        });
        await expect(
            service.execute('c1', { ...base, kind: 'INSTALLMENT', count: 2 }),
        ).rejects.toMatchObject({ code: 'PRESET_INACTIVE' });
        tx.presets.find.mockResolvedValue({
            ...presetFixture,
            isActive: true,
            accounts: { ...presetFixture.accounts, revenue: null },
            id: 'pr1',
            name: 'x',
        });
        await expect(
            service.execute('c1', { ...base, kind: 'INSTALLMENT', count: 2 }),
        ).rejects.toMatchObject({ code: 'TITLE_NOT_POSTABLE' });
        expect(tx.titles.insertAll).not.toHaveBeenCalled();
    });
});
