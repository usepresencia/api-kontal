import { EntryReadPrismaRepository } from '@/infrastructure/persistence/entry-read.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (text: string) => ({ toFixed: () => text });
const row = {
    id: 'e1',
    titleId: 't1',
    kind: 'PAYMENT',
    billingAccountId: 'a1',
    principalAmount: dec('10.00'),
    interestAmount: dec('0.00'),
    fineAmount: dec('0.00'),
    discountAmount: dec('0.00'),
    totalAmount: dec('10.00'),
    paidAt: day('2026-10-10'),
    paymentMethod: 'PIX',
    description: '',
    createdAt: day('2026-10-10'),
    title: { description: 'Venda', type: 'EXPENSE' },
    billingAccount: { name: 'Banco' },
};

function makeRepo() {
    const entry = { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() };
    const prisma = {
        entry,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return { entry, repo: new EntryReadPrismaRepository(prisma as unknown as PrismaService) };
}

describe('EntryReadPrismaRepository: filtros do bloco 5', () => {
    it('list aplica título, conta, tipo do título e período de pagamento (inclusivo)', async () => {
        const { repo, entry } = makeRepo();
        entry.findMany.mockResolvedValue([row]);
        entry.count.mockResolvedValue(1);
        const paidFrom = day('2026-10-01');
        const paidTo = day('2026-10-31');
        const page = await repo.list(
            'c1',
            { titleId: 't1', billingAccountId: 'a1', titleType: 'EXPENSE', paidFrom, paidTo },
            { page: 1, pageSize: 10 },
        );
        const where = {
            title: { companyId: 'c1', type: 'EXPENSE' },
            titleId: 't1',
            billingAccountId: 'a1',
            paidAt: { gte: paidFrom, lte: paidTo },
        };
        expect(entry.findMany.mock.calls[0][0]).toMatchObject({
            where,
            orderBy: [{ paidAt: 'desc' }, { id: 'asc' }],
        });
        expect(entry.count).toHaveBeenCalledWith({ where });
        expect(page.items[0].titleType).toBe('EXPENSE');
    });

    it('sem filtros só escopa pela empresa; o período aceita um limite só', async () => {
        const { repo, entry } = makeRepo();
        entry.findMany.mockResolvedValue([]);
        entry.count.mockResolvedValue(0);
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(entry.count).toHaveBeenLastCalledWith({ where: { title: { companyId: 'c1' } } });
        const from = day('2026-10-01');
        await repo.list('c1', { paidFrom: from }, { page: 1, pageSize: 10 });
        expect(entry.count).toHaveBeenLastCalledWith({
            where: { title: { companyId: 'c1' }, paidAt: { gte: from } },
        });
        await repo.list('c1', { paidTo: from }, { page: 1, pageSize: 10 });
        expect(entry.count).toHaveBeenLastCalledWith({
            where: { title: { companyId: 'c1' }, paidAt: { lte: from } },
        });
    });

    it('find devolve o tipo do título', async () => {
        const { repo, entry } = makeRepo();
        entry.findFirst.mockResolvedValue(row);
        await expect(repo.find('c1', 'e1')).resolves.toMatchObject({ titleType: 'EXPENSE' });
    });
});
