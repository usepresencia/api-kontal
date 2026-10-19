import { DeleteBillingAccountService } from '@/application/billing/delete-billing-account.service.js';
import { GetBillingAccountService } from '@/application/billing/get-billing-account.service.js';
import { ListBillingAccountsService } from '@/application/billing/list-billing-accounts.service.js';
import { UpdateBillingAccountService } from '@/application/billing/update-billing-account.service.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { BalanceCategory } from '@/domain/billing/balance-category.js';
import { CostBehavior } from '@/domain/billing/cost-behavior.js';
import { DreCategory } from '@/domain/billing/dre-category.js';
import { accountFixture, fakeAccounts, viewFixture } from '@test/support/billing-fakes.js';

const accounts = fakeAccounts();

beforeEach(() => {
    for (const fn of Object.values(accounts)) fn.mockReset();
});

describe('UpdateBillingAccountService', () => {
    const service = new UpdateBillingAccountService(accounts);

    describe('mudança de pai', () => {
        const mover = accountFixture({ id: 'a1', parentId: 'old', level: 2, code: '1.1' });
        const target = accountFixture({ id: 'new', code: '1.2', level: 2 });

        it('move a conta, passando ao repositório o plano de recodificação, e relê a conta', async () => {
            accounts.findById.mockResolvedValue(viewFixture(mover));
            accounts.moveWithRecode.mockImplementation(
                async (_company, _plan, _id, _parent, plan) =>
                    plan({
                        account: mover,
                        newParent: target,
                        descendants: [],
                        siblingCodes: ['1.2.1'],
                    }),
            );
            await service.execute('c1', 'a1', { parentId: 'new', name: 'Renomeada' });
            const call = accounts.moveWithRecode.mock.calls[0];
            expect(call[5]).toMatchObject({ name: 'Renomeada' });
            expect(call.slice(0, 4)).toEqual(['c1', 'p1', 'a1', 'new']);
            // os demais campos entram na mesma transação do mover, não numa gravação à parte
            expect(accounts.update).not.toHaveBeenCalled();
            expect(accounts.findById).toHaveBeenCalledTimes(2);
        });

        it('o plano gerado recodifica a conta sob o novo pai', async () => {
            accounts.findById.mockResolvedValue(viewFixture(mover));
            let recodes: unknown;
            accounts.moveWithRecode.mockImplementation(
                async (_company, _plan, _id, _parent, plan) => {
                    recodes = plan({
                        account: mover,
                        newParent: target,
                        descendants: [],
                        siblingCodes: ['1.2.1', '1.2.2'],
                    });
                },
            );
            await service.execute('c1', 'a1', { parentId: 'new' });
            expect(recodes).toEqual([{ id: 'a1', code: '1.2.3', level: 3 }]);
        });

        it('o plano usa a conta lida com a trava, não a lida antes dela', async () => {
            accounts.findById.mockResolvedValue(viewFixture(mover));
            const locked = accountFixture({ id: 'a1', parentId: 'old', level: 3, code: '1.9.1' });
            let recodes: unknown;
            accounts.moveWithRecode.mockImplementation(
                async (_company, _plan, _id, _parent, plan) => {
                    recodes = plan({
                        account: locked,
                        newParent: target,
                        descendants: [],
                        siblingCodes: [],
                    });
                },
            );
            await service.execute('c1', 'a1', { parentId: 'new' });
            expect(recodes).toEqual([{ id: 'a1', code: '1.2.1', level: 3 }]);
        });

        it('mover para a raiz envia null e manter o mesmo pai não move nada', async () => {
            accounts.findById.mockResolvedValue(viewFixture(mover));
            accounts.moveWithRecode.mockResolvedValue(undefined);
            await service.execute('c1', 'a1', { parentId: null });
            expect(accounts.moveWithRecode.mock.calls[0][3]).toBeNull();
            accounts.moveWithRecode.mockClear();
            await service.execute('c1', 'a1', { parentId: 'old', name: 'Outro nome' });
            expect(accounts.moveWithRecode).not.toHaveBeenCalled();
        });

        it('valida as categorias antes de mover: se falhar, nada é gravado', async () => {
            accounts.findById.mockResolvedValue(viewFixture(mover));
            await expect(
                service.execute('c1', 'a1', {
                    parentId: 'new',
                    dreCategory: DreCategory.INCOME_TAX,
                }),
            ).rejects.toMatchObject({ code: expect.stringContaining('CATEGORY') });
            expect(accounts.moveWithRecode).not.toHaveBeenCalled();
            expect(accounts.update).not.toHaveBeenCalled();
        });
    });

    it('altera nome e status sem consultar filhas e preserva as referências da leitura', async () => {
        accounts.findById.mockResolvedValue({ ...viewFixture(), billingPlanName: 'Plano X' });
        accounts.update.mockResolvedValue(undefined);
        const view = await service.execute('c1', 'a1', { name: 'Novo', isActive: false });
        expect(view.account).toMatchObject({ name: 'Novo', isActive: false, code: '1' });
        expect(view.billingPlanName).toBe('Plano X');
        expect(accounts.hasChildren).not.toHaveBeenCalled();
        expect(accounts.update).toHaveBeenCalledWith('c1', view.account);
    });

    it('altera as categorias sem consultar o uso da conta', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(accountFixture({ nature: AccountNature.EXPENSE })),
        );
        const view = await service.execute('c1', 'a1', {
            dreCategory: DreCategory.FINANCIAL_EXPENSE,
        });
        expect(view.account.dreCategory).toBe('FINANCIAL_EXPENSE');
        expect(accounts.update).toHaveBeenCalledWith('c1', view.account);
        expect(accounts.isInUse).not.toHaveBeenCalled();
    });

    it('altera o comportamento de custo sem consultar o uso e recusa em outra natureza', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(accountFixture({ nature: AccountNature.EXPENSE })),
        );
        const view = await service.execute('c1', 'a1', { costBehavior: CostBehavior.DEPRECIATION });
        expect(view.account.costBehavior).toBe('DEPRECIATION');
        expect(accounts.isInUse).not.toHaveBeenCalled();
        accounts.findById.mockResolvedValue(viewFixture());
        await expect(
            service.execute('c1', 'a1', { costBehavior: CostBehavior.FIXED }),
        ).rejects.toMatchObject({ code: 'COST_BEHAVIOR_INVALID' });
    });

    it('categoria incompatível com a natureza é recusada sem gravar', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        await expect(
            service.execute('c1', 'a1', { balanceCategory: BalanceCategory.CURRENT_LIABILITY }),
        ).rejects.toMatchObject({ code: 'BALANCE_CATEGORY_INVALID' });
        expect(accounts.update).not.toHaveBeenCalled();
    });

    it('virar sintética não consulta filhas', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(accountFixture({ accountType: AccountType.ANALYTIC, parentId: 'a0' })),
        );
        await service.execute('c1', 'a1', { accountType: AccountType.SYNTHETIC });
        expect(accounts.hasChildren).not.toHaveBeenCalled();
    });

    it('virar analítica sem filhas e com pai é permitido', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(accountFixture({ parentId: 'a0', level: 2 })),
        );
        accounts.hasChildren.mockResolvedValue(false);
        const view = await service.execute('c1', 'a1', { accountType: AccountType.ANALYTIC });
        expect(view.account.accountType).toBe('ANALYTIC');
    });

    it('virar analítica com filhas lança ACCOUNT_HAS_CHILDREN', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(accountFixture({ parentId: 'a0', level: 2 })),
        );
        accounts.hasChildren.mockResolvedValue(true);
        await expect(
            service.execute('c1', 'a1', { accountType: AccountType.ANALYTIC }),
        ).rejects.toMatchObject({ code: 'ACCOUNT_HAS_CHILDREN' });
        expect(accounts.update).not.toHaveBeenCalled();
    });

    it('virar sintética com a conta em uso lança ACCOUNT_IN_USE', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(
                accountFixture({ accountType: AccountType.ANALYTIC, parentId: 'a0', level: 2 }),
            ),
        );
        accounts.isInUse.mockResolvedValue(true);
        await expect(
            service.execute('c1', 'a1', { accountType: AccountType.SYNTHETIC }),
        ).rejects.toMatchObject({ code: 'ACCOUNT_IN_USE' });
        expect(accounts.update).not.toHaveBeenCalled();
    });

    it('virar sintética sem uso é permitido', async () => {
        accounts.findById.mockResolvedValue(
            viewFixture(
                accountFixture({ accountType: AccountType.ANALYTIC, parentId: 'a0', level: 2 }),
            ),
        );
        accounts.isInUse.mockResolvedValue(false);
        const view = await service.execute('c1', 'a1', { accountType: AccountType.SYNTHETIC });
        expect(view.account.accountType).toBe('SYNTHETIC');
    });

    it('alterar só o nome não consulta o uso da conta', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        await service.execute('c1', 'a1', { name: 'Novo' });
        expect(accounts.isInUse).not.toHaveBeenCalled();
    });

    it('conta raiz não vira analítica', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        accounts.hasChildren.mockResolvedValue(false);
        await expect(
            service.execute('c1', 'a1', { accountType: AccountType.ANALYTIC }),
        ).rejects.toMatchObject({ code: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT' });
    });

    it('repetir o tipo atual não revalida', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        accounts.update.mockResolvedValue(undefined);
        await service.execute('c1', 'a1', { accountType: AccountType.SYNTHETIC });
        expect(accounts.hasChildren).not.toHaveBeenCalled();
    });

    it('conta de outra empresa ou inexistente lança BILLING_ACCOUNT_NOT_FOUND', async () => {
        accounts.findById.mockResolvedValue(null);
        await expect(service.execute('c1', 'a9', { name: 'x' })).rejects.toMatchObject({
            code: 'BILLING_ACCOUNT_NOT_FOUND',
        });
        expect(accounts.findById).toHaveBeenCalledWith('c1', 'a9');
    });
});

