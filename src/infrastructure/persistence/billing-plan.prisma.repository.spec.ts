import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import { BillingPlanPrismaRepository } from '@/infrastructure/persistence/billing-plan.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const planRow = {
    id: 'p1',
    companyId: 'c1',
    name: 'Plano',
    description: 'desc',
    createdAt: new Date('2026-01-01'),
};

function makeRepo() {
    const billingPlan = {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
    };
    const billingAccount = { count: vi.fn() };
    const prisma = {
        billingPlan,
        billingAccount,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return {
        billingPlan,
        billingAccount,
        repo: new BillingPlanPrismaRepository(prisma as unknown as PrismaService),
    };
}

describe('BillingPlanPrismaRepository', () => {
    it('create grava o plano com a empresa', async () => {
        const { repo, billingPlan } = makeRepo();
        await repo.create(BillingPlanEntity.fromPersistence(planRow));
        expect(billingPlan.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ id: 'p1', companyId: 'c1', name: 'Plano' }),
        });
    });

    it('findById filtra por id E empresa e devolve null quando não acha', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.findFirst.mockResolvedValue(null);
        await expect(repo.findById('c1', 'p1')).resolves.toBeNull();
        expect(billingPlan.findFirst).toHaveBeenCalledWith({
            where: { id: 'p1', companyId: 'c1' },
        });
    });

    it('findById reidrata a entidade', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.findFirst.mockResolvedValue(planRow);
        await expect(repo.findById('c1', 'p1')).resolves.toMatchObject({ id: 'p1', name: 'Plano' });
    });

    it('list pagina só os planos da empresa, ordenados por nome', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.findMany.mockResolvedValue([planRow]);
        billingPlan.count.mockResolvedValue(21);
        const page = await repo.list('c1', { page: 3, pageSize: 10 });
        expect(billingPlan.findMany).toHaveBeenCalledWith({
            where: { companyId: 'c1' },
            orderBy: { name: 'asc' },
            skip: 20,
            take: 10,
        });
        expect(billingPlan.count).toHaveBeenCalledWith({ where: { companyId: 'c1' } });
        expect(page).toMatchObject({ page: 3, pageSize: 10, total: 21 });
    });

    it('update altera só o plano da própria empresa', async () => {
        const { repo, billingPlan } = makeRepo();
        await repo.update(BillingPlanEntity.fromPersistence(planRow));
        expect(billingPlan.updateMany).toHaveBeenCalledWith({
            where: { id: 'p1', companyId: 'c1' },
            data: { name: 'Plano', description: 'desc' },
        });
    });

    it('hasAccounts conta as contas do plano', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
        await expect(repo.hasAccounts('p1')).resolves.toBe(true);
        await expect(repo.hasAccounts('p1')).resolves.toBe(false);
        expect(billingAccount.count).toHaveBeenCalledWith({ where: { billingPlanId: 'p1' } });
    });

    it('delete remove só o plano da própria empresa', async () => {
        const { repo, billingPlan } = makeRepo();
        await repo.delete('c1', 'p1');
        expect(billingPlan.deleteMany).toHaveBeenCalledWith({
            where: { id: 'p1', companyId: 'c1' },
        });
    });
});
