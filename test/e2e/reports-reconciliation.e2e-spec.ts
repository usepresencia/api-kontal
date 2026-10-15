import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { expectLedgerReconciled } from '@test/e2e/support/ledger-fixtures.js';
import {
    asTenant,
    expectReportsReconciled,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();

describe('conciliação entre relatórios', () => {
    it('as seis invariantes valem no cenário padrão com reclassificação manual e estornos', async () => {
        const seed = await seedReportLedger(db());
        const headers = await asTenant('admin', seed.company.id);
        const { paymentB } = await runReportScenario(api, headers, seed);
        const reclass = (
            await api()
                .post('/api/v1/journal-entries')
                .set(headers)
                .send({
                    date: isoDay(-3),
                    description: 'Reclassificação de despesa',
                    lines: [
                        { accountId: seed.accounts.interestExpense, debit: '50.00' },
                        { accountId: seed.accounts.expense, credit: '50.00' },
                    ],
                })
                .expect(201)
        ).body;
        await api()
            .post(`/api/v1/journal-entries/${reclass.id}/reverse`)
            .set(headers)
            .send({})
            .expect(201);
        await api().delete(`/api/v1/entries/${paymentB.id}`).set(headers).expect(204);

        for (const [start, end] of [
            [isoDay(-60), isoDay(0)],
            [isoDay(-15), isoDay(0)],
            [isoDay(-9), isoDay(-4)],
            [isoDay(0), isoDay(0)],
        ]) {
            await expectReportsReconciled(api, headers, start, end);
        }
        await expectLedgerReconciled(db(), seed.company.id);
    });
});