describe('DeleteBillingAccountService', () => {
    const service = new DeleteBillingAccountService(accounts);

    it('exclui a conta sem filhas', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        accounts.hasChildren.mockResolvedValue(false);
        accounts.delete.mockResolvedValue(undefined);
        await service.execute('c1', 'a1');
        expect(accounts.delete).toHaveBeenCalledWith('c1', 'a1');
    });

    it('conta com filhas lança ACCOUNT_HAS_CHILDREN', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        accounts.hasChildren.mockResolvedValue(true);
        await expect(service.execute('c1', 'a1')).rejects.toMatchObject({
            code: 'ACCOUNT_HAS_CHILDREN',
        });
        expect(accounts.delete).not.toHaveBeenCalled();
    });

    it('conta em uso lança ACCOUNT_IN_USE', async () => {
        accounts.findById.mockResolvedValue(viewFixture());
        accounts.hasChildren.mockResolvedValue(false);
        accounts.isInUse.mockResolvedValue(true);
        await expect(service.execute('c1', 'a1')).rejects.toMatchObject({
            code: 'ACCOUNT_IN_USE',
        });
        expect(accounts.delete).not.toHaveBeenCalled();
    });

    it('conta de outra empresa lança BILLING_ACCOUNT_NOT_FOUND', async () => {
        accounts.findById.mockResolvedValue(null);
        await expect(service.execute('c1', 'a9')).rejects.toMatchObject({
            code: 'BILLING_ACCOUNT_NOT_FOUND',
        });
    });
});

describe('GetBillingAccountService e ListBillingAccountsService', () => {
    it('get devolve a conta com as referências', async () => {
        const view = viewFixture();
        accounts.findById.mockResolvedValue(view);
        await expect(new GetBillingAccountService(accounts).execute('c1', 'a1')).resolves.toBe(
            view,
        );
    });

    it('get de conta de outra empresa lança BILLING_ACCOUNT_NOT_FOUND', async () => {
        accounts.findById.mockResolvedValue(null);
        await expect(
            new GetBillingAccountService(accounts).execute('c1', 'a9'),
        ).rejects.toMatchObject({
            code: 'BILLING_ACCOUNT_NOT_FOUND',
        });
    });

    it('list repassa empresa, filtro e página', async () => {
        const result = { items: [], page: 1, pageSize: 10, total: 0 };
        accounts.list.mockResolvedValue(result);
        await expect(
            new ListBillingAccountsService(accounts).execute(
                'c1',
                { planId: 'p1' },
                { page: 1, pageSize: 10 },
            ),
        ).resolves.toBe(result);
        expect(accounts.list).toHaveBeenCalledWith(
            'c1',
            { planId: 'p1' },
            { page: 1, pageSize: 10 },
        );
    });
});
