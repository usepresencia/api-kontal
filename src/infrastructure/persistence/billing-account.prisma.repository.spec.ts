import { AccountType } from '@/domain/billing/account-type.js';
import { BillingAccountEntity } from '@/domain/entities/billing-account.entity.js';
import { BillingAccountPrismaRepository } from '@/infrastructure/persistence/billing-account.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const accountRow = {
    id: 'a1',
    billingPlanId: 'p1',
    parentId: 'a0',
    name: 'Caixa',
    accountType: 'ANALYTIC' as const,
    isActive: true,
    code: '1.1',
    sortKey: '000000001.000000001',
    level: 2,
    createdAt: new Date('2026-01-01'),
    parent: { name: 'Ativo' },
    billingPlan: { name: 'Plano' },
};
const draft = {
    id: 'a2',
    billingPlanId: 'p1',
    parentId: null as string | null,
    name: 'Passivo',
    accountType: AccountType.SYNTHETIC,
    isActive: true,
    level: 1,
};
const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

function makeRepo() {
    const tx = {
        $queryRaw: vi.fn(),
        billingAccount: { findMany: vi.fn(), create: vi.fn() },
    };
    const billingAccount = {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
    };
    const prisma = {
        billingAccount,
        $transaction: vi.fn(async (arg: unknown) =>
            typeof arg === 'function'
                ? (arg as (client: typeof tx) => Promise<unknown>)(tx)
                : Promise.all(arg as Promise<unknown>[]),
        ),
    };
    return {
        tx,
        billingAccount,
        repo: new BillingAccountPrismaRepository(prisma as unknown as PrismaService),
    };
}

describe('BillingAccountPrismaRepository: leituras escopadas por empresa', () => {
    it('findById filtra pela empresa do plano e lê pai e plano no mesmo join', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findFirst.mockResolvedValue(accountRow);
        const view = await repo.findById('c1', 'a1');
        expect(view).toMatchObject({ parentName: 'Ativo', billingPlanName: 'Plano' });
        expect(view?.account.code).toBe('1.1');
        expect(billingAccount.findFirst).toHaveBeenCalledWith({
            where: { id: 'a1', billingPlan: { companyId: 'c1' } },
            include: {
                parent: { select: { name: true } },
                billingPlan: { select: { name: true } },
            },
            relationLoadStrategy: 'join',
        });
    });

    it('findById devolve null quando não acha', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findFirst.mockResolvedValue(null);
        await expect(repo.findById('c1', 'x')).resolves.toBeNull();
    });

    it('findParent exige o mesmo plano e a mesma empresa', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findFirst.mockResolvedValue(accountRow);
        await repo.findParent('c1', 'p1', 'a0');
        expect(billingAccount.findFirst).toHaveBeenCalledWith({
            where: { id: 'a0', billingPlanId: 'p1', billingPlan: { companyId: 'c1' } },
        });
    });

    it('findParent devolve null quando não acha', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findFirst.mockResolvedValue(null);
        await expect(repo.findParent('c1', 'p1', 'a0')).resolves.toBeNull();
    });

    it('list pagina ordenando por plano e chave natural, com filtro opcional de plano', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findMany.mockResolvedValue([accountRow]);
        billingAccount.count.mockResolvedValue(1);
        await repo.list('c1', { planId: 'p1' }, { page: 1, pageSize: 10 });
        const where = { billingPlan: { companyId: 'c1' }, billingPlanId: 'p1' };
        expect(billingAccount.findMany).toHaveBeenCalledWith({
            where,
            orderBy: [{ billingPlanId: 'asc' }, { sortKey: 'asc' }],
            skip: 0,
            take: 10,
            include: {
                parent: { select: { name: true } },
                billingPlan: { select: { name: true } },
            },
            relationLoadStrategy: 'join',
        });
        expect(billingAccount.count).toHaveBeenCalledWith({ where });
    });

    it('list sem filtro de plano só escopa pela empresa', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findMany.mockResolvedValue([]);
        billingAccount.count.mockResolvedValue(0);
        await repo.list('c1', {}, { page: 1, pageSize: 10 });
        expect(billingAccount.count).toHaveBeenCalledWith({
            where: { billingPlan: { companyId: 'c1' } },
        });
    });

    it('listByPlan devolve todas as contas do plano em ordem natural', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findMany.mockResolvedValue([accountRow]);
        const views = await repo.listByPlan('c1', 'p1');
        expect(views).toHaveLength(1);
        expect(billingAccount.findMany).toHaveBeenCalledWith({
            where: { billingPlanId: 'p1', billingPlan: { companyId: 'c1' } },
            orderBy: { sortKey: 'asc' },
            include: {
                parent: { select: { name: true } },
                billingPlan: { select: { name: true } },
            },
            relationLoadStrategy: 'join',
        });
    });
});

