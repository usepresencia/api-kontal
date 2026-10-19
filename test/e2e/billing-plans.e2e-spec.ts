import { bearer, useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COMPANY_ID = '22222222-2222-4222-8222-222222222222';
const UNKNOWN_ID = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
    await createCompanyFixture(db(), { id: OTHER_COMPANY_ID, name: 'Banca' });
});

const asAdmin = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': COMPANY_ID });
const asBilling = async () => ({ ...(await bearer('billing')), 'X-Tenant-Id': COMPANY_ID });

describe('planos de contas', () => {
    it('POST cria o plano da empresa (201) com descrição vazia por padrão', async () => {
        const res = await api()
            .post('/api/v1/billing-plans')
            .set(await asAdmin())
            .send({ name: ' Plano Padrão ' })
            .expect(201);
        expect(res.body).toMatchObject({ name: 'Plano Padrão', description: '' });
        const saved = await db().billingPlan.findUnique({ where: { id: res.body.id } });
        expect(saved?.companyId).toBe(COMPANY_ID);
    });

    it('POST com nome vazio responde 400', async () => {
        await api()
            .post('/api/v1/billing-plans')
            .set(await asAdmin())
            .send({ name: ' ' })
            .expect(400);
    });

    it('GET lista só os planos da empresa, paginados e ordenados por nome', async () => {
        await createPlanFixture(db(), COMPANY_ID, { name: 'B' });
        await createPlanFixture(db(), COMPANY_ID, { name: 'A' });
        await createPlanFixture(db(), OTHER_COMPANY_ID, { name: 'Z de outra empresa' });
        const res = await api()
            .get('/api/v1/billing-plans?pageSize=1')
            .set(await asAdmin())
            .expect(200);
        expect(res.body).toMatchObject({ page: 1, pageSize: 1, total: 2 });
        expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['A']);
    });

    it('GET /:id devolve o plano; id desconhecido responde 404 e malformado 400', async () => {
        const plan = await createPlanFixture(db(), COMPANY_ID);
        await api()
            .get(`/api/v1/billing-plans/${plan.id}`)
            .set(await asAdmin())
            .expect(200);
        const missing = await api()
            .get(`/api/v1/billing-plans/${UNKNOWN_ID}`)
            .set(await asAdmin())
            .expect(404);
        expect(missing.body).toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
        await api()
            .get('/api/v1/billing-plans/abc')
            .set(await asAdmin())
            .expect(400);
    });

    it('PUT altera nome e descrição', async () => {
        const plan = await createPlanFixture(db(), COMPANY_ID);
        const res = await api()
            .put(`/api/v1/billing-plans/${plan.id}`)
            .set(await asAdmin())
            .send({ name: 'Novo', description: 'desc' })
            .expect(200);
        expect(res.body).toMatchObject({ id: plan.id, name: 'Novo', description: 'desc' });
    });

    it('INTERNAL_BILLING lê, mas não escreve (SUPPORT)', async () => {
        const plan = await createPlanFixture(db(), COMPANY_ID);
        await api()
            .get('/api/v1/billing-plans')
            .set(await asBilling())
            .expect(200);
        await api()
            .post('/api/v1/billing-plans')
            .set(await asBilling())
            .send({ name: 'X' })
            .expect(403);
        await api()
            .put(`/api/v1/billing-plans/${plan.id}`)
            .set(await asBilling())
            .send({ name: 'X' })
            .expect(403);
        await api()
            .delete(`/api/v1/billing-plans/${plan.id}`)
            .set(await asBilling())
            .expect(403);
        expect(await db().billingPlan.count()).toBe(1);
    });

    it('DELETE exclui plano vazio (204) e bloqueia plano com contas (409 PLAN_HAS_ACCOUNTS)', async () => {
        const empty = await createPlanFixture(db(), COMPANY_ID);
        await api()
            .delete(`/api/v1/billing-plans/${empty.id}`)
            .set(await asAdmin())
            .expect(204);
        expect(await db().billingPlan.count()).toBe(0);

        const full = await createPlanFixture(db(), COMPANY_ID);
        await createAccountFixture(db(), { billingPlanId: full.id, code: '1', level: 1 });
        const res = await api()
            .delete(`/api/v1/billing-plans/${full.id}`)
            .set(await asAdmin())
            .expect(409);
        expect(res.body).toMatchObject({ code: 'PLAN_HAS_ACCOUNTS' });
    });

    it('GET /:id/accounts devolve as contas em ordem natural de código (1.9 antes de 1.10)', async () => {
        const plan = await createPlanFixture(db(), COMPANY_ID);
        const root = await api()
            .post('/api/v1/billing-accounts')
            .set(await asAdmin())
            .send({
                billingPlanId: plan.id,
                name: 'Ativo',
                accountType: 'SYNTHETIC',
                nature: 'ASSET',
            })
            .expect(201);
        for (let i = 1; i <= 11; i += 1) {
            await api()
                .post('/api/v1/billing-accounts')
                .set(await asAdmin())
                .send({
                    billingPlanId: plan.id,
                    parentId: root.body.id,
                    name: `Filha ${i}`,
                    accountType: 'ANALYTIC',
                })
                .expect(201);
        }
        const res = await api()
            .get(`/api/v1/billing-plans/${plan.id}/accounts`)
            .set(await asAdmin())
            .expect(200);
        expect(res.body.map((a: { code: string }) => a.code)).toEqual([
            '1',
            '1.1',
            '1.2',
            '1.3',
            '1.4',
            '1.5',
            '1.6',
            '1.7',
            '1.8',
            '1.9',
            '1.10',
            '1.11',
        ]);
    });
});

