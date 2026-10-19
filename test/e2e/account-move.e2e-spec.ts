import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
let planId: string;

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
    await createCompanyFixture(db(), { id: OTHER_ID, name: 'Outra' });
    planId = (await createPlanFixture(db(), COMPANY_ID)).id;
});

const asAdmin = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': COMPANY_ID });
const asOther = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': OTHER_ID });
const asBilling = async () => ({ ...(await bearer('billing')), 'X-Tenant-Id': COMPANY_ID });

const create = async (body: Record<string, unknown>) => {
    const res = await api()
        .post('/api/v1/billing-accounts')
        .set(await asAdmin())
        .send({ billingPlanId: planId, ...(body.parentId ? {} : { nature: 'ASSET' }), ...body });
    expect(res.status).toBe(201);
    return res.body as { id: string; code: string; level: number };
};

const move = async (id: string, parentId: string | null, headers?: Record<string, string>) =>
    api()
        .put(`/api/v1/billing-accounts/${id}`)
        .set(headers ?? (await asAdmin()))
        .send({ parentId });

const codes = async () => {
    const res = await api()
        .get(`/api/v1/billing-plans/${planId}/accounts`)
        .set(await asAdmin());
    return Object.fromEntries(
        (res.body as { id: string; code: string; level: number; parentId: string | null }[]).map(
            a => [a.id, `${a.code}@${a.level}`],
        ),
    );
};

describe('PUT /billing-accounts/:id com parentId (mover conta)', () => {
    it('move a sintética com as filhas e recodifica a subárvore sob o novo pai', async () => {
        const ativo = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const outro = await create({ name: 'Outro ativo', accountType: 'SYNTHETIC' });
        const grupo = await create({ name: 'Grupo', accountType: 'SYNTHETIC', parentId: ativo.id });
        const caixa = await create({ name: 'Caixa', accountType: 'ANALYTIC', parentId: grupo.id });
        await create({ name: 'Já existia', accountType: 'SYNTHETIC', parentId: outro.id });

        const res = await move(grupo.id, outro.id);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ parentId: outro.id, code: '2.2', level: 2 });
        const after = await codes();
        expect(after[caixa.id]).toBe('2.2.1@3');
        expect(after[ativo.id]).toBe('1@1');
    });

    it('mover para a raiz só vale para sintética; a analítica exige um pai', async () => {
        const ativo = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const grupo = await create({ name: 'Grupo', accountType: 'SYNTHETIC', parentId: ativo.id });
        const caixa = await create({ name: 'Caixa', accountType: 'ANALYTIC', parentId: grupo.id });

        const analytic = await move(caixa.id, null);
        expect(analytic.status).toBe(400);
        expect(analytic.body).toMatchObject({ code: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT' });

        const synthetic = await move(grupo.id, null);
        expect(synthetic.status).toBe(200);
        expect(synthetic.body).toMatchObject({ code: '2', level: 1, parentId: null });
        expect((await codes())[caixa.id]).toBe('2.1@2');
    });

    it('recusa mover para dentro de si mesma ou de uma filha, sob analítica e com natureza diferente', async () => {
        const ativo = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const grupo = await create({ name: 'Grupo', accountType: 'SYNTHETIC', parentId: ativo.id });
        const sub = await create({ name: 'Sub', accountType: 'SYNTHETIC', parentId: grupo.id });
        const caixa = await create({ name: 'Caixa', accountType: 'ANALYTIC', parentId: sub.id });
        const passivo = await create({
            name: 'Passivo',
            accountType: 'SYNTHETIC',
            nature: 'LIABILITY',
        });

        const intoSelf = await move(grupo.id, sub.id);
        expect(intoSelf.status).toBe(400);
        expect(intoSelf.body).toMatchObject({ code: 'ACCOUNT_MOVE_INVALID' });

        const intoAnalytic = await move(sub.id, caixa.id);
        expect(intoAnalytic.body).toMatchObject({ code: 'ACCOUNT_MOVE_INVALID' });

        const otherNature = await move(grupo.id, passivo.id);
        expect(otherNature.status).toBe(400);
        expect(otherNature.body).toMatchObject({ code: 'ACCOUNT_NATURE_MISMATCH' });

        const underAnalytic = await move(passivo.id, caixa.id);
        expect(underAnalytic.status).toBe(400);
        expect(underAnalytic.body.code).toBeDefined();
        expect(Object.values(await codes()).sort()).toContain('1.1@2');
    });

    it('recusa quando a subárvore passaria de 5 níveis', async () => {
        const n1 = await create({ name: 'N1', accountType: 'SYNTHETIC' });
        const n2 = await create({ name: 'N2', accountType: 'SYNTHETIC', parentId: n1.id });
        const n3 = await create({ name: 'N3', accountType: 'SYNTHETIC', parentId: n2.id });
        const n4 = await create({ name: 'N4', accountType: 'SYNTHETIC', parentId: n3.id });
        const raiz = await create({ name: 'Raiz', accountType: 'SYNTHETIC' });
        await create({ name: 'F1', accountType: 'SYNTHETIC', parentId: raiz.id });
        const deep = await create({ name: 'Folha', accountType: 'ANALYTIC', parentId: n4.id });
        expect(deep.level).toBe(5);

        const res = await move(raiz.id, n4.id);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'ACCOUNT_MAX_DEPTH_EXCEEDED' });
    });

    it('preserva os lançamentos e os presets: eles apontam para o id da conta, não para o código', async () => {
        const ativo = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const outro = await create({ name: 'Outro', accountType: 'SYNTHETIC' });
        const caixa = await create({ name: 'Caixa', accountType: 'ANALYTIC', parentId: ativo.id });
        const before = await api()
            .get(`/api/v1/billing-accounts/${caixa.id}`)
            .set(await asAdmin());
        const res = await move(caixa.id, outro.id);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(before.body.id);
        expect(res.body.code).toBe('2.1');
    });

    it('conta de outro tenant responde 404 e INTERNAL_BILLING recebe 403', async () => {
        const ativo = await create({ name: 'Ativo', accountType: 'SYNTHETIC' });
        const outro = await create({ name: 'Outro', accountType: 'SYNTHETIC' });
        const grupo = await create({ name: 'Grupo', accountType: 'SYNTHETIC', parentId: ativo.id });
        expect((await move(grupo.id, outro.id, await asOther())).status).toBe(404);
        expect((await move(grupo.id, outro.id, await asBilling())).status).toBe(403);
        expect((await codes())[grupo.id]).toBe('1.1@2');
    });
});
