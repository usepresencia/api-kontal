import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    asTenant,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();

describe('INTERNAL_BILLING (SUPPORT) lê relatórios, mas não lança nem estorna', () => {
    it('leituras 200 e escritas 403, sem alterar o razão', async () => {
        const seed = await seedReportLedger(db());
        const { manual } = await runReportScenario(
            api,
            await asTenant('admin', seed.company.id),
            seed,
        );
        const support = await asTenant('billing', seed.company.id);
        const period = `start=${isoDay(-60)}&end=${isoDay(0)}`;
        for (const path of [
            `reports/dre?${period}`,
            `reports/trial-balance?${period}`,
            `reports/balance-sheet?date=${isoDay(0)}`,
            `reports/daily-journal?${period}`,
            `reports/account-ledger?accountId=${seed.accounts.bank}&${period}`,
            'journal-entries',
            `journal-entries/${manual.id}`,
        ]) {
            await api().get(`/api/v1/${path}`).set(support).expect(200);
        }
        const before = await db().journalEntry.count();
        const writes = await Promise.all([
            api()
                .post('/api/v1/journal-entries')
                .set(support)
                .send({
                    date: isoDay(-1),
                    description: 'x',
                    lines: [
                        { accountId: seed.accounts.bank, debit: '1.00' },
                        { accountId: seed.accounts.capital, credit: '1.00' },
                    ],
                }),
            api().post(`/api/v1/journal-entries/${manual.id}/reverse`).set(support).send({}),
            api()
                .put(`/api/v1/billing-accounts/${seed.accounts.expense}`)
                .set(support)
                .send({ dreCategory: 'COST_OF_SALES' }),
        ]);
        expect(writes.map(r => r.status)).toEqual([403, 403, 403]);
        expect(writes.every(r => r.body.code === 'FORBIDDEN')).toBe(true);
        expect(await db().journalEntry.count()).toBe(before);
    });
});
