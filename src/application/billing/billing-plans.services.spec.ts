import { CreateBillingPlanService } from '@/application/billing/create-billing-plan.service.js';
import { DeleteBillingPlanService } from '@/application/billing/delete-billing-plan.service.js';
import { GetBillingPlanService } from '@/application/billing/get-billing-plan.service.js';
import { ListBillingPlansService } from '@/application/billing/list-billing-plans.service.js';
import { ListPlanAccountsService } from '@/application/billing/list-plan-accounts.service.js';
import { UpdateBillingPlanService } from '@/application/billing/update-billing-plan.service.js';
import { fakeAccounts, fakePlans, planFixture, viewFixture } from '@test/support/billing-fakes.js';

const plans = fakePlans();
const accounts = fakeAccounts();

beforeEach(() => {
    for (const fn of Object.values(plans)) fn.mockReset();
    for (const fn of Object.values(accounts)) fn.mockReset();
    plans.findById.mockResolvedValue(planFixture);
});

describe('CreateBillingPlanService', () => {
    it('cria o plano da empresa com id novo e persiste', async () => {
        plans.create.mockResolvedValue(undefined);
        const plan = await new CreateBillingPlanService(plans).execute('c1', {
            name: ' Plano Novo ',
        });
        expect(plan).toMatchObject({ companyId: 'c1', name: 'Plano Novo', description: '' });
        expect(plan.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(plans.create).toHaveBeenCalledWith(plan);
    });

    it('nome inválido não chega ao repositório', async () => {
        await expect(
            new CreateBillingPlanService(plans).execute('c1', { name: ' ' }),
        ).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
        });
        expect(plans.create).not.toHaveBeenCalled();
    });
});

describe('UpdateBillingPlanService', () => {
    it('altera nome e descrição e persiste', async () => {
        plans.update.mockResolvedValue(undefined);
        const plan = await new UpdateBillingPlanService(plans).execute('c1', 'p1', {
            name: 'Outro',
            description: 'nova',
        });
        expect(plan).toMatchObject({ id: 'p1', name: 'Outro', description: 'nova' });
        expect(plans.update).toHaveBeenCalledWith(plan);
    });

    it('plano de outra empresa ou inexistente lança BILLING_PLAN_NOT_FOUND', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(
            new UpdateBillingPlanService(plans).execute('c1', 'p9', { name: 'x' }),
        ).rejects.toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
        expect(plans.findById).toHaveBeenCalledWith('c1', 'p9');
    });
});

describe('DeleteBillingPlanService', () => {
    it('exclui o plano sem contas', async () => {
        plans.hasAccounts.mockResolvedValue(false);
        plans.delete.mockResolvedValue(undefined);
        await new DeleteBillingPlanService(plans).execute('c1', 'p1');
        expect(plans.delete).toHaveBeenCalledWith('c1', 'p1');
    });

    it('plano com contas lança PLAN_HAS_ACCOUNTS', async () => {
        plans.hasAccounts.mockResolvedValue(true);
        await expect(new DeleteBillingPlanService(plans).execute('c1', 'p1')).rejects.toMatchObject(
            {
                code: 'PLAN_HAS_ACCOUNTS',
            },
        );
        expect(plans.delete).not.toHaveBeenCalled();
    });

    it('plano inexistente lança BILLING_PLAN_NOT_FOUND', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(new DeleteBillingPlanService(plans).execute('c1', 'p9')).rejects.toMatchObject(
            {
                code: 'BILLING_PLAN_NOT_FOUND',
            },
        );
    });
});

describe('GetBillingPlanService e ListBillingPlansService', () => {
    it('get devolve o plano da empresa', async () => {
        await expect(new GetBillingPlanService(plans).execute('c1', 'p1')).resolves.toBe(
            planFixture,
        );
    });

    it('get de plano inexistente lança BILLING_PLAN_NOT_FOUND', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(new GetBillingPlanService(plans).execute('c1', 'p9')).rejects.toMatchObject({
            code: 'BILLING_PLAN_NOT_FOUND',
        });
    });

    it('list repassa empresa e página', async () => {
        const result = { items: [], page: 1, pageSize: 10, total: 0 };
        plans.list.mockResolvedValue(result);
        await expect(
            new ListBillingPlansService(plans).execute('c1', { page: 1, pageSize: 10 }),
        ).resolves.toBe(result);
        expect(plans.list).toHaveBeenCalledWith('c1', { page: 1, pageSize: 10 });
    });
});

describe('ListPlanAccountsService', () => {
    it('devolve as contas do plano depois de confirmar que ele é da empresa', async () => {
        const views = [viewFixture()];
        accounts.listByPlan.mockResolvedValue(views);
        await expect(
            new ListPlanAccountsService(plans, accounts).execute('c1', 'p1'),
        ).resolves.toBe(views);
        expect(accounts.listByPlan).toHaveBeenCalledWith('c1', 'p1');
    });

    it('plano de outra empresa lança BILLING_PLAN_NOT_FOUND sem listar contas', async () => {
        plans.findById.mockResolvedValue(null);
        await expect(
            new ListPlanAccountsService(plans, accounts).execute('c1', 'p9'),
        ).rejects.toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
        expect(accounts.listByPlan).not.toHaveBeenCalled();
    });
});
