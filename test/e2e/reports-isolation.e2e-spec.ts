import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    asTenant,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
const period = `start=${isoDay(-60)}&end=${isoDay(0)}`;

describe('isolamento entre empresas nos relatórios e lançamentos', () => {
    it('relatórios da empresa A não mudam com o movimento da empresa B', async () => {
        const a = await seedReportLedger(db(), { name: 'A' });
        const b = await seedReportLedger(db(), { name: 'B' });
        const headersA = await asTenant('admin', a.company.id);
        await runReportScenario(api, headersA, a);
        const paths = [
            `reports/dre?${period}`,
            `reports/trial-balance?${period}`,
            `reports/balance-sheet?date=${isoDay(0)}`,
            `reports/daily-journal?${period}&pageSize=31`,
            `reports/account-ledger?accountId=${a.accounts.bank}&${period}`,
            'journal-entries?pageSize=100',
        ];
        const read = async () =>
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

    it('plano, conta e lançamento de outra empresa respondem 404 do próprio recurso', async () => {
        const a = await seedReportLedger(db(), { name: 'A' });
        const b = await seedReportLedger(db(), { name: 'B' });
        const headersA = await asTenant('admin', a.company.id);
        const foreign = (await runReportScenario(api, await asTenant('admin', b.company.id), b))
            .manual;
        const cases: [string, string][] = [
            [`reports/dre?${period}&billingPlanId=${b.plan.id}`, 'BILLING_PLAN_NOT_FOUND'],
            [
                `reports/trial-balance?${period}&billingPlanId=${b.plan.id}`,
                'BILLING_PLAN_NOT_FOUND',
            ],
            [
                `reports/balance-sheet?date=${isoDay(0)}&billingPlanId=${b.plan.id}`,
                'BILLING_PLAN_NOT_FOUND',
            ],
            [
                `reports/daily-journal?${period}&billingPlanId=${b.plan.id}`,
                'BILLING_PLAN_NOT_FOUND',
            ],
            [
                `reports/account-ledger?accountId=${b.accounts.bank}&${period}`,
                'BILLING_ACCOUNT_NOT_FOUND',
            ],
            [`journal-entries/${foreign.id}`, 'JOURNAL_ENTRY_NOT_FOUND'],
        ];
        for (const [path, code] of cases) {
            const res = await api().get(`/api/v1/${path}`).set(headersA);
            expect(res.status).toBe(404);
            expect(res.body.code).toBe(code);
        }
        expect(
            (
                await api()
                    .get(`/api/v1/journal-entries?accountId=${b.accounts.bank}`)
                    .set(headersA)
                    .expect(200)
            ).body.total,
        ).toBe(0);
    });
});
