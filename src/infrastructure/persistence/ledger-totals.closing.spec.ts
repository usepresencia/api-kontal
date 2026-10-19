import { LedgerTotalsPrismaRepository } from '@/infrastructure/persistence/ledger-totals.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const sqlOf = (prisma: { $queryRaw: ReturnType<typeof vi.fn> }) =>
    (prisma.$queryRaw.mock.calls[0][0] as string[]).join('?');

function makeRepo() {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([]) };
    return { prisma, repo: new LedgerTotalsPrismaRepository(prisma as unknown as PrismaService) };
}

describe('LedgerTotalsPrismaRepository: lançamentos de apuração', () => {
    it('monthlyMovements (base do DRE) exclui CLOSING e CLOSING_REVERSAL', async () => {
        const { repo, prisma } = makeRepo();
        await repo.monthlyMovements('c1', 'p1', day('2026-01-01'), day('2026-12-31'));
        expect(sqlOf(prisma)).toContain(`"referenceType" NOT IN ('CLOSING', 'CLOSING_REVERSAL')`);
    });

    it('balancete e saldos até a data incluem a apuração', async () => {
        const { repo, prisma } = makeRepo();
        await repo.trialBalance('c1', 'p1', day('2026-01-01'), day('2026-12-31'));
        await repo.balancesUntil('c1', 'p1', day('2026-12-31'));
        const joined = prisma.$queryRaw.mock.calls
            .map(call => (call[0] as string[]).join('?'))
            .join('\n');
        expect(joined).not.toContain('CLOSING');
    });
});
