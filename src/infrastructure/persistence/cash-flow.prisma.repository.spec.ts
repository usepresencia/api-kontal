import { CashFlowPrismaRepository } from '@/infrastructure/persistence/cash-flow.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const start = day('2026-10-01');
const end = day('2026-10-31');

function makeRepo(rows: unknown[]) {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue(rows) };
    return { prisma, repo: new CashFlowPrismaRepository(prisma as unknown as PrismaService) };
}
const sqlOf = (prisma: { $queryRaw: ReturnType<typeof vi.fn> }) => {
    const [strings, ...values] = prisma.$queryRaw.mock.calls[0];
    return { sql: (strings as string[]).join('?'), values };
};

describe('CashFlowPrismaRepository.totals', () => {
    it.each([
        ['month', 'to_char(e."paidAt", \'YYYY-MM\')'],
        ['day', 'to_char(e."paidAt", \'YYYY-MM-DD\')'],
        [undefined, "''"],
    ] as const)(
        'groupBy %s agrupa por conta, período e tipo só de pagamentos do plano',
        async (groupBy, bucket) => {
            const { repo, prisma } = makeRepo([
                { accountId: 'a', bucket: '2026-10', type: 'INCOME', amount: '10.50' },
            ]);
            await expect(repo.totals('c1', 'p1', start, end, groupBy)).resolves.toEqual([
                { accountId: 'a', bucket: '2026-10', type: 'INCOME', amount: 1050 },
            ]);
            const { sql, values } = sqlOf(prisma);
            expect((values[0] as { sql: string }).sql).toBe(bucket);
            expect(sql).toContain('e."kind" = \'PAYMENT\'');
            expect(sql).toContain('GROUP BY 1, 2, 3');
            expect(values.slice(1)).toEqual(['c1', 'p1', start, end]);
        },
    );
});

describe('CashFlowPrismaRepository.payments', () => {
    it('lê os pagamentos do período com título e conta, em ordem de data e plano', async () => {
        const { repo, prisma } = makeRepo([
            {
                entryId: 'e1',
                titleId: 't1',
                titleDescription: 'Venda',
                type: 'INCOME',
                accountId: 'a',
                accountCode: '1.1',
                accountName: 'Banco',
                paymentMethod: 'PIX',
                paidAt: day('2026-10-05'),
                amount: '615.00',
            },
        ]);
        await expect(repo.payments('c1', 'p1', start, end)).resolves.toEqual([
            {
                entryId: 'e1',
                titleId: 't1',
                titleDescription: 'Venda',
                type: 'INCOME',
                accountId: 'a',
                accountCode: '1.1',
                accountName: 'Banco',
                paymentMethod: 'PIX',
                paidAt: day('2026-10-05'),
                amount: 61500,
            },
        ]);
        const { sql, values } = sqlOf(prisma);
        expect(sql).toContain('ORDER BY e."paidAt", a."sortKey"');
        expect(values).toEqual(['c1', 'p1', start, end]);
    });
});
