import { AccountLedgerPrismaRepository } from '@/infrastructure/persistence/account-ledger.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const start = day('2026-10-01');
const end = day('2026-10-31');

function makeRepo() {
    const prisma = { $queryRaw: vi.fn(), journalLine: { findMany: vi.fn() } };
    return { prisma, repo: new AccountLedgerPrismaRepository(prisma as unknown as PrismaService) };
}
const sqlOf = (call: unknown[]) => (call[0] as string[]).join('?');

describe('AccountLedgerPrismaRepository', () => {
    it('totals: saldo anterior e movimento do período das contas em uma query', async () => {
        const { prisma, repo } = makeRepo();
        prisma.$queryRaw.mockResolvedValue([
            { openingDebit: '1.00', openingCredit: '0', debit: '2.00', credit: '0.50' },
        ]);
        await expect(repo.totals('c1', ['a', 'b'], start, end)).resolves.toEqual({
            openingDebit: 100,
            openingCredit: 0,
            debit: 200,
            credit: 50,
        });
        expect(sqlOf(prisma.$queryRaw.mock.calls[0])).toContain('FILTER');
    });

    it('items: página com saldo acumulado por janela, total e contrapartidas em uma query extra', async () => {
        const { prisma, repo } = makeRepo();
        prisma.$queryRaw
            .mockResolvedValueOnce([
                {
                    journalEntryId: 'j1',
                    number: '7',
                    date: day('2026-10-02'),
                    description: 'd',
                    referenceType: 'MANUAL',
                    debit: '0',
                    credit: '3.00',
                    running: '-3.00',
                },
            ])
            .mockResolvedValueOnce([{ total: 11 }]);
        prisma.journalLine.findMany.mockResolvedValue([
            { journalEntryId: 'j1', account: { code: '3.1', name: 'Vendas' } },
            { journalEntryId: 'j1', account: { code: '3.1', name: 'Vendas' } },
        ]);
        const page = await repo.items('c1', ['a'], start, end, { page: 2, pageSize: 5 });
        expect(sqlOf(prisma.$queryRaw.mock.calls[0])).toContain('OVER (ORDER BY');
        expect(page).toEqual({
            items: [
                {
                    journalEntryId: 'j1',
                    number: 7,
                    date: day('2026-10-02'),
                    description: 'd',
                    referenceType: 'MANUAL',
                    debit: 0,
                    credit: 300,
                    running: -300,
                    counterparts: [{ code: '3.1', name: 'Vendas' }],
                },
            ],
            page: 2,
            pageSize: 5,
            total: 11,
        });
        expect(prisma.journalLine.findMany).toHaveBeenCalledWith({
            where: { journalEntryId: { in: ['j1'] }, accountId: { notIn: ['a'] } },
            select: { journalEntryId: true, account: { select: { code: true, name: true } } },
            orderBy: { account: { sortKey: 'asc' } },
        });
    });

    it('items: página vazia não busca contrapartidas', async () => {
        const { prisma, repo } = makeRepo();
        prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
        await expect(
            repo.items('c1', ['a'], start, end, { page: 1, pageSize: 5 }),
        ).resolves.toMatchObject({ items: [], total: 0 });
        expect(prisma.journalLine.findMany).not.toHaveBeenCalled();
    });

    it('days: débitos e créditos por dia em ordem crescente', async () => {
        const { prisma, repo } = makeRepo();
        prisma.$queryRaw.mockResolvedValue([
            { date: day('2026-10-02'), debit: '1.00', credit: '0' },
        ]);
        await expect(repo.days('c1', ['a'], start, end)).resolves.toEqual([
            { date: day('2026-10-02'), debit: 100, credit: 0 },
        ]);
        expect(sqlOf(prisma.$queryRaw.mock.calls[0])).toContain('GROUP BY j."date"');
    });
});
