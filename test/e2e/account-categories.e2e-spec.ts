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

describe('categorias de DRE e de balanço nas contas', () => {
    it('criação: sem categoria devolve null; a informada é gravada; a filha herda; null limpa', async () => {
        const root = await post({
            name: 'Ativo',
            accountType: 'SYNTHETIC',
            nature: 'ASSET',
            balanceCategory: 'NON_CURRENT_ASSET',
        });
        expect(root.status).toBe(201);
        expect(root.body).toMatchObject({
            balanceCategory: 'NON_CURRENT_ASSET',
            dreCategory: null,
        });
        const inherited = await post({
            parentId: root.body.id,
            name: 'Imobilizado',
            accountType: 'ANALYTIC',
        });
        expect(inherited.body.balanceCategory).toBe('NON_CURRENT_ASSET');
        const cleared = await post({
            parentId: root.body.id,
            name: 'Outro',
            accountType: 'ANALYTIC',
            balanceCategory: null,
        });
        expect(cleared.body.balanceCategory).toBeNull();
        const expense = await post({
            name: 'Despesas',
            accountType: 'SYNTHETIC',
            nature: 'EXPENSE',
            dreCategory: 'COST_OF_SALES',
        });
        expect(expense.body).toMatchObject({ dreCategory: 'COST_OF_SALES', balanceCategory: null });
    });

    it('400 para categoria incompatível com a natureza, na criação e na edição', async () => {
        const onCreate = await post({
            name: 'X',
            accountType: 'SYNTHETIC',
            nature: 'ASSET',
            dreCategory: 'GROSS_REVENUE',
        });
        expect(onCreate.status).toBe(400);
        expect(onCreate.body).toMatchObject({ code: 'DRE_CATEGORY_INVALID' });
        const revenue = (
            await post({ name: 'Receitas', accountType: 'SYNTHETIC', nature: 'REVENUE' })
        ).body;
        const onUpdate = await put(revenue.id, { balanceCategory: 'EQUITY' });
        expect(onUpdate.status).toBe(400);
        expect(onUpdate.body).toMatchObject({ code: 'BALANCE_CATEGORY_INVALID' });
    });

    it('PUT troca e limpa a categoria sem mexer em código, natureza nem nas filhas', async () => {
        const root = (
            await post({
                name: 'Passivo',
                accountType: 'SYNTHETIC',
                nature: 'LIABILITY',
                balanceCategory: 'CURRENT_LIABILITY',
            })
        ).body;
        const child = (
            await post({ parentId: root.id, name: 'Fornecedores', accountType: 'ANALYTIC' })
        ).body;
        const changed = await put(root.id, { balanceCategory: 'NON_CURRENT_LIABILITY' });
        expect(changed.status).toBe(200);
        expect(changed.body).toMatchObject({
            balanceCategory: 'NON_CURRENT_LIABILITY',
            code: root.code,
            nature: 'LIABILITY',
        });
        expect(
            (
                await api()
                    .get(`/api/v1/billing-accounts/${child.id}`)
                    .set(await asAdmin())
            ).body.balanceCategory,
        ).toBe('CURRENT_LIABILITY');
        expect((await put(root.id, { balanceCategory: null })).body.balanceCategory).toBeNull();
    });

    it('INTERNAL_BILLING (SUPPORT) não altera categorias', async () => {
        const root = (await post({ name: 'Despesas', accountType: 'SYNTHETIC', nature: 'EXPENSE' }))
            .body;
        const support = { ...(await bearer('billing')), 'X-Tenant-Id': COMPANY_ID };
        await api()
            .put(`/api/v1/billing-accounts/${root.id}`)
            .set(support)
            .send({ dreCategory: 'INCOME_TAX' })
            .expect(403);
    });
});
