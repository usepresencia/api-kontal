import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { seedLedger, titleBody } from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();

describe('INTERNAL_BILLING (SUPPORT) lê, mas não escreve', () => {
    it('leituras 200 e escritas 403, sem alterar o banco', async () => {
        const { company, accounts, preset, plan, party } = await seedLedger(db());
        const admin = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        const support = { ...(await bearer('billing')), 'X-Tenant-Id': company.id };
        const title = (
            await api()
                .post('/api/v1/titles')
                .set(admin)
                .send(titleBody({ preset, party }))
                .expect(201)
        ).body;
        const entry = (
            await api()
                .post(`/api/v1/titles/${title.id}/entries`)
                .set(admin)
                .send({
                    billingAccountId: accounts.bank,
                    principalAmount: '100.00',
                    paidAt: isoDay(-5),
                    paymentMethod: 'PIX',
                })
                .expect(201)
        ).body;
        const series = (
            await api()
                .post('/api/v1/title-series')
                .set(admin)
                .send({
                    kind: 'RECURRING',
                    presetId: preset.id,
                    partyId: party.id,
                    type: 'EXPENSE',
                    description: 'Aluguel',
                    amount: '10.00',
                    expirationDate: isoDay(30),
                    count: 2,
                })
                .expect(201)
        ).body;
        const before = {
            titles: await db().title.count(),
            entries: await db().entry.count(),
            journals: await db().journalEntry.count(),
            presets: await db().preset.count(),
        };

        for (const path of [
            'presets',
            'titles',
            'entries',
            'title-series',
            `titles/${title.id}`,
            `entries/${entry.id}`,
            `title-series/${series.id}`,
            `titles/${title.id}/entries`,
        ]) {
            await api().get(`/api/v1/${path}`).set(support).expect(200);
        }
        const accountsBody = { receivable: accounts.receivable, payable: accounts.payable };
        const writes = [
            api()
                .post('/api/v1/presets')
                .set(support)
                .send({ billingPlanId: plan.id, name: 'x', accounts: accountsBody }),
            api()
                .put(`/api/v1/presets/${preset.id}`)
                .set(support)
                .send({ name: 'x', accounts: accountsBody }),
            api().delete(`/api/v1/presets/${preset.id}`).set(support),
            api().post('/api/v1/titles').set(support).send(titleBody({ preset, party })),
            api().put(`/api/v1/titles/${title.id}`).set(support).send({ description: 'x' }),
            api().delete(`/api/v1/titles/${title.id}`).set(support),
            api().post(`/api/v1/titles/${title.id}/write-off`).set(support).send({}),
            api()
                .post(`/api/v1/titles/${title.id}/entries`)
                .set(support)
                .send({
                    billingAccountId: accounts.bank,
                    principalAmount: '10.00',
                    paidAt: isoDay(-5),
                    paymentMethod: 'PIX',
                }),
            api().put(`/api/v1/entries/${entry.id}`).set(support).send({ description: 'x' }),
            api().delete(`/api/v1/entries/${entry.id}`).set(support),
            api()
                .post('/api/v1/title-series')
                .set(support)
                .send({
                    kind: 'RECURRING',
                    presetId: preset.id,
                    partyId: party.id,
                    type: 'EXPENSE',
                    description: 'x',
                    amount: '1.00',
                    expirationDate: isoDay(30),
                    count: 2,
                }),
            api().post(`/api/v1/title-series/${series.id}/extend`).set(support).send({ count: 1 }),
            api().delete(`/api/v1/title-series/${series.id}`).set(support),
        ];
        const results = await Promise.all(writes);
        expect(results.map(r => r.status)).toEqual(Array(writes.length).fill(403));
        expect(results.every(r => r.body.code === 'FORBIDDEN')).toBe(true);
        expect({
            titles: await db().title.count(),
            entries: await db().entry.count(),
            journals: await db().journalEntry.count(),
            presets: await db().preset.count(),
        }).toEqual(before);
    });
});
