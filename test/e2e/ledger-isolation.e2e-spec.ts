import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { seedLedger, titleBody } from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const asA = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': A });
const asB = async () => ({ ...(await bearer('admin')), 'X-Tenant-Id': B });

let a: Awaited<ReturnType<typeof seedLedger>>;
let b: Awaited<ReturnType<typeof seedLedger>>;
let titleB: { id: string };
let entryB: { id: string };
let seriesB: { id: string };

beforeEach(async () => {
    a = await seedLedger(db(), { companyId: A, name: 'Empresa A' });
    b = await seedLedger(db(), { companyId: B, name: 'Empresa B' });
    titleB = (
        await api()
            .post('/api/v1/titles')
            .set(await asB())
            .send(titleBody(b))
            .expect(201)
    ).body;
    entryB = (
        await api()
            .post(`/api/v1/titles/${titleB.id}/entries`)
            .set(await asB())
            .send({
                billingAccountId: b.accounts.bank,
                principalAmount: '100.00',
                paidAt: isoDay(-5),
                paymentMethod: 'PIX',
            })
            .expect(201)
    ).body;
    seriesB = (
        await api()
            .post('/api/v1/title-series')
            .set(await asB())
            .send({
                kind: 'RECURRING',
                presetId: b.preset.id,
                partyId: b.party.id,
                type: 'EXPENSE',
                description: 'Aluguel',
                amount: '10.00',
                expirationDate: isoDay(30),
                count: 2,
            })
            .expect(201)
    ).body;
});

describe('empresa A não alcança recursos da empresa B (404 do próprio recurso)', () => {
    it('preset de B', async () => {
        await api()
            .get(`/api/v1/presets/${b.preset.id}`)
            .set(await asA())
            .expect(404);
        await api()
            .put(`/api/v1/presets/${b.preset.id}`)
            .set(await asA())
            .send({
                name: 'x',
                accounts: { receivable: a.accounts.receivable, payable: a.accounts.payable },
            })
            .expect(404);
        await api()
            .delete(`/api/v1/presets/${b.preset.id}`)
            .set(await asA())
            .expect(404);
        expect((await db().preset.findUniqueOrThrow({ where: { id: b.preset.id } })).name).toBe(
            'Preset completo',
        );
    });

    it('título de B', async () => {
        await api()
            .get(`/api/v1/titles/${titleB.id}`)
            .set(await asA())
            .expect(404);
        await api()
            .put(`/api/v1/titles/${titleB.id}`)
            .set(await asA())
            .send({ description: 'invadido' })
            .expect(404);
        await api()
            .delete(`/api/v1/titles/${titleB.id}`)
            .set(await asA())
            .expect(404);
        await api()
            .post(`/api/v1/titles/${titleB.id}/write-off`)
            .set(await asA())
            .send({})
            .expect(404);
        expect((await db().title.findUniqueOrThrow({ where: { id: titleB.id } })).description).toBe(
            'Venda',
        );
    });

    it('baixa de B, inclusive pela rota do título', async () => {
        await api()
            .get(`/api/v1/entries/${entryB.id}`)
            .set(await asA())
            .expect(404);
        await api()
            .put(`/api/v1/entries/${entryB.id}`)
            .set(await asA())
            .send({ description: 'invadido' })
            .expect(404);
        await api()
            .delete(`/api/v1/entries/${entryB.id}`)
            .set(await asA())
            .expect(404);
        const create = await api()
            .post(`/api/v1/titles/${titleB.id}/entries`)
            .set(await asA())
            .send({
                billingAccountId: a.accounts.bank,
                principalAmount: '10.00',
                paidAt: isoDay(-5),
                paymentMethod: 'PIX',
            })
            .expect(404);
        expect(create.body).toMatchObject({ code: 'TITLE_NOT_FOUND' });
        const list = await api()
            .get(`/api/v1/titles/${titleB.id}/entries`)
            .set(await asA())
            .expect(404);
        expect(list.body).toMatchObject({ code: 'TITLE_NOT_FOUND' });
        await api()
            .get(`/api/v1/entries?titleId=${titleB.id}`)
            .set(await asA())
            .expect(404);
        expect(await db().entry.count({ where: { titleId: titleB.id } })).toBe(1);
    });

    it('série de B', async () => {
        await api()
            .get(`/api/v1/title-series/${seriesB.id}`)
            .set(await asA())
            .expect(404);
        await api()
            .post(`/api/v1/title-series/${seriesB.id}/extend`)
            .set(await asA())
            .send({ count: 1 })
            .expect(404);
        await api()
            .delete(`/api/v1/title-series/${seriesB.id}`)
            .set(await asA())
            .expect(404);
        expect(await db().title.count({ where: { seriesId: seriesB.id } })).toBe(2);
    });

    it('as listagens de A não trazem nada de B', async () => {
        for (const path of ['presets', 'titles', 'entries', 'title-series']) {
            const res = await api()
                .get(`/api/v1/${path}`)
                .set(await asA())
                .expect(200);
            expect(
                res.body.items.every(
                    (item: { id: string }) =>
                        ![b.preset.id, titleB.id, entryB.id, seriesB.id].includes(item.id),
                ),
            ).toBe(true);
        }
        const titles = await api()
            .get('/api/v1/titles')
            .set(await asA())
            .expect(200);
        expect(titles.body.total).toBe(0);
    });
});

describe('contas e presets de B usados no contexto de A', () => {
    it('criar título com o preset de B responde 404 PRESET_NOT_FOUND', async () => {
        const res = await api()
            .post('/api/v1/titles')
            .set(await asA())
            .send(titleBody({ preset: b.preset, party: a.party }))
            .expect(404);
        expect(res.body).toMatchObject({ code: 'PRESET_NOT_FOUND' });
        expect(await db().title.count({ where: { companyId: A } })).toBe(0);
    });

    it('criar preset com contas de B responde 400 PRESET_ACCOUNT_INVALID', async () => {
        const res = await api()
            .post('/api/v1/presets')
            .set(await asA())
            .send({
                billingPlanId: a.plan.id,
                name: 'Invasor',
                accounts: { receivable: b.accounts.receivable, payable: b.accounts.payable },
            })
            .expect(400);
        expect(res.body).toMatchObject({ code: 'PRESET_ACCOUNT_INVALID' });
    });

    it('criar preset no plano de B responde 404 BILLING_PLAN_NOT_FOUND', async () => {
        const res = await api()
            .post('/api/v1/presets')
            .set(await asA())
            .send({
                billingPlanId: b.plan.id,
                name: 'Invasor',
                accounts: { receivable: a.accounts.receivable, payable: a.accounts.payable },
            })
            .expect(404);
        expect(res.body).toMatchObject({ code: 'BILLING_PLAN_NOT_FOUND' });
    });

    it('pagar título de A com a conta de B responde 400 ENTRY_ACCOUNT_INVALID', async () => {
        const titleA = (
            await api()
                .post('/api/v1/titles')
                .set(await asA())
                .send(titleBody(a))
                .expect(201)
        ).body;
        const res = await api()
            .post(`/api/v1/titles/${titleA.id}/entries`)
            .set(await asA())
            .send({
                billingAccountId: b.accounts.bank,
                principalAmount: '10.00',
                paidAt: isoDay(-5),
                paymentMethod: 'PIX',
            })
            .expect(400);
        expect(res.body).toMatchObject({ code: 'ENTRY_ACCOUNT_INVALID' });
        expect(await db().entry.count({ where: { titleId: titleA.id } })).toBe(0);
    });
});
