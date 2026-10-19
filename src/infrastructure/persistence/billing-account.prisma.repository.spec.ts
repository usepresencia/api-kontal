import { accountFixture } from '@test/support/billing-fakes.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
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
    nature: 'ASSET' as const,
    dreCategory: null,
    balanceCategory: null,
    costBehavior: null,
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
    nature: AccountNature.ASSET,
    dreCategory: null,
    balanceCategory: null,
    costBehavior: null,
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
    it('update altera nome, status, tipo e categorias da conta da própria empresa', async () => {
        const { repo, billingAccount } = makeRepo();
        await repo.update('c1', BillingAccountEntity.fromPersistence(accountRow));
        expect(billingAccount.updateMany).toHaveBeenCalledWith({
            where: { id: 'a1', billingPlan: { companyId: 'c1' } },
            data: {
                name: 'Caixa',
                isActive: true,
                accountType: 'ANALYTIC',
                dreCategory: null,
                balanceCategory: null,
                costBehavior: null,
            },
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

describe('BillingAccountPrismaRepository.isInUse', () => {
    function makeUsageRepo(counts: [number, number, number, number]) {
        const [lines, entries, presets, titles] = counts;
        const prisma = {
            journalLine: { count: vi.fn().mockResolvedValue(lines) },
            entry: { count: vi.fn().mockResolvedValue(entries) },
            presetAccount: { count: vi.fn().mockResolvedValue(presets) },
            title: { count: vi.fn().mockResolvedValue(titles) },
        };
        return {
            prisma,
            repo: new BillingAccountPrismaRepository(prisma as unknown as PrismaService),
        };
    }

    it('conta sem nenhum uso', async () => {
        const { repo } = makeUsageRepo([0, 0, 0, 0]);
        await expect(repo.isInUse('a1')).resolves.toBe(false);
    });

    it.each([
        ['linha do razão', [1, 0, 0, 0]],
        ['baixa', [0, 1, 0, 0]],
        ['preset', [0, 0, 1, 0]],
        ['título', [0, 0, 0, 1]],
    ] as const)('conta usada por %s', async (_label, counts) => {
        const { repo } = makeUsageRepo([...counts]);
        await expect(repo.isInUse('a1')).resolves.toBe(true);
    });

    it('consulta cada uso pelo id da conta', async () => {
        const { repo, prisma } = makeUsageRepo([0, 0, 0, 0]);
        await repo.isInUse('a1');
        expect(prisma.journalLine.count).toHaveBeenCalledWith({ where: { accountId: 'a1' } });
        expect(prisma.entry.count).toHaveBeenCalledWith({ where: { billingAccountId: 'a1' } });
        expect(prisma.presetAccount.count).toHaveBeenCalledWith({ where: { accountId: 'a1' } });
        expect(prisma.title.count).toHaveBeenCalledWith({
            where: { OR: [{ controlAccountId: 'a1' }, { resultAccountId: 'a1' }] },
        });
    });
});

describe('BillingAccountPrismaRepository.delete: conta referenciada', () => {
    it('violação de chave estrangeira (P2003) vira ACCOUNT_IN_USE', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.deleteMany.mockRejectedValue(
            Object.assign(new Error('fk'), { code: 'P2003' }),
        );
        await expect(repo.delete('c1', 'a1')).rejects.toMatchObject({ code: 'ACCOUNT_IN_USE' });
    });

    it('propaga erro que não é P2003', async () => {
        const { repo, billingAccount } = makeRepo();
        const boom = new Error('db down');
        billingAccount.deleteMany.mockRejectedValue(boom);
        await expect(repo.delete('c1', 'a1')).rejects.toBe(boom);
    });
});

describe('BillingAccountPrismaRepository.findRefsByIds', () => {
    it('lê só as contas da empresa com os campos de compatibilidade', async () => {
        const { repo, billingAccount } = makeRepo();
        billingAccount.findMany.mockResolvedValue([
            {
                id: 'a1',
                billingPlanId: 'p1',
                accountType: 'ANALYTIC',
                nature: 'ASSET',
                isActive: true,
            },
        ]);
        const refs = await repo.findRefsByIds('c1', ['a1', 'a2']);
        expect(refs).toEqual([
            {
                id: 'a1',
                billingPlanId: 'p1',
                accountType: 'ANALYTIC',
                nature: 'ASSET',
                isActive: true,
            },
        ]);
        expect(billingAccount.findMany).toHaveBeenCalledWith({
            where: { id: { in: ['a1', 'a2'] }, billingPlan: { companyId: 'c1' } },
            select: {
                id: true,
                billingPlanId: true,
                accountType: true,
                nature: true,
                isActive: true,
            },
        });
    });

    it('sem ids não consulta o banco', async () => {
        const { repo, billingAccount } = makeRepo();
        await expect(repo.findRefsByIds('c1', [])).resolves.toEqual([]);
        expect(billingAccount.findMany).not.toHaveBeenCalled();
    });
});

describe('BillingAccountPrismaRepository.moveWithRecode', () => {
    const fields = accountFixture({ id: 'a1' });
    const row = (id: string, code: string, level: number, parentId: string | null = null) => ({
        id,
        billingPlanId: 'p1',
        parentId,
        name: id,
        accountType: 'SYNTHETIC',
        nature: 'ASSET',
        dreCategory: null,
        balanceCategory: null,
        costBehavior: null,
        isActive: true,
        code,
        sortKey: code,
        level,
        createdAt: new Date('2026-01-01'),
    });

    function makeMoveRepo() {
        const model = {
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        };
        const tx = { billingAccount: model, $queryRaw: vi.fn().mockResolvedValue([]) };
        const prisma = {
            $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
        };
        return { model, tx, repo: new BillingAccountPrismaRepository(prisma as never) };
    }

    it('trava o plano, lê conta, novo pai, filhas e irmãs e grava os novos códigos', async () => {
        const { model, tx, repo } = makeMoveRepo();
        model.findFirst
            .mockResolvedValueOnce(row('a1', '1.1', 2, 'old'))
            .mockResolvedValueOnce(row('new', '1.2', 2));
        model.findMany
            .mockResolvedValueOnce([row('c1', '1.1.1', 3, 'a1')])
            .mockResolvedValueOnce([{ code: '1.2.1' }]);
        const plan = vi.fn().mockReturnValue([
            { id: 'a1', code: '1.2.2', level: 3 },
            { id: 'c1', code: '1.2.2.001', level: 4 },
        ]);

        await repo.moveWithRecode('c1', 'p1', 'a1', 'new', plan, fields);

        expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
        expect(plan.mock.calls[0][0].siblingCodes).toEqual(['1.2.1']);
        expect(plan.mock.calls[0][0].descendants.map((item: { id: string }) => item.id)).toEqual([
            'c1',
        ]);
        expect(model.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.objectContaining({ id: 'a1' }) }),
        );
        expect(model.update).toHaveBeenCalledTimes(2);
        expect(model.update.mock.calls[0][0]).toMatchObject({
            where: { id: 'a1' },
            data: { code: '1.2.2', level: 3, parentId: 'new' },
        });
        expect(model.update.mock.calls[1][0].data).not.toHaveProperty('parentId');
    });

    it('conta de outro tenant lança BILLING_ACCOUNT_NOT_FOUND e novo pai fora do plano ACCOUNT_PARENT_INVALID', async () => {
        const { model, repo } = makeMoveRepo();
        model.findFirst.mockResolvedValueOnce(null);
        await expect(
            repo.moveWithRecode('c1', 'p1', 'x', null, vi.fn(), fields),
        ).rejects.toMatchObject({
            code: 'BILLING_ACCOUNT_NOT_FOUND',
        });
        model.findFirst.mockResolvedValueOnce(row('a1', '1.1', 2)).mockResolvedValueOnce(null);
        await expect(
            repo.moveWithRecode('c1', 'p1', 'a1', 'zzz', vi.fn(), fields),
        ).rejects.toMatchObject({
            code: 'ACCOUNT_PARENT_INVALID',
        });
    });

    it('colisão de código vira CONFLICT', async () => {
        const { model, repo } = makeMoveRepo();
        model.findFirst.mockResolvedValueOnce(row('a1', '1.1', 2));
        model.findMany.mockResolvedValue([]);
        model.update.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
        await expect(
            repo.moveWithRecode(
                'c1',
                'p1',
                'a1',
                null,
                () => [{ id: 'a1', code: '2', level: 1 }],
                fields,
            ),
        ).rejects.toMatchObject({ code: 'CONFLICT' });
    });
});
