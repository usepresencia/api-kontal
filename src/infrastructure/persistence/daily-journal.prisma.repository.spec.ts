import { DailyJournalPrismaRepository } from '@/infrastructure/persistence/daily-journal.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makeRepo() {
    const prisma = { $queryRaw: vi.fn(), journalEntry: { findMany: vi.fn() } };
    return { prisma, repo: new DailyJournalPrismaRepository(prisma as unknown as PrismaService) };
}

describe('DailyJournalPrismaRepository', () => {
    it('days: dias com movimento do plano em ordem crescente, paginados, com o total de dias', async () => {
        const { prisma, repo } = makeRepo();
        prisma.$queryRaw
            .mockResolvedValueOnce([{ date: day('2026-10-02'), debits: '10.00', credits: '10.00' }])
            .mockResolvedValueOnce([{ total: 9 }]);
        const page = await repo.days('c1', 'p1', day('2026-10-01'), day('2026-10-31'), {
            page: 2,
            pageSize: 7,
        });
        expect(page).toEqual({
            items: [{ date: day('2026-10-02'), debits: 1000, credits: 1000 }],
            page: 2,
            pageSize: 7,
            total: 9,
        });
        const [strings, ...values] = prisma.$queryRaw.mock.calls[0];
        expect((strings as string[]).join('?')).toContain('ORDER BY j."date"');
        expect(values).toEqual(['c1', 'p1', day('2026-10-01'), day('2026-10-31'), 7, 7]);
    });

    it('entriesOn: lançamentos dos dias com linhas no plano, por data e número; sem dias não consulta', async () => {
        const { prisma, repo } = makeRepo();
        prisma.journalEntry.findMany.mockResolvedValue([]);
        await expect(repo.entriesOn('c1', 'p1', [])).resolves.toEqual([]);
        expect(prisma.journalEntry.findMany).not.toHaveBeenCalled();
        await repo.entriesOn('c1', 'p1', [day('2026-10-02')]);
        expect(prisma.journalEntry.findMany.mock.calls[0][0]).toMatchObject({
            where: {
                companyId: 'c1',
                date: { in: [day('2026-10-02')] },
                lines: { some: { account: { billingPlanId: 'p1' } } },
            },
            orderBy: [{ date: 'asc' }, { number: 'asc' }],
        });
    });
});
