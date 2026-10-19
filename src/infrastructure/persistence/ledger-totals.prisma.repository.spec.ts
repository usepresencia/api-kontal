import { LedgerTotalsPrismaRepository } from '@/infrastructure/persistence/ledger-totals.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

function makeRepo(rows: unknown[]) {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
    return { prisma, repo: new LedgerTotalsPrismaRepository(prisma as unknown as PrismaService) };
}
const sqlOf = (prisma: { $queryRaw: ReturnType<typeof vi.fn> }) => {
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0];
    return { sql: (strings as string[]).join('?'), values };
};
const start = new Date('2026-10-01T00:00:00.000Z');
const end = new Date('2026-10-31T00:00:00.000Z');

describe('LedgerTotalsPrismaRepository', () => {
    it('monthlyMovements: soma por conta e mês só de receitas e despesas, no período e no plano da empresa', async () => {
        const { repo, prisma } = makeRepo([
            { accountId: 'a', month: '2026-10', debit: '0.00', credit: '10.50' },
        ]);
        await expect(repo.monthlyMovements('c1', 'p1', start, end)).resolves.toEqual([
            { accountId: 'a', month: '2026-10', debit: 0, credit: 1050 },
        ]);
        const { sql, values } = sqlOf(prisma);
        expect(sql).toContain("'REVENUE', 'EXPENSE'");
        expect(sql).toContain('GROUP BY');
        expect(values).toEqual(['c1', 'p1', start, end]);
    });

    it('trialBalance: saldo anterior e movimento do período por conta, em uma query', async () => {
        const { repo, prisma } = makeRepo([
            {
                accountId: 'a',
                openingDebit: '5.00',
                openingCredit: '0.00',
                debit: '1.00',
                credit: '2.00',
            },
        ]);
        await expect(repo.trialBalance('c1', 'p1', start, end)).resolves.toEqual([
            { accountId: 'a', openingDebit: 500, openingCredit: 0, debit: 100, credit: 200 },
        ]);
        const { sql, values } = sqlOf(prisma);
        expect(sql).toContain('FILTER');
        expect(values).toEqual([start, start, start, start, 'c1', 'p1', end]);
    });

    it('balancesUntil: débitos e créditos acumulados até a data, por conta', async () => {
        const { repo, prisma } = makeRepo([{ accountId: 'a', debit: '3.00', credit: '1.00' }]);
        await expect(repo.balancesUntil('c1', 'p1', end)).resolves.toEqual([
            { accountId: 'a', debit: 300, credit: 100 },
        ]);
        const { values } = sqlOf(prisma);
        expect(values).toEqual(['c1', 'p1', end]);
    });
});
