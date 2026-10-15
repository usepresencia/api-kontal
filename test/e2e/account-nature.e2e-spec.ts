import { bearer, useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

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

describe('natureza da conta', () => {
    it('conta raiz sem natureza responde 400 ACCOUNT_NATURE_REQUIRED', async () => {
        const res = await post({ name: 'Receitas', accountType: 'SYNTHETIC' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'ACCOUNT_NATURE_REQUIRED' });
    });

    it('raiz grava a natureza e as filhas herdam; natureza diferente do pai responde 400', async () => {
        const root = await post({ name: 'Receitas', accountType: 'SYNTHETIC', nature: 'REVENUE' });
        expect(root.status).toBe(201);
        expect(root.body.nature).toBe('REVENUE');

        const child = await post({
            parentId: root.body.id,
            name: 'Vendas',
            accountType: 'ANALYTIC',
        });
        expect(child.status).toBe(201);
        expect(child.body.nature).toBe('REVENUE');

        const mismatch = await post({
            parentId: root.body.id,
            name: 'Outra',
            accountType: 'ANALYTIC',
            nature: 'EXPENSE',
        });
        expect(mismatch.status).toBe(400);
        expect(mismatch.body).toMatchObject({ code: 'ACCOUNT_NATURE_MISMATCH' });
    });

    it('natureza desconhecida responde 400', async () => {
        const res = await post({ name: 'X', accountType: 'SYNTHETIC', nature: 'OUTRA' });
        expect(res.status).toBe(400);
    });

    it('a natureza não muda no PUT', async () => {
        const root = await post({ name: 'Receitas', accountType: 'SYNTHETIC', nature: 'REVENUE' });
        const res = await api()
            .put(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .send({ name: 'Receitas 2', nature: 'EXPENSE' })
            .expect(200);
        expect(res.body).toMatchObject({ name: 'Receitas 2', nature: 'REVENUE' });
    });
});

describe('conta em uso', () => {
    async function accountInPreset() {
        const root = await createAccountFixture(db(), {
            billingPlanId: planId,
            code: '1',
            level: 1,
        });
        const leaf = await createAccountFixture(db(), {
            billingPlanId: planId,
            parentId: root.id,
            code: '1.1',
            level: 2,
            accountType: 'ANALYTIC',
        });
        const preset = await db().preset.create({
            data: { billingPlanId: planId, name: 'Preset' },
        });
        const link = await db().presetAccount.create({
            data: { presetId: preset.id, role: 'receivable', accountId: leaf.id },
        });
        return { leaf, link };
    }

    it('trocar para sintética responde 409 ACCOUNT_IN_USE e volta a funcionar sem o uso', async () => {
        const { leaf, link } = await accountInPreset();
        const blocked = await api()
            .put(`/api/v1/billing-accounts/${leaf.id}`)
            .set(await asAdmin())
            .send({ accountType: 'SYNTHETIC' })
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'ACCOUNT_IN_USE' });
        expect(
            (await db().billingAccount.findUnique({ where: { id: leaf.id } }))?.accountType,
        ).toBe('ANALYTIC');

        await db().presetAccount.delete({ where: { id: link.id } });
        await api()
            .put(`/api/v1/billing-accounts/${leaf.id}`)
            .set(await asAdmin())
            .send({ accountType: 'SYNTHETIC' })
            .expect(200);
    });

    it('excluir responde 409 ACCOUNT_IN_USE, nunca 500, e funciona sem o uso', async () => {
        const { leaf, link } = await accountInPreset();
        const blocked = await api()
            .delete(`/api/v1/billing-accounts/${leaf.id}`)
            .set(await asAdmin())
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'ACCOUNT_IN_USE' });

        await db().presetAccount.delete({ where: { id: link.id } });
        await api()
            .delete(`/api/v1/billing-accounts/${leaf.id}`)
            .set(await asAdmin())
            .expect(204);
    });
});
