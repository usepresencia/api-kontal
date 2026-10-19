import { Prisma } from '@prisma/client';
import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import { BillingPlanPrismaRepository } from '@/infrastructure/persistence/billing-plan.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const planRow = {
    id: 'p1',
    companyId: 'c1',
    name: 'Plano',
    description: 'desc',
    isDefault: false,
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
    it('create grava o primeiro plano da empresa como padrão', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.count.mockResolvedValue(0);
        billingPlan.create.mockResolvedValue({ ...planRow, isDefault: true });
        const created = await repo.create(BillingPlanEntity.fromPersistence(planRow));
        expect(billingPlan.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ id: 'p1', companyId: 'c1', isDefault: true }),
        });
        expect(created.isDefault).toBe(true);
    });

    it('create grava os planos seguintes sem ser o padrão', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.count.mockResolvedValue(1);
        billingPlan.create.mockResolvedValue(planRow);
        await repo.create(BillingPlanEntity.fromPersistence(planRow));
        expect(billingPlan.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ isDefault: false }),
        });
    });

    it('create grava como não padrão quando outro primeiro plano ganhou a corrida', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.count.mockResolvedValue(0);
        billingPlan.create
            .mockRejectedValueOnce(
                new Prisma.PrismaClientKnownRequestError('dup', {
                    code: 'P2002',
                    clientVersion: 'x',
                }),
            )
            .mockResolvedValueOnce(planRow);
        const created = await repo.create(BillingPlanEntity.fromPersistence(planRow));
        expect(billingPlan.create).toHaveBeenLastCalledWith({
            data: expect.objectContaining({ isDefault: false }),
        });
        expect(created.isDefault).toBe(false);
    });

    it('findDefault busca o plano padrão da empresa', async () => {
        const { repo, billingPlan } = makeRepo();
        billingPlan.findFirst.mockResolvedValue({ ...planRow, isDefault: true });
        await expect(repo.findDefault('c1')).resolves.toMatchObject({ id: 'p1', isDefault: true });
        expect(billingPlan.findFirst).toHaveBeenCalledWith({
            where: { companyId: 'c1', isDefault: true },
        });
    });

    it('setDefault desmarca o padrão atual e marca o novo na mesma transação', async () => {
        const { repo, billingPlan } = makeRepo();
        await repo.setDefault('c1', 'p2');
        expect(billingPlan.updateMany).toHaveBeenNthCalledWith(1, {
            where: { companyId: 'c1', isDefault: true },
            data: { isDefault: false },
        });
        expect(billingPlan.updateMany).toHaveBeenNthCalledWith(2, {
            where: { id: 'p2', companyId: 'c1' },
            data: { isDefault: true },
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
