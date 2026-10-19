import type { Prisma } from '@prisma/client';
import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { SeriesTxRepository } from '@/infrastructure/persistence/ledger/series.tx.repository.js';

const day = new Date('2026-10-14T00:00:00.000Z');
const seriesRow = {
    id: 's1',
    companyId: 'c1',
    kind: 'RECURRING',
    frequency: 'MONTHLY',
    totalCount: 12,
    baseDescription: 'Aluguel',
    firstIssueDate: day,
    firstExpirationDate: day,
    createdAt: day,
};
const dec = (text: string) => ({ toFixed: () => text });
const titleRow = {
    id: 't1',
    companyId: 'c1',
    presetId: 'pr1',
    controlAccountId: 'ap',
    resultAccountId: 'exp',
    seriesId: 's1',
    seriesIndex: 12,
    type: 'EXPENSE',
    status: 'OPEN',
    description: 'Aluguel (12)',
    amount: dec('100.00'),
    settledAmount: dec('0.00'),
    issueDate: day,
    expirationDate: day,
    feesPercentageMonthly: dec('0.00'),
    createdAt: day,
    updatedAt: day,
};

function makeRepo() {
    const client = {
        $queryRaw: vi.fn(),
        titleSeries: {
            create: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        title: { findMany: vi.fn(), findFirst: vi.fn() },
    };
    return { client, repo: new SeriesTxRepository(client as unknown as Prisma.TransactionClient) };
}

describe('SeriesTxRepository', () => {
    it('insert grava a série', async () => {
        const { repo, client } = makeRepo();
        await repo.insert(
            SeriesEntity.fromPersistence({
                ...seriesRow,
                kind: 'RECURRING',
                frequency: 'MONTHLY',
            } as never),
        );
        expect(client.titleSeries.create.mock.calls[0][0].data).toMatchObject({
            id: 's1',
            companyId: 'c1',
            kind: 'RECURRING',
            frequency: 'MONTHLY',
            totalCount: 12,
            baseDescription: 'Aluguel',
        });
    });

    it('lock trava a linha da série da empresa com FOR UPDATE e devolve null quando não acha', async () => {
        const { repo, client } = makeRepo();
        client.$queryRaw.mockResolvedValueOnce([]);
        await expect(repo.lock('c1', 'x')).resolves.toBeNull();
        client.$queryRaw.mockResolvedValueOnce([{ id: 's1' }]);
        client.titleSeries.findUniqueOrThrow.mockResolvedValue(seriesRow);
        await expect(repo.lock('c1', 's1')).resolves.toMatchObject({ id: 's1', totalCount: 12 });
        const [strings, ...values] = client.$queryRaw.mock.calls[1];
        expect(strings.join('?')).toContain('FOR UPDATE');
        expect(values).toEqual(['s1', 'c1']);
    });

    it('save atualiza a quantidade total', async () => {
        const { repo, client } = makeRepo();
        await repo.save(SeriesEntity.fromPersistence(seriesRow as never).withTotalCount(24));
        expect(client.titleSeries.update).toHaveBeenCalledWith({
            where: { id: 's1' },
            data: { totalCount: 24 },
        });
    });

    it('delete remove a série pelo id', async () => {
        const { repo, client } = makeRepo();
        await repo.delete('s1');
        expect(client.titleSeries.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('titles lista os títulos da série em ordem de índice', async () => {
        const { repo, client } = makeRepo();
        client.title.findMany.mockResolvedValue([titleRow]);
        const titles = await repo.titles('s1');
        expect(client.title.findMany).toHaveBeenCalledWith({
            where: { seriesId: 's1' },
            orderBy: { seriesIndex: 'asc' },
        });
        expect(titles).toHaveLength(1);
    });

    it('lastTitle devolve o título de maior índice ou null', async () => {
        const { repo, client } = makeRepo();
        client.title.findFirst.mockResolvedValueOnce(null);
        await expect(repo.lastTitle('s1')).resolves.toBeNull();
        client.title.findFirst.mockResolvedValueOnce(titleRow);
        await expect(repo.lastTitle('s1')).resolves.toMatchObject({ seriesIndex: 12 });
        expect(client.title.findFirst).toHaveBeenCalledWith({
            where: { seriesId: 's1' },
            orderBy: { seriesIndex: 'desc' },
        });
    });
});
