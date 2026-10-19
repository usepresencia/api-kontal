import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    expectLedgerReconciled,
    seedLedger,
    titleBody,
} from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();

describe('baixas simultâneas no mesmo título', () => {
    it('10 pagamentos de 300 em um título de 1000: só 3 cabem, o saldo fica exato e o razão fecha', async () => {
        const { company, accounts, preset, party } = await seedLedger(db());
        const auth = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        await api().get('/api/v1/auth/me').set(auth).expect(200);
        const title = (
            await api()
                .post('/api/v1/titles')
                .set(auth)
                .send(titleBody({ preset, party }))
                .expect(201)
        ).body;

        const results = await Promise.all(
            Array.from({ length: 10 }, () =>
                api()
                    .post(`/api/v1/titles/${title.id}/entries`)
                    .set(auth)
                    .send({
                        billingAccountId: accounts.bank,
                        principalAmount: '300.00',
                        paidAt: isoDay(-5),
                        paymentMethod: 'PIX',
                    }),
            ),
        );

        const statuses = results.map(r => r.status);
        expect(statuses.filter(s => s === 201)).toHaveLength(3);
        expect(statuses.filter(s => s === 409)).toHaveLength(7);
        expect(
            results
                .filter(r => r.status === 409)
                .every(r => r.body.code === 'ENTRY_EXCEEDS_BALANCE'),
        ).toBe(true);
        expect(await db().entry.count()).toBe(3);
        const saved = await db().title.findUniqueOrThrow({ where: { id: title.id } });
        expect(saved.settledAmount.toFixed(2)).toBe('900.00');
        expect(saved.status).toBe('OPEN');
        expect(await db().journalEntry.count({ where: { referenceType: 'SETTLEMENT' } })).toBe(3);
        await expectLedgerReconciled(db(), company.id);
    });

    it('baixas simultâneas que somam exatamente o valor quitam o título uma única vez', async () => {
        const { company, accounts, preset, party } = await seedLedger(db());
        const auth = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        await api().get('/api/v1/auth/me').set(auth).expect(200);
        const title = (
            await api()
                .post('/api/v1/titles')
                .set(auth)
                .send(titleBody({ preset, party }))
                .expect(201)
        ).body;
        const results = await Promise.all(
            Array.from({ length: 4 }, () =>
                api()
                    .post(`/api/v1/titles/${title.id}/entries`)
                    .set(auth)
                    .send({
                        billingAccountId: accounts.bank,
                        principalAmount: '250.00',
                        paidAt: isoDay(-5),
                        paymentMethod: 'PIX',
                    }),
            ),
        );
        expect(results.map(r => r.status)).toEqual([201, 201, 201, 201]);
        const saved = await db().title.findUniqueOrThrow({ where: { id: title.id } });
        expect(saved).toMatchObject({ status: 'SETTLED' });
        expect(saved.settledAmount.toFixed(2)).toBe('1000.00');
        await expectLedgerReconciled(db(), company.id);
    });
});
