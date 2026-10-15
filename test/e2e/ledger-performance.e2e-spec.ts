import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { seedLedger } from '@test/e2e/support/ledger-fixtures.js';

const { api, db, queries } = useTestApp();
const MAX_QUERIES = 12;

let seed: Awaited<ReturnType<typeof seedLedger>>;

beforeEach(async () => {
    seed = await seedLedger(db());
});

const headers = async () => {
    const auth = { ...(await bearer('admin')), 'X-Tenant-Id': seed.company.id };
    await api().get('/api/v1/auth/me').set(auth).expect(200);
    return auth;
};

async function addTitles(count: number, startAt: number) {
    const base = {
        companyId: seed.company.id,
        presetId: seed.preset.id,
        controlAccountId: seed.accounts.receivable,
        resultAccountId: seed.accounts.revenue,
        type: 'INCOME' as const,
        amount: '100.00',
        issueDate: new Date(`${isoDay(-10)}T00:00:00.000Z`),
        expirationDate: new Date(`${isoDay(20)}T00:00:00.000Z`),
    };
    await db().title.createMany({
        data: Array.from({ length: count }, (_, i) => ({
            ...base,
            description: `Título ${startAt + i}`,
        })),
    });
}

async function addEntries(titleId: string, count: number) {
    await db().entry.createMany({
        data: Array.from({ length: count }, () => ({
            titleId,
            kind: 'PAYMENT' as const,
            billingAccountId: seed.accounts.bank,
            principalAmount: '1.00',
            totalAmount: '1.00',
            paidAt: new Date(`${isoDay(-5)}T00:00:00.000Z`),
            paymentMethod: 'PIX' as const,
        })),
    });
}

describe('sem N+1: o número de queries não cresce com o número de linhas', () => {
    it('GET /titles com 3 e com 40 títulos', async () => {
        const auth = await headers();
        await addTitles(3, 0);
        const small = await queries().count(async () => {
            const res = await api().get('/api/v1/titles?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(3);
        });
        await addTitles(37, 3);
        const large = await queries().count(async () => {
            const res = await api().get('/api/v1/titles?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(40);
        });
        expect(large).toBe(small);
        expect(large).toBeLessThanOrEqual(MAX_QUERIES);
    });

    it('GET /entries com 3 e com 40 baixas', async () => {
        const auth = await headers();
        await addTitles(1, 0);
        const title = await db().title.findFirstOrThrow();
        await addEntries(title.id, 3);
        const small = await queries().count(async () => {
            const res = await api().get('/api/v1/entries?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(3);
        });
        await addEntries(title.id, 37);
        const large = await queries().count(async () => {
            const res = await api().get('/api/v1/entries?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(40);
        });
        expect(large).toBe(small);
        expect(large).toBeLessThanOrEqual(MAX_QUERIES);
    });

    it('GET /presets com 1 e com 20 presets', async () => {
        const auth = await headers();
        const small = await queries().count(async () => {
            await api().get('/api/v1/presets?pageSize=100').set(auth).expect(200);
        });
        for (let i = 0; i < 19; i += 1) {
            await db().preset.create({
                data: {
                    billingPlanId: seed.plan.id,
                    name: `Preset ${i}`,
                    accounts: {
                        create: [
                            { role: 'receivable', accountId: seed.accounts.receivable },
                            { role: 'payable', accountId: seed.accounts.payable },
                        ],
                    },
                },
            });
        }
        const large = await queries().count(async () => {
            const res = await api().get('/api/v1/presets?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(20);
        });
        expect(large).toBe(small);
        expect(large).toBeLessThanOrEqual(MAX_QUERIES);
    });

    it('GET /title-series/:id com 3 e com 40 títulos', async () => {
        const auth = await headers();
        const makeSeries = async (count: number) =>
            (
                await api()
                    .post('/api/v1/title-series')
                    .set(auth)
                    .send({
                        kind: 'RECURRING',
                        presetId: seed.preset.id,
                        type: 'EXPENSE',
                        description: 'Aluguel',
                        amount: '10.00',
                        expirationDate: isoDay(30),
                        count,
                    })
                    .expect(201)
            ).body;
        const small = await makeSeries(3);
        const large = await makeSeries(40);
        const smallCount = await queries().count(async () => {
            await api().get(`/api/v1/title-series/${small.id}`).set(auth).expect(200);
        });
        const largeCount = await queries().count(async () => {
            const res = await api().get(`/api/v1/title-series/${large.id}`).set(auth).expect(200);
            expect(res.body.titles).toHaveLength(40);
        });
        expect(largeCount).toBe(smallCount);
        expect(largeCount).toBeLessThanOrEqual(MAX_QUERIES);
    });

    it('registrar uma baixa usa um número limitado de queries, independente de quantas já existem', async () => {
        const auth = await headers();
        await addTitles(1, 0);
        const title = await db().title.findFirstOrThrow();
        await db().title.update({ where: { id: title.id }, data: { amount: '100000.00' } });
        const pay = () =>
            queries().count(async () => {
                await api()
                    .post(`/api/v1/titles/${title.id}/entries`)
                    .set(auth)
                    .send({
                        billingAccountId: seed.accounts.bank,
                        principalAmount: '1.00',
                        paidAt: isoDay(-5),
                        paymentMethod: 'PIX',
                    })
                    .expect(201);
            });
        const first = await pay();
        await addEntries(title.id, 40);
        const afterMany = await pay();
        expect(afterMany).toBe(first);
        expect(afterMany).toBeLessThanOrEqual(25);
    });
});
