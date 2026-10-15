import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { SeriesReadPrismaRepository } from '@/infrastructure/persistence/series-read.prisma.repository.js';

const day = new Date('2026-10-14T00:00:00.000Z');
const dec = (text: string) => ({ toFixed: () => text });
const titleRow = {
    id: 't1',
    companyId: 'c1',
    presetId: 'pr1',
    controlAccountId: 'ap',
    resultAccountId: 'exp',
    seriesId: 's1',
    seriesIndex: 1,
    type: 'EXPENSE',
    status: 'OPEN',
    description: 'Aluguel (1)',
    amount: dec('100.00'),
    settledAmount: dec('0.00'),
    issueDate: day,
    expirationDate: day,
    feesPercentageMonthly: dec('0.00'),
    createdAt: day,
    updatedAt: day,
};
const seriesRow = {
    id: 's1',
    companyId: 'c1',
    kind: 'RECURRING',
    frequency: 'MONTHLY',
    totalCount: 1,
    baseDescription: 'Aluguel',
    firstIssueDate: day,
    firstExpirationDate: day,
    createdAt: day,
};

function makeRepo() {
    const titleSeries = { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() };
    const prisma = {
        titleSeries,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return {
        titleSeries,
        repo: new SeriesReadPrismaRepository(prisma as unknown as PrismaService),
    };
}

describe('SeriesReadPrismaRepository', () => {
    it('find filtra por empresa e lê os títulos ordenados em um join', async () => {
        const { repo, titleSeries } = makeRepo();
        titleSeries.findFirst.mockResolvedValue({ ...seriesRow, titles: [titleRow] });
        const view = await repo.find('c1', 's1');
        expect(titleSeries.findFirst).toHaveBeenCalledWith({
            where: { id: 's1', companyId: 'c1' },
            include: { titles: { orderBy: { seriesIndex: 'asc' } } },
            relationLoadStrategy: 'join',
        });
        expect(view?.series.id).toBe('s1');
        expect(view?.titles).toHaveLength(1);
    });

    it('find devolve null quando não acha', async () => {
        const { repo, titleSeries } = makeRepo();
        titleSeries.findFirst.mockResolvedValue(null);
        await expect(repo.find('c1', 'x')).resolves.toBeNull();
    });

    it('list pagina as séries da empresa, com filtro opcional de tipo', async () => {
        const { repo, titleSeries } = makeRepo();
        titleSeries.findMany.mockResolvedValue([seriesRow]);
        titleSeries.count.mockResolvedValue(1);
        await repo.list('c1', { kind: 'RECURRING' }, { page: 1, pageSize: 10 });
        const where = { companyId: 'c1', kind: 'RECURRING' };
        expect(titleSeries.findMany).toHaveBeenCalledWith({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: 0,
            take: 10,
        });
        expect(titleSeries.count).toHaveBeenCalledWith({ where });
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(titleSeries.count).toHaveBeenLastCalledWith({ where: { companyId: 'c1' } });
    });
});
