import { useTestApp } from '@test/e2e/support/app.js';
import { lastDayOf, monthDay, monthKey } from '@test/e2e/support/closing-fixtures.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    asTenant,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
const period = `start=${isoDay(-60)}&end=${isoDay(0)}`;

describe('isolamento entre empresas no bloco 5', () => {
    it('o fechamento de uma empresa não trava, nem aparece para, a outra', async () => {
        const a = await seedReportLedger(db(), { name: 'A' });
        const b = await seedReportLedger(db(), { name: 'B' });
        const headersA = await asTenant('admin', a.company.id);
        const headersB = await asTenant('admin', b.company.id);
        const entry = (seed: typeof a, headers: Record<string, string>) =>
            api()
                .post('/api/v1/journal-entries')
                .set(headers)
                .send({
                    date: monthDay(3, 10),
                    description: 'Aporte',
                    lines: [
                        { accountId: seed.accounts.bank, debit: '10.00' },
                        { accountId: seed.accounts.capital, credit: '10.00' },
                    ],
                });
        await entry(a, headersA).expect(201);
        await entry(b, headersB).expect(201);
        await api()
            .post('/api/v1/period-closings')
            .set(headersA)
            .send({ month: monthKey(3) })
            .expect(201);

        expect((await entry(a, headersA)).status).toBe(409);
        expect((await entry(b, headersB)).status).toBe(201);
        const listB = (await api().get('/api/v1/period-closings').set(headersB).expect(200)).body;
        expect(listB).toEqual({ closedThrough: null, items: [] });
        const listA = (await api().get('/api/v1/period-closings').set(headersA).expect(200)).body;
        expect(listA.closedThrough).toBe(lastDayOf(monthKey(3)));
        const reopenB = await api().delete('/api/v1/period-closings/latest').set(headersB);
        expect(reopenB.status).toBe(404);
        expect(reopenB.body.code).toBe('PERIOD_CLOSING_NOT_FOUND');
        expect(
            (await api().get('/api/v1/period-closings').set(headersA).expect(200)).body.items,
        ).toHaveLength(1);
    });

    it('os relatórios de caixa e gerencial da empresa A não mudam com o movimento da B', async () => {
        const a = await seedReportLedger(db(), { name: 'A' });
        const b = await seedReportLedger(db(), { name: 'B' });
        const headersA = await asTenant('admin', a.company.id);
        await runReportScenario(api, headersA, a);
        const paths = [
            `reports/cash-flow?${period}&groupBy=day`,
            `reports/management-dre?${period}&groupBy=month`,
            `entries?paidFrom=${isoDay(-60)}&titleType=INCOME&pageSize=100`,
        ];
        const read = () =>
            Promise.all(
                paths.map(
                    async path =>
                        (await api().get(`/api/v1/${path}`).set(headersA).expect(200)).body,
                ),
            );
        const before = await read();
        await runReportScenario(api, await asTenant('admin', b.company.id), b);
        expect(await read()).toEqual(before);
    });

    it('conta de outra empresa não vale como destino nem como filtro', async () => {
        const a = await seedReportLedger(db(), { name: 'A' });
        const b = await seedReportLedger(db(), { name: 'B' });
        const headersA = await asTenant('admin', a.company.id);
        const res = await api()
            .post('/api/v1/titles')
            .set(headersA)
            .send({
                presetId: a.preset.id,
                type: 'EXPENSE',
                description: 'Máquina',
                amount: '10.00',
                expirationDate: isoDay(20),
                destinationAccountId: b.accounts.bank,
            });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DESTINATION_ACCOUNT_INVALID');
        expect(
            (
                await api()
                    .get(`/api/v1/entries?billingAccountId=${b.accounts.bank}`)
                    .set(headersA)
                    .expect(200)
            ).body.total,
        ).toBe(0);
    });
});
