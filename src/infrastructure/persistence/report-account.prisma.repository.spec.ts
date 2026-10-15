import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { ReportAccountPrismaRepository } from '@/infrastructure/persistence/report-account.prisma.repository.js';

describe('ReportAccountPrismaRepository.list', () => {
    it('lê todas as contas do plano da empresa em ordem natural de código, com os campos dos relatórios', async () => {
        const rows = [
            {
                id: 'a1',
                parentId: null,
                code: '1',
                name: 'Ativo',
                level: 1,
                nature: 'ASSET',
                accountType: 'SYNTHETIC',
                dreCategory: null,
                balanceCategory: null,
            },
        ];
        const prisma = { billingAccount: { findMany: vi.fn().mockResolvedValue(rows) } };
        const repo = new ReportAccountPrismaRepository(prisma as unknown as PrismaService);
        await expect(repo.list('c1', 'p1')).resolves.toEqual(rows);
        expect(prisma.billingAccount.findMany).toHaveBeenCalledWith({
            where: { billingPlanId: 'p1', billingPlan: { companyId: 'c1' } },
            orderBy: { sortKey: 'asc' },
            select: {
                id: true,
                parentId: true,
                code: true,
                name: true,
                level: true,
                nature: true,
                accountType: true,
                dreCategory: true,
                balanceCategory: true,
            },
        });
    });
});
