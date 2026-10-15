import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    asTenant,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();

describe('INTERNAL_BILLING (SUPPORT) lê os relatórios novos, mas não fecha, reabre nem classifica', () => {
    it('leituras 200 e escritas 403, sem alterar o banco', async () => {
        const seed = await seedReportLedger(db());
        await runReportScenario(api, await asTenant('admin', seed.company.id), seed);
        const support = await asTenant('billing', seed.company.id);
        const period = `start=${isoDay(-60)}&end=${isoDay(0)}`;
        for (const path of [
            `reports/cash-flow?${period}&groupBy=day`,
            `reports/management-dre?${period}`,
            'period-closings',
            `entries?paidFrom=${isoDay(-60)}&titleType=INCOME`,
        ]) {
            await api().get(`/api/v1/${path}`).set(support).expect(200);
        }
        const writes = await Promise.all([
            api().post('/api/v1/period-closings').set(support).send({ month: '2025-01' }),
            api().delete('/api/v1/period-closings/latest').set(support),
            api()
                .put(`/api/v1/billing-accounts/${seed.accounts.expense}`)
                .set(support)
                .send({ costBehavior: 'FIXED' }),
            api()
                .post('/api/v1/titles')
                .set(support)
                .send({
                    presetId: seed.preset.id,
                    type: 'EXPENSE',
                    description: 'Máquina',
                    amount: '10.00',
                    expirationDate: isoDay(20),
                    destinationAccountId: seed.accounts.bank,
                }),
        ]);
        expect(writes.map(res => res.status)).toEqual([403, 403, 403, 403]);
        expect(writes.every(res => res.body.code === 'FORBIDDEN')).toBe(true);
        expect(await db().periodClosing.count()).toBe(0);
        expect(
            (await db().company.findUniqueOrThrow({ where: { id: seed.company.id } }))
                .closedThrough,
        ).toBeNull();
    });
});
