import { bearer, useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
let planB: string;
let accountB: string;

beforeEach(async () => {
    await createCompanyFixture(db(), { id: A, name: 'Empresa A' });
    await createCompanyFixture(db(), { id: B, name: 'Empresa B' });
    planB = (await createPlanFixture(db(), B, { name: 'Plano de B' })).id;
    accountB = (await createAccountFixture(db(), { billingPlanId: planB, code: '1', level: 1 })).id;
});

const asA = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': A });

describe('isolamento entre empresas (o usuário opera em A e tenta alcançar B)', () => {
    it('plano de B por id responde 404 em leitura, edição, exclusão e listagem de contas', async () => {
        await api()
            .get(`/api/v1/billing-plans/${planB}`)
            .set(await asA())
            .expect(404);
        await api()
            .put(`/api/v1/billing-plans/${planB}`)
            .set(await asA())
            .send({ name: 'Invadido' })
            .expect(404);
        await api()
            .delete(`/api/v1/billing-plans/${planB}`)
            .set(await asA())
            .expect(404);
        const accounts = await api()
            .get(`/api/v1/billing-plans/${planB}/accounts`)
            .set(await asA())
            .expect(404);
        expect(accounts.body).toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
        expect((await db().billingPlan.findUnique({ where: { id: planB } }))?.name).toBe(
            'Plano de B',
        );
    });

    it('conta de B por id responde 404 em leitura, edição e exclusão', async () => {
        await api()
            .get(`/api/v1/billing-accounts/${accountB}`)
            .set(await asA())
            .expect(404);
        await api()
            .put(`/api/v1/billing-accounts/${accountB}`)
            .set(await asA())
            .send({ name: 'Invadido' })
            .expect(404);
        await api()
            .delete(`/api/v1/billing-accounts/${accountB}`)
            .set(await asA())
            .expect(404);
        const saved = await db().billingAccount.findUnique({ where: { id: accountB } });
        expect(saved?.name).toBe('Conta 1');
    });

    it('criar conta em um plano de B usando o contexto de A responde 404', async () => {
        const res = await api()
            .post('/api/v1/billing-accounts')
            .set(await asA())
            .send({ billingPlanId: planB, name: 'Invasora', accountType: 'SYNTHETIC' })
            .expect(404);
        expect(res.body).toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
        expect(await db().billingAccount.count({ where: { billingPlanId: planB } })).toBe(1);
    });

    it('listagens de A não trazem nada de B, nem filtrando pelo plano de B', async () => {
        const plans = await api()
            .get('/api/v1/billing-plans')
            .set(await asA())
            .expect(200);
        expect(plans.body.total).toBe(0);
        const accounts = await api()
            .get('/api/v1/billing-accounts')
            .set(await asA())
            .expect(200);
        expect(accounts.body.total).toBe(0);
        const filtered = await api()
            .get(`/api/v1/billing-accounts?planId=${planB}`)
            .set(await asA())
            .expect(200);
        expect(filtered.body).toMatchObject({ total: 0, items: [] });
    });

    it('criar conta filha usando como pai uma conta de B responde 400 ACCOUNT_PARENT_INVALID', async () => {
        const planA = (await createPlanFixture(db(), A, { name: 'Plano de A' })).id;
        const res = await api()
            .post('/api/v1/billing-accounts')
            .set(await asA())
            .send({
                billingPlanId: planA,
                parentId: accountB,
                name: 'Filha',
                accountType: 'SYNTHETIC',
            })
            .expect(400);
        expect(res.body).toMatchObject({ code: 'ACCOUNT_PARENT_INVALID' });
    });
});
