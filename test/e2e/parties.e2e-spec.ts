import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { seedLedger, titleBody } from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const asA = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': A });
const asB = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': B });
const asSupportA = async () => ({ ...(await bearer('billing')), 'X-Tenant-Id': A });

let a: Awaited<ReturnType<typeof seedLedger>>;
let b: Awaited<ReturnType<typeof seedLedger>>;

beforeEach(async () => {
    a = await seedLedger(db(), { companyId: A, name: 'Empresa A' });
    b = await seedLedger(db(), { companyId: B, name: 'Empresa B' });
});

const DOC_A = '11.222.333/0001-81';
const DOC_B = '529.982.247-25';

const partyBody = (overrides: Record<string, unknown> = {}) => ({
    kind: 'SUPPLIER',
    name: 'Copel',
    socialReason: 'Companhia Paranaense de Energia',
    document: DOC_A,
    email: 'financeiro@copel.com',
    phone: '4133333333',
    defaultPresetId: a.preset.id,
    ...overrides,
});

const createParty = async (headers: Record<string, string>, overrides = {}) =>
    api().post('/api/v1/parties').set(headers).send(partyBody(overrides));

describe('POST /parties', () => {
    it('cria a contraparte com o documento só em dígitos e o nome do preset padrão', async () => {
        const res = await createParty(await asA(), { document: DOC_A });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            kind: 'SUPPLIER',
            name: 'Copel',
            document: '11222333000181',
            defaultPresetId: a.preset.id,
            defaultPresetName: 'Preset completo',
            isActive: true,
        });
    });

    it('recusa documento repetido no tenant (409) e aceita o mesmo em outro tenant', async () => {
        const body = { document: DOC_A, defaultPresetId: null };
        expect((await createParty(await asA(), body)).status).toBe(201);
        const repeated = await createParty(await asA(), { ...body, name: 'Outra' });
        expect(repeated.status).toBe(409);
        expect(repeated.body).toMatchObject({ code: 'PARTY_DOCUMENT_TAKEN' });
        expect((await createParty(await asB(), body)).status).toBe(201);
    });

    it('recusa documento com dígito verificador errado e preset de outro tenant', async () => {
        const invalid = await createParty(await asA(), { document: '11.222.333/0001-80' });
        expect(invalid.status).toBe(400);
        const foreignPreset = await createParty(await asA(), {
            document: DOC_A,
            defaultPresetId: b.preset.id,
        });
        expect(foreignPreset.status).toBe(404);
        expect(foreignPreset.body).toMatchObject({ code: 'PRESET_NOT_FOUND' });
    });
});

describe('GET, PUT e DELETE /parties', () => {
    it('lista com filtros e não mostra contrapartes de outro tenant', async () => {
        await createParty(await asA());
        await createParty(await asA(), {
            document: DOC_B,
            kind: 'CLIENT',
            name: 'Maria',
            socialReason: 'Maria Silva',
            defaultPresetId: null,
        });
        const all = await api()
            .get('/api/v1/parties')
            .set(await asA());
        expect(all.body.total).toBe(3); // a do seed + as 2 criadas
        const clients = await api()
            .get('/api/v1/parties?kind=CLIENT')
            .set(await asA());
        expect(clients.body.items.map((item: { name: string }) => item.name)).toEqual(['Maria']);
        const search = await api()
            .get('/api/v1/parties?search=copel')
            .set(await asA());
        expect(search.body.items).toHaveLength(1);
        const other = await api()
            .get('/api/v1/parties')
            .set(await asB());
        expect(other.body.items.every((item: { id: string }) => item.id !== undefined)).toBe(true);
        expect(other.body.items.some((item: { name: string }) => item.name === 'Copel')).toBe(
            false,
        );
    });

    it('contraparte de outro tenant responde 404 em leitura, edição e exclusão', async () => {
        const created = (await createParty(await asB(), { defaultPresetId: null })).body;
        expect(
            (
                await api()
                    .get(`/api/v1/parties/${created.id}`)
                    .set(await asA())
            ).status,
        ).toBe(404);
        const put = await api()
            .put(`/api/v1/parties/${created.id}`)
            .set(await asA())
            .send(partyBody({ defaultPresetId: null }));
        expect(put.status).toBe(404);
        expect(
            (
                await api()
                    .delete(`/api/v1/parties/${created.id}`)
                    .set(await asA())
            ).status,
        ).toBe(404);
    });

    it('edita mantendo o próprio documento e desativa', async () => {
        const created = (await createParty(await asA())).body;
        const res = await api()
            .put(`/api/v1/parties/${created.id}`)
            .set(await asA())
            .send(partyBody({ name: 'Copel Distribuição', isActive: false }));
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ name: 'Copel Distribuição', isActive: false });
    });

    it('recusa excluir contraparte com título (409) e exclui a sem títulos', async () => {
        const withTitle = (await createParty(await asA())).body;
        await api()
            .post('/api/v1/titles')
            .set(await asA())
            .send(titleBody(a, { type: 'EXPENSE', partyId: withTitle.id }))
            .expect(201);
        const blocked = await api()
            .delete(`/api/v1/parties/${withTitle.id}`)
            .set(await asA());
        expect(blocked.status).toBe(409);
        expect(blocked.body).toMatchObject({ code: 'PARTY_IN_USE' });
        const free = (await createParty(await asA(), { document: DOC_B })).body;
        expect(
            (
                await api()
                    .delete(`/api/v1/parties/${free.id}`)
                    .set(await asA())
            ).status,
        ).toBe(204);
    });

    it('recusa excluir preset que é padrão de uma contraparte (409)', async () => {
        await createParty(await asA());
        const res = await api()
            .delete(`/api/v1/presets/${a.preset.id}`)
            .set(await asA());
        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ code: 'PRESET_IN_USE' });
    });
});

