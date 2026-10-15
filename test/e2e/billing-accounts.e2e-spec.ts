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
const asBilling = async () => ({ ...(await bearer('billing')), 'X-Tenant-Id': COMPANY_ID });
const create = async (body: Record<string, unknown>, auth?: Record<string, string>) =>
    api()
        .post('/api/v1/billing-accounts')
        .set(auth ?? (await asAdmin()))
        .send({ billingPlanId: planId, ...body });

/** Cabeçalhos já autenticados (usuário provisionado), para disparar requisições em paralelo. */
const warmAuth = async () => {
    const auth = await asAdmin();
    await api().get('/api/v1/auth/me').set(auth).expect(200);
    return auth;
};

describe('geração de código e níveis', () => {
    it('contas raiz recebem 1, 2, 3 e suas filhas herdam o código do pai', async () => {
        const codes: string[] = [];
        for (const name of ['Ativo', 'Passivo', 'Patrimônio']) {
            const res = await create({ name, accountType: 'SYNTHETIC' }).then(r => r);
            expect(res.status).toBe(201);
            codes.push(res.body.code);
        }
        expect(codes).toEqual(['1', '2', '3']);

        const root1 = (await db().billingAccount.findFirstOrThrow({ where: { code: '1' } })).id;
        const first = await create({
            parentId: root1,
            name: 'Circulante',
            accountType: 'SYNTHETIC',
        });
        const second = await create({
            parentId: root1,
            name: 'Não circulante',
            accountType: 'SYNTHETIC',
        });
        expect([first.body.code, second.body.code]).toEqual(['1.1', '1.2']);
        expect(first.body).toMatchObject({
            level: 2,
            parentId: root1,
            parentName: 'Ativo',
            billingPlanName: 'Plano Teste',
        });
    });

    it('níveis 4 e 5 usam 3 dígitos e o sexto nível é recusado', async () => {
        const l1 = await create({ name: 'N1', accountType: 'SYNTHETIC' });
        const l2 = await create({ parentId: l1.body.id, name: 'N2', accountType: 'SYNTHETIC' });
        const l3 = await create({ parentId: l2.body.id, name: 'N3', accountType: 'SYNTHETIC' });
        const l4 = await create({ parentId: l3.body.id, name: 'N4', accountType: 'SYNTHETIC' });
        const l5 = await create({ parentId: l4.body.id, name: 'N5', accountType: 'SYNTHETIC' });
        expect([l3.body.code, l4.body.code, l5.body.code]).toEqual([
            '1.1.1',
            '1.1.1.001',
            '1.1.1.001.001',
        ]);
        const l6 = await create({ parentId: l5.body.id, name: 'N6', accountType: 'ANALYTIC' });
        expect(l6.status).toBe(400);
        expect(l6.body).toMatchObject({ code: 'ACCOUNT_MAX_DEPTH_EXCEEDED' });
    });

    it('depois de excluir uma conta o próximo código usa o maior sufixo, sem repetir', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const ids: string[] = [];
        for (let i = 1; i <= 3; i += 1) {
            ids.push(
                (await create({ parentId: root.body.id, name: `F${i}`, accountType: 'ANALYTIC' }))
                    .body.id,
            );
        }
        await api()
            .delete(`/api/v1/billing-accounts/${ids[1]}`)
            .set(await asAdmin())
            .expect(204);
        const next = await create({ parentId: root.body.id, name: 'F4', accountType: 'ANALYTIC' });
        expect(next.body.code).toBe('1.4');
    });

    it('10 criações simultâneas sob o mesmo pai geram códigos distintos e sequenciais', async () => {
        const auth = await warmAuth();
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' }, auth);
        const results = await Promise.all(
            Array.from({ length: 10 }, async (_, i) =>
                create({ parentId: root.body.id, name: `F${i}`, accountType: 'ANALYTIC' }, auth),
            ),
        );
        expect(results.map(r => r.status)).toEqual(Array(10).fill(201));
        const codes = results
            .map(r => r.body.code)
            .sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
        expect(codes).toEqual(Array.from({ length: 10 }, (_, i) => `1.${i + 1}`));
    });

    it('10 criações simultâneas de contas raiz também geram códigos distintos', async () => {
        const auth = await warmAuth();
        const results = await Promise.all(
            Array.from({ length: 10 }, async (_, i) =>
                create({ name: `R${i}`, accountType: 'SYNTHETIC' }, auth),
            ),
        );
        expect(results.map(r => r.status)).toEqual(Array(10).fill(201));
        expect(new Set(results.map(r => r.body.code)).size).toBe(10);
    });
});

