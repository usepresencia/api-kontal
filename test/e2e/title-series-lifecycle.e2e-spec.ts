import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    expectLedgerReconciled,
    journalOf,
    seedLedger,
} from '@test/e2e/support/ledger-fixtures.js';

const { api, db, queries } = useTestApp();
const asAdmin = async (companyId: string) => ({
    ...(await bearer('admin')),
    'X-Tenant-Id': companyId,
});

let seed: Awaited<ReturnType<typeof seedLedger>>;
let companyId: string;

beforeEach(async () => {
    seed = await seedLedger(db());
    companyId = seed.company.id;
});

const recurring = (overrides: Record<string, unknown> = {}) => ({
    kind: 'RECURRING',
    presetId: seed.preset.id,
    type: 'EXPENSE',
    description: 'Aluguel',
    amount: '2500.00',
    issueDate: '2026-11-05',
    expirationDate: '2026-11-10',
    count: 3,
    ...overrides,
});
const create = async (overrides: Record<string, unknown> = {}) =>
    (
        await api()
            .post('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .send(recurring(overrides))
            .expect(201)
    ).body;

describe('POST /title-series/:id/extend', () => {
    it('continua a numeração e as datas, repete preset, contas e valor e atualiza a quantidade', async () => {
        const series = await create({ feesPercentageMonthly: 0.02 });
        const res = await api()
            .post(`/api/v1/title-series/${series.id}/extend`)
            .set(await asAdmin(companyId))
            .send({ count: 2 })
            .expect(201);
        expect(res.body.totalCount).toBe(5);
        const added = res.body.titles;
        expect(added).toHaveLength(2);
        expect(
            added.map((t: { seriesIndex: number; description: string; expirationDate: string }) => [
                t.seriesIndex,
                t.description,
                t.expirationDate,
            ]),
        ).toEqual([
            [4, 'Aluguel (4)', '2027-02-10'],
            [5, 'Aluguel (5)', '2027-03-10'],
        ]);
        expect(added[0]).toMatchObject({
            amount: '2500.00',
            controlAccountId: seed.accounts.payable,
            feesPercentageMonthly: 0.02,
        });
        expect((await journalOf(db(), 'TITLE_CREATION', added[0].id)).date).toBe('2027-02-05');
        await expectLedgerReconciled(db(), companyId);
    });

    it('409 SERIES_NOT_EXTENDABLE para parcelado, 400 sem fim e acima de 120, 404 para desconhecida', async () => {
        const installment = await create({
            kind: 'INSTALLMENT',
            type: 'INCOME',
            count: 3,
            amount: '300.00',
        });
        const blocked = await api()
            .post(`/api/v1/title-series/${installment.id}/extend`)
            .set(await asAdmin(companyId))
            .send({ count: 1 })
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'SERIES_NOT_EXTENDABLE' });

        const series = await create({ count: 60 });
        await api()
            .post(`/api/v1/title-series/${series.id}/extend`)
            .set(await asAdmin(companyId))
            .send({ count: 60 })
            .expect(201);
        const full = await api()
            .post(`/api/v1/title-series/${series.id}/extend`)
            .set(await asAdmin(companyId))
            .send({ count: 1 })
            .expect(400);
        expect(full.body).toMatchObject({ code: 'SERIES_LIMIT_EXCEEDED' });
        const noEnd = await api()
            .post(`/api/v1/title-series/${series.id}/extend`)
            .set(await asAdmin(companyId))
            .send({})
            .expect(400);
        expect(noEnd.body).toMatchObject({ code: 'SERIES_INVALID' });
        const missing = await api()
            .post('/api/v1/title-series/3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f/extend')
            .set(await asAdmin(companyId))
            .send({ count: 1 })
            .expect(404);
        expect(missing.body).toMatchObject({ code: 'SERIES_NOT_FOUND' });
        expect(await db().title.count({ where: { seriesId: series.id } })).toBe(120);
    });
});

describe('DELETE /title-series/:id', () => {
    it('sem baixas: estorna e exclui todos os títulos e remove a série', async () => {
        const series = await create({ issueDate: isoDay(5), expirationDate: isoDay(10) });
        const res = await api()
            .delete(`/api/v1/title-series/${series.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(res.body).toEqual({ cancelled: 3, kept: 0 });
        expect(await db().title.count()).toBe(0);
        expect(await db().titleSeries.count()).toBe(0);
        expect(
            await db().journalEntry.count({ where: { referenceType: 'TITLE_CANCELLATION' } }),
        ).toBe(3);
        await api()
            .get(`/api/v1/title-series/${series.id}`)
            .set(await asAdmin(companyId))
            .expect(404);
        await expectLedgerReconciled(db(), companyId);
    });

    it('mantém o título que já tem baixa, com a série', async () => {
        const series = await create({
            type: 'INCOME',
            issueDate: isoDay(-5),
            expirationDate: isoDay(5),
        });
        await api()
            .post(`/api/v1/titles/${series.titles[0].id}/entries`)
            .set(await asAdmin(companyId))
            .send({
                billingAccountId: seed.accounts.bank,
                principalAmount: '100.00',
                paidAt: isoDay(-1),
                paymentMethod: 'PIX',
            })
            .expect(201);
        const res = await api()
            .delete(`/api/v1/title-series/${series.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(res.body).toEqual({ cancelled: 2, kept: 1 });
        expect(await db().title.count()).toBe(1);
        expect(await db().titleSeries.count()).toBe(1);
        await expectLedgerReconciled(db(), companyId);
    });

    it('ocorrências futuras são estornadas na data do lançamento original', async () => {
        const series = await create({ issueDate: isoDay(60), expirationDate: isoDay(65) });
        const originals = await Promise.all(
            series.titles.map((t: { id: string }) => journalOf(db(), 'TITLE_CREATION', t.id)),
        );
        await api()
            .delete(`/api/v1/title-series/${series.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        const reversals = await Promise.all(
            series.titles.map((t: { id: string }) => journalOf(db(), 'TITLE_CANCELLATION', t.id)),
        );
        expect(reversals.map(r => r.date)).toEqual(originals.map(o => o.date));
    });

    it('cancelar 3 e 40 ocorrências executa a mesma quantidade de queries', async () => {
        const auth = await asAdmin(companyId);
        await api().get('/api/v1/auth/me').set(auth).expect(200);
        const small = await create({ count: 3 });
        const large = await create({ count: 40 });
        const smallCount = await queries().count(async () => {
            await api().delete(`/api/v1/title-series/${small.id}`).set(auth).expect(200);
        });
        const largeCount = await queries().count(async () => {
            await api().delete(`/api/v1/title-series/${large.id}`).set(auth).expect(200);
        });
        expect(largeCount).toBe(smallCount);
    });
});

describe('GET /title-series', () => {
    it('lista paginada com filtro de tipo', async () => {
        await create();
        await create({ kind: 'INSTALLMENT', type: 'INCOME', count: 2, amount: '200.00' });
        const all = await api()
            .get('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(all.body.total).toBe(2);
        const recurringOnly = await api()
            .get('/api/v1/title-series?kind=RECURRING')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(recurringOnly.body.items.map((s: { kind: string }) => s.kind)).toEqual([
            'RECURRING',
        ]);
        await api()
            .get('/api/v1/title-series?kind=X')
            .set(await asAdmin(companyId))
            .expect(400);
        await api()
            .get('/api/v1/title-series/abc')
            .set(await asAdmin(companyId))
            .expect(400);
    });
});
