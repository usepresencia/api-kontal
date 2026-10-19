import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { PresetPrismaRepository } from '@/infrastructure/persistence/preset.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const preset = PresetEntity.create({
    id: 'pr1',
    billingPlanId: 'p1',
    name: 'Venda',
    description: 'desc',
    accounts: { receivable: 'ar', payable: 'ap', revenue: 'rev', interestIncome: 'jr' },
});

const presetRow = {
    id: 'pr1',
    billingPlanId: 'p1',
    name: 'Venda',
    description: 'desc',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    billingPlan: { name: 'Plano' },
    accounts: [
        { role: 'receivable', accountId: 'ar', account: { name: 'Clientes' } },
        { role: 'payable', accountId: 'ap', account: { name: 'Fornecedores' } },
        { role: 'revenue', accountId: 'rev', account: { name: 'Vendas' } },
    ],
};
const refsInclude = {
    billingPlan: { select: { name: true } },
    accounts: { include: { account: { select: { name: true } } } },
};
const p2003 = Object.assign(new Error('fk'), { code: 'P2003' });

function makeRepo() {
    const presetModel = {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
    };
    const title = { count: vi.fn() };
    const prisma = {
        preset: presetModel,
        title,
        $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    return {
        presetModel,
        title,
        repo: new PresetPrismaRepository(prisma as unknown as PrismaService),
    };
}

describe('PresetPrismaRepository', () => {
    it('create grava o preset com uma linha por conta informada', async () => {
        const { repo, presetModel } = makeRepo();
        await repo.create(preset);
        expect(presetModel.create).toHaveBeenCalledWith({
            data: {
                id: 'pr1',
                billingPlanId: 'p1',
                name: 'Venda',
                description: 'desc',
                isActive: true,
                createdAt: preset.createdAt,
                accounts: {
                    create: [
                        { role: 'receivable', accountId: 'ar' },
                        { role: 'payable', accountId: 'ap' },
                        { role: 'revenue', accountId: 'rev' },
                        { role: 'interestIncome', accountId: 'jr' },
                    ],
                },
            },
        });
    });

    it('findById escopa pela empresa do plano e lê plano e contas em um join', async () => {
        const { repo, presetModel } = makeRepo();
        presetModel.findFirst.mockResolvedValue(presetRow);
        const view = await repo.findById('c1', 'pr1');
        expect(presetModel.findFirst).toHaveBeenCalledWith({
            where: { id: 'pr1', billingPlan: { companyId: 'c1' } },
            include: refsInclude,
            relationLoadStrategy: 'join',
        });
        expect(view?.billingPlanName).toBe('Plano');
        expect(view?.preset.accounts).toMatchObject({
            receivable: 'ar',
            payable: 'ap',
            revenue: 'rev',
            expense: null,
        });
        expect(view?.accountNames).toMatchObject({
            receivable: 'Clientes',
            revenue: 'Vendas',
            expense: null,
        });
    });

    it('findById devolve null quando não acha', async () => {
        const { repo, presetModel } = makeRepo();
        presetModel.findFirst.mockResolvedValue(null);
        await expect(repo.findById('c1', 'x')).resolves.toBeNull();
    });

    it('list pagina por nome, escopa pela empresa e aplica os filtros', async () => {
        const { repo, presetModel } = makeRepo();
        presetModel.findMany.mockResolvedValue([presetRow]);
        presetModel.count.mockResolvedValue(11);
        const page = await repo.list(
            'c1',
            { billingPlanId: 'p1', isActive: true },
            { page: 2, pageSize: 5 },
        );
        const where = { billingPlan: { companyId: 'c1' }, billingPlanId: 'p1', isActive: true };
        expect(presetModel.findMany).toHaveBeenCalledWith({
            where,
            orderBy: { name: 'asc' },
            skip: 5,
            take: 5,
            include: refsInclude,
            relationLoadStrategy: 'join',
        });
        expect(presetModel.count).toHaveBeenCalledWith({ where });
        expect(page).toMatchObject({ page: 2, pageSize: 5, total: 11 });
    });

    it('list sem filtros só escopa pela empresa', async () => {
        const { repo, presetModel } = makeRepo();
        presetModel.findMany.mockResolvedValue([]);
        presetModel.count.mockResolvedValue(0);
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(presetModel.count).toHaveBeenCalledWith({
            where: { billingPlan: { companyId: 'c1' } },
        });
    });

    it('update troca as contas no mesmo comando e escopa pela empresa', async () => {
        const { repo, presetModel } = makeRepo();
        await repo.update('c1', preset);
        expect(presetModel.update).toHaveBeenCalledWith({
            where: { id: 'pr1', billingPlan: { companyId: 'c1' } },
            data: {
                name: 'Venda',
                description: 'desc',
                isActive: true,
                accounts: {
                    deleteMany: {},
                    create: [
                        { role: 'receivable', accountId: 'ar' },
                        { role: 'payable', accountId: 'ap' },
                        { role: 'revenue', accountId: 'rev' },
                        { role: 'interestIncome', accountId: 'jr' },
                    ],
                },
            },
        });
    });

    it('isInUse conta os títulos do preset', async () => {
        const { repo, title } = makeRepo();
        title.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        await expect(repo.isInUse('pr1')).resolves.toBe(true);
        await expect(repo.isInUse('pr1')).resolves.toBe(false);
        expect(title.count).toHaveBeenCalledWith({ where: { presetId: 'pr1' } });
    });

    it('delete remove só o preset da própria empresa', async () => {
        const { repo, presetModel } = makeRepo();
        await repo.delete('c1', 'pr1');
        expect(presetModel.deleteMany).toHaveBeenCalledWith({
            where: { id: 'pr1', billingPlan: { companyId: 'c1' } },
        });
    });

    it('delete: violação de chave estrangeira (P2003) vira PRESET_IN_USE', async () => {
        const { repo, presetModel } = makeRepo();
        presetModel.deleteMany.mockRejectedValue(p2003);
        await expect(repo.delete('c1', 'pr1')).rejects.toMatchObject({ code: 'PRESET_IN_USE' });
    });

    it('delete propaga erro que não é P2003', async () => {
        const { repo, presetModel } = makeRepo();
        const boom = new Error('db down');
        presetModel.deleteMany.mockRejectedValue(boom);
        await expect(repo.delete('c1', 'pr1')).rejects.toBe(boom);
    });
});
