import { TitleReadPrismaRepository } from '@/infrastructure/persistence/title-read.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const dec = (text: string) => ({ toFixed: () => text });
const day = new Date('2026-10-14T00:00:00.000Z');
const row = {
    id: 't1',
    companyId: 'c1',
    presetId: 'pr1',
    controlAccountId: 'ar',
    resultAccountId: 'rev',
    seriesId: null,
    seriesIndex: null,
    type: 'INCOME',
    status: 'OPEN',
    description: 'Venda',
    amount: dec('100.00'),
    settledAmount: dec('0.00'),
    issueDate: day,
    expirationDate: day,
    feesPercentageMonthly: dec('0.00'),
    createdAt: day,
    updatedAt: day,
    preset: { name: 'Venda de serviços' },
    party: { name: 'Copel' },
};
const include = { preset: { select: { name: true } }, party: { select: { name: true } } };

function makeRepo() {
    const title = { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() };
    const prisma = {
        title,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return { title, repo: new TitleReadPrismaRepository(prisma as unknown as PrismaService) };
}

describe('TitleReadPrismaRepository', () => {
    it('find filtra por id e empresa e lê o preset em um join', async () => {
        const { repo, title } = makeRepo();
        title.findFirst.mockResolvedValue(row);
        const view = await repo.find('c1', 't1');
        expect(title.findFirst).toHaveBeenCalledWith({
            where: { id: 't1', companyId: 'c1' },
            include,
            relationLoadStrategy: 'join',
        });
        expect(view).toMatchObject({ presetName: 'Venda de serviços', partyName: 'Copel' });
        expect(view?.title.amount).toBe(10000);
    });

    it('find devolve null quando não acha', async () => {
        const { repo, title } = makeRepo();
        title.findFirst.mockResolvedValue(null);
        await expect(repo.find('c1', 'x')).resolves.toBeNull();
    });

    it('list escopa pela empresa, aplica filtros e pagina por vencimento', async () => {
        const { repo, title } = makeRepo();
        title.findMany.mockResolvedValue([row]);
        title.count.mockResolvedValue(21);
        const dueFrom = new Date('2026-10-01T00:00:00.000Z');
        const dueTo = new Date('2026-10-31T00:00:00.000Z');
        const page = await repo.list(
            'c1',
            {
                type: 'INCOME',
                status: 'OPEN',
                presetId: 'pr1',
                partyId: 'pt1',
                seriesId: 's1',
                dueFrom,
                dueTo,
            },
            { page: 3, pageSize: 10 },
        );
        const where = {
            companyId: 'c1',
            type: 'INCOME',
            status: 'OPEN',
            presetId: 'pr1',
            partyId: 'pt1',
            seriesId: 's1',
            expirationDate: { gte: dueFrom, lte: dueTo },
        };
        expect(title.findMany).toHaveBeenCalledWith({
            where,
            orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
            skip: 20,
            take: 10,
            include,
            relationLoadStrategy: 'join',
        });
        expect(title.count).toHaveBeenCalledWith({ where });
        expect(page).toMatchObject({ page: 3, pageSize: 10, total: 21 });
    });

    it('list sem filtros só escopa pela empresa; vencimento aceita só um limite', async () => {
        const { repo, title } = makeRepo();
        title.findMany.mockResolvedValue([]);
        title.count.mockResolvedValue(0);
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(title.count).toHaveBeenLastCalledWith({ where: { companyId: 'c1' } });
        const dueFrom = new Date('2026-10-01T00:00:00.000Z');
        await repo.list('c1', { dueFrom }, { page: 1, pageSize: 10 });
        expect(title.count).toHaveBeenLastCalledWith({
            where: { companyId: 'c1', expirationDate: { gte: dueFrom } },
        });
        const dueTo = new Date('2026-10-31T00:00:00.000Z');
        await repo.list('c1', { dueTo }, { page: 1, pageSize: 10 });
        expect(title.count).toHaveBeenLastCalledWith({
            where: { companyId: 'c1', expirationDate: { lte: dueTo } },
        });
    });
});