describe('papéis', () => {
    it('INTERNAL_BILLING lê, mas não escreve', async () => {
        const created = (await createParty(await asA())).body;
        const support = await asSupportA();
        expect((await api().get('/api/v1/parties').set(support)).status).toBe(200);
        expect((await api().get(`/api/v1/parties/${created.id}`).set(support)).status).toBe(200);
        expect(
            (
                await api()
                    .post('/api/v1/parties')
                    .set(support)
                    .send(partyBody({ document: DOC_B }))
            ).status,
        ).toBe(403);
        expect((await api().delete(`/api/v1/parties/${created.id}`).set(support)).status).toBe(403);
    });
});

describe('contraparte nos títulos', () => {
    const create = async (headers: Record<string, string>, overrides: Record<string, unknown>) =>
        api()
            .post('/api/v1/titles')
            .set(headers)
            .send({ ...titleBody(a), ...overrides });

    it('sem preset no corpo usa o preset padrão e devolve a contraparte no título', async () => {
        const supplier = (await createParty(await asA())).body;
        const res = await create(await asA(), {
            type: 'EXPENSE',
            partyId: supplier.id,
            presetId: undefined,
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            partyId: supplier.id,
            partyName: 'Copel',
            presetId: a.preset.id,
        });
    });

    it('contraparte de outro tenant responde 404', async () => {
        const foreign = (await createParty(await asB(), { defaultPresetId: null })).body;
        const res = await create(await asA(), { partyId: foreign.id });
        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ code: 'PARTY_NOT_FOUND' });
    });

    it('contraparte inativa responde 409 e tipo incompatível responde 422', async () => {
        const inactive = (await createParty(await asA(), { isActive: false })).body;
        const blocked = await create(await asA(), { type: 'EXPENSE', partyId: inactive.id });
        expect(blocked.status).toBe(409);
        expect(blocked.body).toMatchObject({ code: 'PARTY_INACTIVE' });
        const supplier = (await createParty(await asA(), { document: DOC_B })).body;
        const mismatch = await create(await asA(), { type: 'INCOME', partyId: supplier.id });
        expect(mismatch.status).toBe(422);
        expect(mismatch.body).toMatchObject({ code: 'PARTY_KIND_MISMATCH' });
    });

    it('sem preset no corpo e sem padrão na contraparte responde 422', async () => {
        const noDefault = (await createParty(await asA(), { defaultPresetId: null })).body;
        const res = await create(await asA(), {
            type: 'EXPENSE',
            partyId: noDefault.id,
            presetId: undefined,
        });
        expect(res.status).toBe(422);
        expect(res.body).toMatchObject({ code: 'PARTY_PRESET_REQUIRED' });
    });

    it('filtra a lista de títulos por contraparte', async () => {
        const supplier = (await createParty(await asA())).body;
        expect((await create(await asA(), { type: 'EXPENSE', partyId: supplier.id })).status).toBe(
            201,
        );
        expect((await create(await asA(), {})).status).toBe(201);
        const res = await api()
            .get(`/api/v1/titles?partyId=${supplier.id}`)
            .set(await asA());
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].partyName).toBe('Copel');
    });
});
