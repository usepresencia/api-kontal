import { PeriodClosingReadPrismaRepository } from '@/infrastructure/persistence/period-closing-read.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

describe('PeriodClosingReadPrismaRepository', () => {
    it('lê a trava e os fechamentos da empresa, do mais recente ao mais antigo, em uma consulta', async () => {
        const closedThrough = new Date('2026-09-30T00:00:00.000Z');
        const items = [
            {
                id: 'p2',
                companyId: 'c1',
                throughDate: closedThrough,
                closingEntryId: null,
                createdAt: new Date(),
            },
        ];
        const company = {
            findUnique: vi.fn().mockResolvedValue({ closedThrough, periodClosings: items }),
        };
        const repo = new PeriodClosingReadPrismaRepository({ company } as unknown as PrismaService);
        await expect(repo.list('c1')).resolves.toEqual({ closedThrough, items });
        expect(company.findUnique).toHaveBeenCalledWith({
            where: { id: 'c1' },
            select: { closedThrough: true, periodClosings: { orderBy: { throughDate: 'desc' } } },
            relationLoadStrategy: 'join',
        });
    });

    it('empresa inexistente devolve trava nula e lista vazia', async () => {
        const company = { findUnique: vi.fn().mockResolvedValue(null) };
        const repo = new PeriodClosingReadPrismaRepository({ company } as unknown as PrismaService);
        await expect(repo.list('x')).resolves.toEqual({ closedThrough: null, items: [] });
    });
});
