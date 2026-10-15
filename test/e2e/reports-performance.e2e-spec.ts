import { useTestApp } from '@test/e2e/support/app.js';
import { asTenant, postJournal, seedReportPlan } from '@test/e2e/support/report-fixtures.js';

const { api, db, queries } = useTestApp();
const MAX_QUERIES = 12;
const START = '2026-01-01';
const END = '2026-12-31';

let seed: Awaited<ReturnType<typeof seedReportPlan>>;

beforeEach(async () => {
    seed = await seedReportPlan(db());
});

const headers = async () => {
    const auth = await asTenant('admin', seed.company.id);
    await api().get('/api/v1/auth/me').set(auth).expect(200);
    return auth;
};

/** `count` lançamentos manuais em dias distintos a partir de `from` (dia do ano, base 0). */
async function addJournals(count: number, from: number) {
    const { bank, sales, admin } = seed.accounts;
    for (let i = from; i < from + count; i++) {
        const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
        await postJournal(
            db(),
            seed.company.id,
            date,
            [
                [bank, '10.00', '0'],
                [sales, '0', '10.00'],
            ],
            'MANUAL',
        );
        await postJournal(
            db(),
            seed.company.id,
            date,
            [
                [admin, '3.00', '0'],
                [bank, '0', '3.00'],
            ],
            'MANUAL',
        );
    }
}

describe('relatórios sem N+1: o número de queries não cresce com o volume', () => {
    const routes = () => [
        `reports/dre?start=${START}&end=${END}&groupBy=month`,
        `reports/trial-balance?start=${START}&end=${END}`,
        `reports/balance-sheet?date=${END}`,
        `reports/daily-journal?start=${START}&end=${END}&pageSize=31`,
        `reports/account-ledger?accountId=${seed.accounts.bank}&start=${START}&end=${END}&pageSize=100`,
        `reports/account-ledger?accountId=${seed.accounts.assetRoot}&start=${START}&end=${END}&groupBy=day`,
        'journal-entries?pageSize=100',
    ];

    it('cada rota com 3 e com 40 dias de movimento', async () => {
        const auth = await headers();
        await addJournals(3, 0);
        const small: number[] = [];
        for (const path of routes()) {
            small.push(
                await queries().count(() => api().get(`/api/v1/${path}`).set(auth).expect(200)),
            );
        }
        await addJournals(37, 3);
        for (const [index, path] of routes().entries()) {
            const large = await queries().count(() =>
                api().get(`/api/v1/${path}`).set(auth).expect(200),
            );
            expect({ path, large }).toEqual({ path, large: small[index] });
            expect(large).toBeGreaterThan(0);
            expect(large).toBeLessThanOrEqual(MAX_QUERIES);
        }
    });

    it('lançamento manual e estorno usam um número limitado de queries, independente do volume', async () => {
        const auth = await headers();
        const { bank, sales } = seed.accounts;
        const create = () =>
            api()
                .post('/api/v1/journal-entries')
                .set(auth)
                .send({
                    date: '2026-06-01',
                    description: 'x',
                    lines: [
                        { accountId: bank, debit: '1.00' },
                        { accountId: sales, credit: '1.00' },
                    ],
                })
                .expect(201);
        let id = '';
        const small = await queries().count(async () => {
            id = (await create()).body.id;
        });
        const reverseSmall = await queries().count(() =>
            api().post(`/api/v1/journal-entries/${id}/reverse`).set(auth).send({}).expect(201),
        );
        await addJournals(40, 0);
        const large = await queries().count(async () => {
            id = (await create()).body.id;
        });
        const reverseLarge = await queries().count(() =>
            api().post(`/api/v1/journal-entries/${id}/reverse`).set(auth).send({}).expect(201),
        );
        expect(large).toBe(small);
        expect(reverseLarge).toBe(reverseSmall);
        expect(Math.min(large, reverseLarge)).toBeGreaterThan(0);
        expect(Math.max(large, reverseLarge)).toBeLessThanOrEqual(MAX_QUERIES + 4);
    });
});