describe('regras de hierarquia', () => {
    it('conta analítica sem pai responde 400 ACCOUNT_ANALYTIC_REQUIRES_PARENT', async () => {
        const res = await create({ name: 'Caixa', accountType: 'ANALYTIC' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT' });
    });

    it('pai analítico responde 400 ACCOUNT_PARENT_NOT_SYNTHETIC', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const analytic = await create({
            parentId: root.body.id,
            name: 'Caixa',
            accountType: 'ANALYTIC',
        });
        const res = await create({
            parentId: analytic.body.id,
            name: 'Filha',
            accountType: 'ANALYTIC',
        });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'ACCOUNT_PARENT_NOT_SYNTHETIC' });
    });

    it('pai de outro plano da mesma empresa responde 400 ACCOUNT_PARENT_INVALID', async () => {
        const otherPlan = await createPlanFixture(db(), COMPANY_ID, { name: 'Outro plano' });
        const foreign = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            code: '1',
            level: 1,
        });
        const res = await create({ parentId: foreign.id, name: 'Filha', accountType: 'SYNTHETIC' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'ACCOUNT_PARENT_INVALID' });
    });

    it('plano inexistente responde 404 e dados inválidos respondem 400', async () => {
        const res = await create({
            billingPlanId: '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f',
            name: 'X',
            accountType: 'SYNTHETIC',
        });
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
        expect((await create({ name: '', accountType: 'SYNTHETIC' })).status).toBe(400);
        expect((await create({ name: 'X', accountType: 'outro' })).status).toBe(400);
    });
});

describe('alteração e exclusão', () => {
    it('PUT altera nome e status e preserva código, nível e vínculos', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const res = await api()
            .put(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .send({ name: 'Ativo Total', isActive: false })
            .expect(200);
        expect(res.body).toMatchObject({
            name: 'Ativo Total',
            isActive: false,
            code: '1',
            level: 1,
            billingPlanId: planId,
        });
    });

    it('PUT com corpo vazio responde 400', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        await api()
            .put(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .send({})
            .expect(400);
    });

    it('virar analítica com filhas responde 409 e conta raiz não vira analítica', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const child = await create({
            parentId: root.body.id,
            name: 'Circulante',
            accountType: 'SYNTHETIC',
        });
        await create({ parentId: child.body.id, name: 'Caixa', accountType: 'ANALYTIC' });

        const withChildren = await api()
            .put(`/api/v1/billing-accounts/${child.body.id}`)
            .set(await asAdmin())
            .send({ accountType: 'ANALYTIC' })
            .expect(409);
        expect(withChildren.body).toMatchObject({ code: 'ACCOUNT_HAS_CHILDREN' });

        const asRoot = await api()
            .put(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .send({ accountType: 'ANALYTIC' })
            .expect(400);
        expect(asRoot.body).toMatchObject({ code: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT' });
    });

    it('DELETE bloqueia conta com filhas (409) e exclui folha (204)', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const leaf = await create({
            parentId: root.body.id,
            name: 'Caixa',
            accountType: 'ANALYTIC',
        });
        const blocked = await api()
            .delete(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'ACCOUNT_HAS_CHILDREN' });
        await api()
            .delete(`/api/v1/billing-accounts/${leaf.body.id}`)
            .set(await asAdmin())
            .expect(204);
        await api()
            .delete(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .expect(204);
        expect(await db().billingAccount.count()).toBe(0);
    });
});

describe('leitura e papéis', () => {
    it('GET /:id devolve a conta com nomes do pai e do plano; filtro por plano na listagem', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const otherPlan = await createPlanFixture(db(), COMPANY_ID, { name: 'Outro' });
        await createAccountFixture(db(), { billingPlanId: otherPlan.id, code: '1', level: 1 });

        const one = await api()
            .get(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asAdmin())
            .expect(200);
        expect(one.body).toMatchObject({
            code: '1',
            parentName: null,
            billingPlanName: 'Plano Teste',
        });

        const filtered = await api()
            .get(`/api/v1/billing-accounts?planId=${planId}`)
            .set(await asAdmin())
            .expect(200);
        expect(filtered.body).toMatchObject({ total: 1 });
        const all = await api()
            .get('/api/v1/billing-accounts')
            .set(await asAdmin())
            .expect(200);
        expect(all.body.total).toBe(2);
    });

    it('INTERNAL_BILLING lê, mas não cria, altera nem exclui', async () => {
        const root = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        await api()
            .get('/api/v1/billing-accounts')
            .set(await asBilling())
            .expect(200);
        await api()
            .post('/api/v1/billing-accounts')
            .set(await asBilling())
            .send({ billingPlanId: planId, name: 'X', accountType: 'SYNTHETIC' })
            .expect(403);
        await api()
            .put(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asBilling())
            .send({ name: 'X' })
            .expect(403);
        await api()
            .delete(`/api/v1/billing-accounts/${root.body.id}`)
            .set(await asBilling())
            .expect(403);
        expect(await db().billingAccount.count()).toBe(1);
    });

    it('400 para id e parâmetros malformados', async () => {
        await api()
            .get('/api/v1/billing-accounts/abc')
            .set(await asAdmin())
            .expect(400);
        await api()
            .get('/api/v1/billing-accounts?planId=abc')
            .set(await asAdmin())
            .expect(400);
        await api()
            .get('/api/v1/billing-accounts?pageSize=101')
            .set(await asAdmin())
            .expect(400);
    });
});
