import { EntryReadPrismaRepository } from '@/infrastructure/persistence/entry-read.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const dec = (text: string) => ({ toFixed: () => text });
const day = new Date('2026-10-10T00:00:00.000Z');
const row = {
    id: 'e1',
    titleId: 't1',
    kind: 'PAYMENT',
    billingAccountId: 'bank',
    principalAmount: dec('100.00'),
    interestAmount: dec('0.00'),
    fineAmount: dec('0.00'),
    discountAmount: dec('0.00'),
    totalAmount: dec('100.00'),
    paidAt: day,
    paymentMethod: 'PIX',
    description: '',
    createdAt: day,
    updatedAt: day,
    title: { description: 'Venda' },
    billingAccount: { name: 'Banco' },
};
const include = {
    title: { select: { description: true } },
    billingAccount: { select: { name: true } },
};

function makeRepo() {
    const entry = { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() };
    const prisma = {
        entry,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return { entry, repo: new EntryReadPrismaRepository(prisma as unknown as PrismaService) };
}

describe('EntryReadPrismaRepository', () => {
    it('find escopa pela empresa do título e lê título e conta em um join', async () => {
        const { repo, entry } = makeRepo();
        entry.findFirst.mockResolvedValue(row);
        const view = await repo.find('c1', 'e1');
        expect(entry.findFirst).toHaveBeenCalledWith({
            where: { id: 'e1', title: { companyId: 'c1' } },
            include,
            relationLoadStrategy: 'join',
        });
        expect(view).toMatchObject({ titleDescription: 'Venda', billingAccountName: 'Banco' });
    });

    it('baixa por perda não tem nome de conta', async () => {
        const { repo, entry } = makeRepo();
        entry.findFirst.mockResolvedValue({
            ...row,
            kind: 'WRITE_OFF',
            billingAccountId: null,
            billingAccount: null,
            paymentMethod: null,
        });
        await expect(repo.find('c1', 'e1')).resolves.toMatchObject({ billingAccountName: null });
    });

    it('find devolve null quando não acha', async () => {
        const { repo, entry } = makeRepo();
        entry.findFirst.mockResolvedValue(null);
        await expect(repo.find('c1', 'x')).resolves.toBeNull();
    });

    it('list escopa pela empresa, filtra por título e ordena por data de baixa decrescente', async () => {
        const { repo, entry } = makeRepo();
        entry.findMany.mockResolvedValue([row]);
        entry.count.mockResolvedValue(1);
        await repo.list('c1', { titleId: 't1' }, { page: 1, pageSize: 10 });
        const where = { title: { companyId: 'c1' }, titleId: 't1' };
        expect(entry.findMany).toHaveBeenCalledWith({
            where,
            orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
            skip: 0,
            take: 10,
            include,
            relationLoadStrategy: 'join',
        });
        expect(entry.count).toHaveBeenCalledWith({ where });
    });

    it('list sem filtro só escopa pela empresa', async () => {
        const { repo, entry } = makeRepo();
        entry.findMany.mockResolvedValue([]);
        entry.count.mockResolvedValue(0);
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(entry.count).toHaveBeenCalledWith({ where: { title: { companyId: 'c1' } } });
    });
});