describe('BillingAccountPrismaRepository: escritas escopadas por empresa', () => {
    it('update altera só nome, status e tipo da conta da própria empresa', async () => {
        const { repo, billingAccount } = makeRepo();
        await repo.update('c1', BillingAccountEntity.fromPersistence(accountRow));
        expect(billingAccount.updateMany).toHaveBeenCalledWith({
            where: { id: 'a1', billingPlan: { companyId: 'c1' } },
            data: { name: 'Caixa', isActive: true, accountType: 'ANALYTIC' },
        });
    });

    it('hasChildren conta as filhas', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
        await expect(repo.hasChildren('a1')).resolves.toBe(true);
        await expect(repo.hasChildren('a1')).resolves.toBe(false);
        expect(billingAccount.count).toHaveBeenCalledWith({ where: { parentId: 'a1' } });
    });

    it('delete remove só a conta da própria empresa', async () => {
        const { repo, billingAccount } = makeRepo();
        await repo.delete('c1', 'a1');
        expect(billingAccount.deleteMany).toHaveBeenCalledWith({
            where: { id: 'a1', billingPlan: { companyId: 'c1' } },
        });
    });
});

describe('BillingAccountPrismaRepository.insertWithNextCode', () => {
    it('conta raiz: trava o plano, lê os irmãos da raiz e grava o código gerado', async () => {
        const { repo, tx } = makeRepo();
        tx.$queryRaw.mockResolvedValue([{ id: 'p1' }]);
        tx.billingAccount.findMany.mockResolvedValue([{ code: '1' }, { code: '2' }]);
        tx.billingAccount.create.mockResolvedValue({
            ...accountRow,
            id: 'a2',
            parentId: null,
            code: '3',
            parent: null,
        });
        const nextCode = vi.fn().mockReturnValue('3');

        const view = await repo.insertWithNextCode(draft, nextCode);

        expect(nextCode).toHaveBeenCalledWith(null, ['1', '2']);
        expect(tx.billingAccount.findMany).toHaveBeenCalledWith({
            where: { billingPlanId: 'p1', parentId: null },
            select: { code: true },
        });
        expect(tx.billingAccount.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ id: 'a2', code: '3', sortKey: '000000003', level: 1 }),
            include: {
                parent: { select: { name: true } },
                billingPlan: { select: { name: true } },
            },
            relationLoadStrategy: 'join',
        });
        expect(view.account.code).toBe('3');
        expect(view.parentName).toBeNull();
    });

    it('conta filha: trava o pai, usa o código dele e lê só os irmãos dele', async () => {
        const { repo, tx } = makeRepo();
        tx.$queryRaw.mockResolvedValue([{ code: '1' }]);
        tx.billingAccount.findMany.mockResolvedValue([{ code: '1.1' }]);
        tx.billingAccount.create.mockResolvedValue({ ...accountRow, code: '1.2' });
        const nextCode = vi.fn().mockReturnValue('1.2');

        await repo.insertWithNextCode({ ...draft, parentId: 'a0', level: 2 }, nextCode);

        expect(nextCode).toHaveBeenCalledWith('1', ['1.1']);
        expect(tx.billingAccount.findMany).toHaveBeenCalledWith({
            where: { billingPlanId: 'p1', parentId: 'a0' },
            select: { code: true },
        });
    });

    it('pai que sumiu durante a criação vira ACCOUNT_PARENT_INVALID', async () => {
        const { repo, tx } = makeRepo();
        tx.$queryRaw.mockResolvedValue([]);
        await expect(
            repo.insertWithNextCode({ ...draft, parentId: 'a0', level: 2 }, vi.fn()),
        ).rejects.toMatchObject({ code: 'ACCOUNT_PARENT_INVALID' });
    });

    it('colisão do índice único (P2002) vira DomainError CONFLICT', async () => {
        const { repo, tx } = makeRepo();
        tx.$queryRaw.mockResolvedValue([{ id: 'p1' }]);
        tx.billingAccount.findMany.mockResolvedValue([]);
        tx.billingAccount.create.mockRejectedValue(p2002);
        await expect(repo.insertWithNextCode(draft, () => '1')).rejects.toMatchObject({
            code: 'CONFLICT',
        });
    });

    it('propaga erro que não é P2002', async () => {
        const { repo, tx } = makeRepo();
        const boom = new Error('db down');
        tx.$queryRaw.mockRejectedValue(boom);
        await expect(repo.insertWithNextCode(draft, () => '1')).rejects.toBe(boom);
    });
});
