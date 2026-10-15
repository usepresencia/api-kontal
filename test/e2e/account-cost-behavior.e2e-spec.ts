import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
let planId: string;

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
    planId = (await createPlanFixture(db(), COMPANY_ID)).id;
});

const asAdmin = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': COMPANY_ID });
const post = async (body: Record<string, unknown>) =>
    api()
        .post('/api/v1/billing-accounts')
        .set(await asAdmin())
        .send({ billingPlanId: planId, ...body });
const put = async (id: string, body: Record<string, unknown>) =>
    api()
        .put(`/api/v1/billing-accounts/${id}`)
        .set(await asAdmin())
        .send(body);

describe('comportamento de custo nas contas', () => {
    it('despesa: grava, a filha herda, null limpa; PUT troca sem propagar', async () => {
        const root = await post({
            name: 'Despesas',
            accountType: 'SYNTHETIC',
            nature: 'EXPENSE',
            costBehavior: 'FIXED',
        });
        expect(root.status).toBe(201);
        expect(root.body.costBehavior).toBe('FIXED');
        const child = (
            await post({ parentId: root.body.id, name: 'Aluguel', accountType: 'ANALYTIC' })
        ).body;
        expect(child.costBehavior).toBe('FIXED');
        const cleared = await post({
            parentId: root.body.id,
            name: 'Outra',
            accountType: 'ANALYTIC',
            costBehavior: null,
        });
        expect(cleared.body.costBehavior).toBeNull();
        const changed = await put(root.body.id, { costBehavior: 'VARIABLE' });
        expect(changed.body).toMatchObject({ costBehavior: 'VARIABLE', code: root.body.code });
        expect(
            (
                await api()
                    .get(`/api/v1/billing-accounts/${child.id}`)
                    .set(await asAdmin())
            ).body.costBehavior,
        ).toBe('FIXED');
        expect((await put(root.body.id, { costBehavior: null })).body.costBehavior).toBeNull();
    });

    it('400 COST_BEHAVIOR_INVALID para conta que não é de despesa, na criação e na edição', async () => {
        const onCreate = await post({
            name: 'Receitas',
            accountType: 'SYNTHETIC',
            nature: 'REVENUE',
            costBehavior: 'FIXED',
        });
        expect(onCreate.status).toBe(400);
        expect(onCreate.body.code).toBe('COST_BEHAVIOR_INVALID');
        const asset = (await post({ name: 'Ativo', accountType: 'SYNTHETIC', nature: 'ASSET' }))
            .body;
        const onUpdate = await put(asset.id, { costBehavior: 'VARIABLE' });
        expect(onUpdate.status).toBe(400);
        expect(onUpdate.body.code).toBe('COST_BEHAVIOR_INVALID');
    });

    it('INTERNAL_BILLING (SUPPORT) não altera o comportamento de custo', async () => {
        const root = (await post({ name: 'Despesas', accountType: 'SYNTHETIC', nature: 'EXPENSE' }))
            .body;
        const support = { ...(await bearer('billing')), 'X-Tenant-Id': COMPANY_ID };
        await api()
            .put(`/api/v1/billing-accounts/${root.id}`)
            .set(support)
            .send({ costBehavior: 'FIXED' })
            .expect(403);
    });
});
