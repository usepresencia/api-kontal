import { CreateBillingAccountService } from '@/application/billing/create-billing-account.service.js';
import { AccountType } from '@/domain/billing/account-type.js';
import {
    accountFixture,
    fakeAccounts,
    fakePlans,
    planFixture,
    viewFixture,
} from '@test/support/billing-fakes.js';

const plans = fakePlans();
const accounts = fakeAccounts();
const service = new CreateBillingAccountService(plans, accounts);
const input = { billingPlanId: 'p1', name: 'Passivo', accountType: AccountType.SYNTHETIC };
const created = viewFixture();

beforeEach(() => {
    for (const fn of Object.values(plans)) fn.mockReset();
    for (const fn of Object.values(accounts)) fn.mockReset();
    plans.findById.mockResolvedValue(planFixture);
    accounts.insertWithNextCode.mockResolvedValue(created);
});

describe('CreateBillingAccountService', () => {
    it('conta raiz sintética: nível 1, sem pai, código gerado pela função de domínio', async () => {
        const view = await service.execute('c1', input);
        const [draft, nextCode] = accounts.insertWithNextCode.mock.calls[0];
        expect(draft).toMatchObject({
            billingPlanId: 'p1',
            parentId: null,
            name: 'Passivo',
            accountType: 'SYNTHETIC',
            isActive: true,
            level: 1,
        });
        expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(nextCode(null, ['1', '2'])).toBe('3');
        expect(view).toBe(created);
    });

    it('conta filha: busca o pai escopado, soma o nível e gera o código a partir dele', async () => {
        accounts.findParent.mockResolvedValue(accountFixture({ id: 'a0', code: '1', level: 1 }));
        await service.execute('c1', { ...input, parentId: 'a0' });
        const [draft, nextCode] = accounts.insertWithNextCode.mock.calls[0];
        expect(accounts.findParent).toHaveBeenCalledWith('c1', 'p1', 'a0');
        expect(draft).toMatchObject({ parentId: 'a0', level: 2 });
        expect(nextCode('1', ['1.1'])).toBe('1.2');
    });

    it('respeita isActive informado', async () => {
        await service.execute('c1', { ...input, isActive: false });
        expect(accounts.insertWithNextCode.mock.calls[0][0].isActive).toBe(false);
    });

    it('plano de outra empresa ou inexistente lança BILLING_PLAN_NOT_FOUND', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(service.execute('c1', input)).rejects.toMatchObject({
            code: 'BILLING_PLAN_NOT_FOUND',
        });
        expect(accounts.insertWithNextCode).not.toHaveBeenCalled();
    });

    it('pai que não existe no plano da empresa lança ACCOUNT_PARENT_INVALID', async () => {
        accounts.findParent.mockResolvedValue(null);
        await expect(service.execute('c1', { ...input, parentId: 'a0' })).rejects.toMatchObject({
            code: 'ACCOUNT_PARENT_INVALID',
        });
    });

    it('conta analítica raiz lança ACCOUNT_ANALYTIC_REQUIRES_PARENT', async () => {
        await expect(
            service.execute('c1', { ...input, accountType: AccountType.ANALYTIC }),
        ).rejects.toMatchObject({ code: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT' });
    });

    it('pai analítico lança ACCOUNT_PARENT_NOT_SYNTHETIC', async () => {
        accounts.findParent.mockResolvedValue(
            accountFixture({ id: 'a0', accountType: AccountType.ANALYTIC, level: 2 }),
        );
        await expect(service.execute('c1', { ...input, parentId: 'a0' })).rejects.toMatchObject({
            code: 'ACCOUNT_PARENT_NOT_SYNTHETIC',
        });
    });

    it('sexto nível lança ACCOUNT_MAX_DEPTH_EXCEEDED', async () => {
        accounts.findParent.mockResolvedValue(accountFixture({ id: 'a0', level: 5 }));
        await expect(service.execute('c1', { ...input, parentId: 'a0' })).rejects.toMatchObject({
            code: 'ACCOUNT_MAX_DEPTH_EXCEEDED',
        });
    });

    it('nome inválido não chega ao repositório', async () => {
        await expect(service.execute('c1', { ...input, name: ' ' })).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
        });
        expect(accounts.insertWithNextCode).not.toHaveBeenCalled();
    });
});
