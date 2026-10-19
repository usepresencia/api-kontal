import { bearer, useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';
import { seedLedger, titleBody } from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();
const asAdmin = async (companyId: string) => ({
    ...(await bearer('admin')),
    'X-Tenant-Id': companyId,
});
const asBilling = async (companyId: string) => ({
    ...(await bearer('billing')),
    'X-Tenant-Id': companyId,
});

let seed: Awaited<ReturnType<typeof seedLedger>>;
let companyId: string;

beforeEach(async () => {
    seed = await seedLedger(db());
    companyId = seed.company.id;
});

const body = (overrides: Record<string, unknown> = {}) => ({
    billingPlanId: seed.plan.id,
    name: 'Venda de serviços',
    accounts: {
        receivable: seed.accounts.receivable,
        payable: seed.accounts.payable,
        revenue: seed.accounts.revenue,
        expense: seed.accounts.expense,
    },
    ...overrides,
});

describe('POST /presets', () => {
    it('cria o preset (201) com o nome do plano e das contas', async () => {
        const res = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body())
            .expect(201);
        expect(res.body).toMatchObject({
            name: 'Venda de serviços',
            isActive: true,
            billingPlanName: 'Plano Teste',
            accounts: {
                receivable: { id: seed.accounts.receivable, name: 'Clientes a receber' },
                revenue: { id: seed.accounts.revenue, name: 'Receita de vendas' },
                badDebt: null,
            },
        });
        expect(await db().presetAccount.count({ where: { presetId: res.body.id } })).toBe(4);
    });

    it.each([
        [
            'conta a receber com natureza de receita',
            (a: typeof seed.accounts) => ({ receivable: a.revenue }),
        ],
        ['conta a pagar com natureza de ativo', (a: typeof seed.accounts) => ({ payable: a.bank })],
        ['receita com natureza de despesa', (a: typeof seed.accounts) => ({ revenue: a.expense })],
        [
            'juros recebidos com natureza de despesa',
            (a: typeof seed.accounts) => ({ interestIncome: a.discountGranted }),
        ],
    ])('400 PRESET_ACCOUNT_INVALID para %s', async (_label, patch) => {
        const accounts = { ...body().accounts, ...patch(seed.accounts) };
        const res = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ accounts }))
            .expect(400);
        expect(res.body).toMatchObject({ code: 'PRESET_ACCOUNT_INVALID' });
    });

    it('400 PRESET_ACCOUNT_INVALID para conta sintética e para conta inativa', async () => {
        const root = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: seed.plan.id, code: '3' },
        });
        const synthetic = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ accounts: { ...body().accounts, revenue: root.id } }))
            .expect(400);
        expect(synthetic.body).toMatchObject({ code: 'PRESET_ACCOUNT_INVALID' });
        await db().billingAccount.update({
            where: { id: seed.accounts.revenue },
            data: { isActive: false },
        });
        const inactive = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body())
            .expect(400);
        expect(inactive.body).toMatchObject({ code: 'PRESET_ACCOUNT_INVALID' });
    });

    it('400 PRESET_PLAN_MISMATCH para conta de outro plano da mesma empresa', async () => {
        const otherPlan = await createPlanFixture(db(), companyId, { name: 'Outro' });
        const foreignRoot = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            code: '3',
            level: 1,
            nature: 'REVENUE',
        });
        const foreign = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            parentId: foreignRoot.id,
            code: '3.1',
            level: 2,
            nature: 'REVENUE',
            accountType: 'ANALYTIC',
        });
        const res = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ accounts: { ...body().accounts, revenue: foreign.id } }))
            .expect(400);
        expect(res.body).toMatchObject({ code: 'PRESET_PLAN_MISMATCH' });
    });

    it('400 de validação sem as contas obrigatórias e 404 para plano inexistente', async () => {
        await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ accounts: { revenue: seed.accounts.revenue } }))
            .expect(400);
        const res = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ billingPlanId: '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f' }))
            .expect(404);
        expect(res.body).toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
    });
});

describe('GET, PUT e DELETE /presets', () => {
    it('lista paginada por nome com filtros de plano e status', async () => {
        await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ name: 'Zeta' }))
            .expect(201);
        await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body({ name: 'Alfa', isActive: false }))
            .expect(201);
        const all = await api()
            .get('/api/v1/presets?pageSize=2')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(all.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
        expect(all.body.items.map((p: { name: string }) => p.name)).toEqual([
            'Alfa',
            'Preset completo',
        ]);
        const inactive = await api()
            .get('/api/v1/presets?isActive=false')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(inactive.body.items.map((p: { name: string }) => p.name)).toEqual(['Alfa']);
        const byPlan = await api()
            .get(`/api/v1/presets?billingPlanId=${seed.plan.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(byPlan.body.total).toBe(3);
    });

    it('GET /:id devolve o preset; 404 para desconhecido e 400 para id malformado', async () => {
        await api()
            .get(`/api/v1/presets/${seed.preset.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        const missing = await api()
            .get('/api/v1/presets/3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f')
            .set(await asAdmin(companyId))
            .expect(404);
        expect(missing.body).toMatchObject({ code: 'PRESET_NOT_FOUND' });
        await api()
            .get('/api/v1/presets/abc')
            .set(await asAdmin(companyId))
            .expect(400);
    });

    it('PUT substitui nome, status e contas e não muda o plano', async () => {
        const res = await api()
            .put(`/api/v1/presets/${seed.preset.id}`)
            .set(await asAdmin(companyId))
            .send({
                name: 'Novo nome',
                isActive: false,
                accounts: { receivable: seed.accounts.receivable, payable: seed.accounts.payable },
            })
            .expect(200);
        expect(res.body).toMatchObject({
            name: 'Novo nome',
            isActive: false,
            billingPlanId: seed.plan.id,
        });
        expect(res.body.accounts.revenue).toBeNull();
        expect(await db().presetAccount.count({ where: { presetId: seed.preset.id } })).toBe(2);
    });

    it('DELETE exclui o preset sem títulos (204) e bloqueia o que tem título (409 PRESET_IN_USE)', async () => {
        const free = await api()
            .post('/api/v1/presets')
            .set(await asAdmin(companyId))
            .send(body())
            .expect(201);
        await api()
            .delete(`/api/v1/presets/${free.body.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        expect(await db().preset.count({ where: { id: free.body.id } })).toBe(0);

        await api()
            .post('/api/v1/titles')
            .set(await asAdmin(companyId))
            .send(titleBody(seed))
            .expect(201);
        const blocked = await api()
            .delete(`/api/v1/presets/${seed.preset.id}`)
            .set(await asAdmin(companyId))
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'PRESET_IN_USE' });
    });

    it('INTERNAL_BILLING (SUPPORT) lê, mas não escreve', async () => {
        await api()
            .get('/api/v1/presets')
            .set(await asBilling(companyId))
            .expect(200);
        await api()
            .post('/api/v1/presets')
            .set(await asBilling(companyId))
            .send(body())
            .expect(403);
        await api()
            .put(`/api/v1/presets/${seed.preset.id}`)
            .set(await asBilling(companyId))
            .send(body())
            .expect(403);
        await api()
            .delete(`/api/v1/presets/${seed.preset.id}`)
            .set(await asBilling(companyId))
            .expect(403);
        expect(await db().preset.count()).toBe(1);
    });
});
