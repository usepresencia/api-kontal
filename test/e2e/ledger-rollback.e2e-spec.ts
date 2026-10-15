import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { seedLedger, titleBody } from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();

/** Faz qualquer novo lançamento falhar no banco, sem afetar os já gravados. */
const breakJournal = () =>
    db().$executeRawUnsafe(
        `ALTER TABLE "JournalEntry" ADD CONSTRAINT "tmp_fail_journal" CHECK ("referenceId" = 'nunca') NOT VALID`,
    );
const fixJournal = () =>
    db().$executeRawUnsafe(
        `ALTER TABLE "JournalEntry" DROP CONSTRAINT IF EXISTS "tmp_fail_journal"`,
    );

afterEach(async () => {
    await fixJournal();
});

describe('atomicidade: se o lançamento falha, nada do título ou da baixa é gravado', () => {
    it('criar título', async () => {
        const { company, preset } = await seedLedger(db());
        const auth = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        await breakJournal();
        const res = await api().post('/api/v1/titles').set(auth).send(titleBody(preset.id));
        expect(res.status).toBe(500);
        expect(res.body.code).toBe('INTERNAL_ERROR');
        expect(await db().title.count()).toBe(0);
        expect(await db().journalEntry.count()).toBe(0);
    });

    it('registrar pagamento', async () => {
        const { company, accounts, preset } = await seedLedger(db());
        const auth = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        const title = (
            await api().post('/api/v1/titles').set(auth).send(titleBody(preset.id)).expect(201)
        ).body;
        await breakJournal();
        const res = await api()
            .post(`/api/v1/titles/${title.id}/entries`)
            .set(auth)
            .send({
                billingAccountId: accounts.bank,
                principalAmount: '300.00',
                paidAt: isoDay(-5),
                paymentMethod: 'PIX',
            });
        expect(res.status).toBe(500);
        expect(await db().entry.count()).toBe(0);
        const saved = await db().title.findUniqueOrThrow({ where: { id: title.id } });
        expect(saved.settledAmount.toFixed(2)).toBe('0.00');
        expect(saved.status).toBe('OPEN');
        expect(await db().journalEntry.count()).toBe(1);
    });

    it('excluir título', async () => {
        const { company, preset } = await seedLedger(db());
        const auth = { ...(await bearer('admin')), 'X-Tenant-Id': company.id };
        const title = (
            await api().post('/api/v1/titles').set(auth).send(titleBody(preset.id)).expect(201)
        ).body;
        await breakJournal();
        const res = await api().delete(`/api/v1/titles/${title.id}`).set(auth);
        expect(res.status).toBe(500);
        expect(await db().title.count()).toBe(1);
    });
});