describe('plano padrão', () => {
    it('o primeiro plano nasce padrão e o segundo não', async () => {
        const first = await api()
            .post('/api/v1/billing-plans')
            .set(await asAdmin())
            .send({ name: 'Primeiro' })
            .expect(201);
        const second = await api()
            .post('/api/v1/billing-plans')
            .set(await asAdmin())
            .send({ name: 'Segundo' })
            .expect(201);
        expect(first.body.isDefault).toBe(true);
        expect(second.body.isDefault).toBe(false);
    });

    it('POST /:id/default troca o padrão e mantém um só por empresa', async () => {
        const first = await createPlanFixture(db(), COMPANY_ID, { name: 'A' });
        const second = await createPlanFixture(db(), COMPANY_ID, { name: 'B' });
        const res = await api()
            .post(`/api/v1/billing-plans/${second.id}/default`)
            .set(await asAdmin())
            .expect(200);
        expect(res.body).toMatchObject({ id: second.id, isDefault: true });
        const defaults = await db().billingPlan.findMany({
            where: { companyId: COMPANY_ID, isDefault: true },
        });
        expect(defaults.map(plan => plan.id)).toEqual([second.id]);
        expect(first.id).not.toBe(second.id);
    });

    it('plano de outra empresa responde 404 e papel sem escrita responde 403', async () => {
        const other = await createPlanFixture(db(), OTHER_COMPANY_ID);
        await api()
            .post(`/api/v1/billing-plans/${other.id}/default`)
            .set(await asAdmin())
            .expect(404);
        const own = await createPlanFixture(db(), COMPANY_ID);
        await api()
            .post(`/api/v1/billing-plans/${own.id}/default`)
            .set(await asBilling())
            .expect(403);
    });

    it('com dois planos o relatório sem billingPlanId usa o padrão', async () => {
        await createPlanFixture(db(), COMPANY_ID, { name: 'A' });
        await createPlanFixture(db(), COMPANY_ID, { name: 'B' });
        await api()
            .get('/api/v1/reports/dre?start=2026-01-01&end=2026-01-31')
            .set(await asAdmin())
            .expect(200);
    });

    it('o plano padrão com outros planos na empresa não pode ser excluído', async () => {
        const first = await createPlanFixture(db(), COMPANY_ID, { name: 'A' });
        const second = await createPlanFixture(db(), COMPANY_ID, { name: 'B' });
        const res = await api()
            .delete(`/api/v1/billing-plans/${first.id}`)
            .set(await asAdmin())
            .expect(409);
        expect(res.body.code ?? res.body.message).toBeDefined();
        await api()
            .delete(`/api/v1/billing-plans/${second.id}`)
            .set(await asAdmin())
            .expect(204);
    });
});
