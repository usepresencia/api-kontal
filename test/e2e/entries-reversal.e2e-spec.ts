import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    c,
    d,
    expectLedgerReconciled,
    journalOf,
    seedLedger,
    sorted,
    titleBody,
} from '@test/e2e/support/ledger-fixtures.js';

const { api, db } = useTestApp();
const asAdmin = async (companyId: string) => ({
    ...(await bearer('admin')),
    'X-Tenant-Id': companyId,
});

let seed: Awaited<ReturnType<typeof seedLedger>>;
let companyId: string;
let a: typeof seed.accounts;

beforeEach(async () => {
    seed = await seedLedger(db());
    companyId = seed.company.id;
    a = seed.accounts;
});

const createTitle = async (overrides: Record<string, unknown> = {}) =>
    (
        await api()
            .post('/api/v1/titles')
            .set(await asAdmin(companyId))
            .send(titleBody(seed, overrides))
            .expect(201)
    ).body;
const pay = async (titleId: string, overrides: Record<string, unknown> = {}) =>
    (
        await api()
            .post(`/api/v1/titles/${titleId}/entries`)
            .set(await asAdmin(companyId))
            .send({
                billingAccountId: a.bank,
                principalAmount: '300.00',
                paidAt: isoDay(-5),
                paymentMethod: 'PIX',
                ...overrides,
            })
            .expect(201)
    ).body;
const getTitle = async (id: string) =>
    (
        await api()
            .get(`/api/v1/titles/${id}`)
            .set(await asAdmin(companyId))
            .expect(200)
    ).body;

describe('DELETE /entries/:id: estorno', () => {
    it('exclui a baixa, reabre o saldo e posta o estorno nas mesmas contas, na data de hoje', async () => {
        const title = await createTitle();
        const entry = await pay(title.id, {
            principalAmount: '1000.00',
            interestAmount: '50.00',
            discountAmount: '30.00',
        });
        expect(await getTitle(title.id)).toMatchObject({ status: 'SETTLED' });
        await api()
            .delete(`/api/v1/entries/${entry.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        expect(await db().entry.count()).toBe(0);
        expect(await getTitle(title.id)).toMatchObject({
            status: 'OPEN',
            settledAmount: '0.00',
            remainingAmount: '1000.00',
        });
        const original = await journalOf(db(), 'SETTLEMENT', entry.id);
        const reversal = await journalOf(db(), 'SETTLEMENT_REVERSAL', entry.id);
        expect(reversal.date).toBe(isoDay(0));
        expect(reversal.total).toBe(original.total);
        expect(reversal.lines).toEqual(
            sorted(
                original.lines.map(line => ({
                    accountId: line.accountId,
                    debit: line.credit,
                    credit: line.debit,
                })),
            ),
        );
        await expectLedgerReconciled(db(), companyId);
    });

    it('404 ENTRY_NOT_FOUND na segunda exclusão e não duplica o estorno', async () => {
        const title = await createTitle();
        const entry = await pay(title.id);
        await api()
            .delete(`/api/v1/entries/${entry.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        const again = await api()
            .delete(`/api/v1/entries/${entry.id}`)
            .set(await asAdmin(companyId))
            .expect(404);
        expect(again.body).toMatchObject({ code: 'ENTRY_NOT_FOUND' });
        expect(
            await db().journalEntry.count({ where: { referenceType: 'SETTLEMENT_REVERSAL' } }),
        ).toBe(1);
    });

    it('duas exclusões simultâneas da mesma baixa: uma passa, a outra 404, um único estorno', async () => {
        const title = await createTitle();
        const entry = await pay(title.id);
        const auth = await asAdmin(companyId);
        await api().get('/api/v1/auth/me').set(auth).expect(200);
        const results = await Promise.all([
            api().delete(`/api/v1/entries/${entry.id}`).set(auth),
            api().delete(`/api/v1/entries/${entry.id}`).set(auth),
        ]);
        expect(results.map(r => r.status).sort()).toEqual([204, 404]);
        expect(
            await db().journalEntry.count({ where: { referenceType: 'SETTLEMENT_REVERSAL' } }),
        ).toBe(1);
        expect(await getTitle(title.id)).toMatchObject({ settledAmount: '0.00' });
        await expectLedgerReconciled(db(), companyId);
    });
});

describe('POST /titles/:id/write-off: baixa por perda', () => {
    it('receita: encerra o saldo (D perda com cliente / C a receber) e marca WRITTEN_OFF', async () => {
        const title = await createTitle();
        await pay(title.id, { principalAmount: '300.00' });
        const res = await api()
            .post(`/api/v1/titles/${title.id}/write-off`)
            .set(await asAdmin(companyId))
            .send({})
            .expect(201);
        expect(res.body).toMatchObject({
            kind: 'WRITE_OFF',
            principalAmount: '700.00',
            totalAmount: '0.00',
            billingAccountId: null,
            paymentMethod: null,
        });
        const journal = await journalOf(db(), 'SETTLEMENT', res.body.id);
        expect(journal.date).toBe(isoDay(0));
        expect(journal.lines).toEqual(sorted([d(a.badDebt, '700.00'), c(a.receivable, '700.00')]));
        expect(await getTitle(title.id)).toMatchObject({
            status: 'WRITTEN_OFF',
            remainingAmount: '0.00',
            settledAmount: '1000.00',
        });
        await expectLedgerReconciled(db(), companyId);
    });

    it('despesa: D a pagar / C perdão de dívida', async () => {
        const title = await createTitle({ type: 'EXPENSE', description: 'Fornecedor' });
        const res = await api()
            .post(`/api/v1/titles/${title.id}/write-off`)
            .set(await asAdmin(companyId))
            .send({ description: 'Perdoado' })
            .expect(201);
        const journal = await journalOf(db(), 'SETTLEMENT', res.body.id);
        expect(journal.lines).toEqual(
            sorted([d(a.payable, '1000.00'), c(a.debtForgiveness, '1000.00')]),
        );
        await expectLedgerReconciled(db(), companyId);
    });

    it('409 TITLE_NOT_OPEN para título já baixado ou quitado; 409 ENTRY_DELETE_BLOCKED ao excluir pagamento antes da perda', async () => {
        const title = await createTitle();
        const payment = await pay(title.id, { principalAmount: '300.00' });
        const writeOff = (
            await api()
                .post(`/api/v1/titles/${title.id}/write-off`)
                .set(await asAdmin(companyId))
                .send({})
                .expect(201)
        ).body;
        const again = await api()
            .post(`/api/v1/titles/${title.id}/write-off`)
            .set(await asAdmin(companyId))
            .send({})
            .expect(409);
        expect(again.body).toMatchObject({ code: 'TITLE_NOT_OPEN' });
        const blocked = await api()
            .delete(`/api/v1/entries/${payment.id}`)
            .set(await asAdmin(companyId))
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'ENTRY_DELETE_BLOCKED' });

        await api()
            .delete(`/api/v1/entries/${writeOff.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        expect(await getTitle(title.id)).toMatchObject({
            status: 'OPEN',
            settledAmount: '300.00',
            remainingAmount: '700.00',
        });
        await api()
            .delete(`/api/v1/entries/${payment.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        expect(await getTitle(title.id)).toMatchObject({ status: 'OPEN', settledAmount: '0.00' });
        await expectLedgerReconciled(db(), companyId);
    });

    it('título quitado não pode ser baixado por perda e data futura é recusada', async () => {
        const title = await createTitle();
        const future = await api()
            .post(`/api/v1/titles/${title.id}/write-off`)
            .set(await asAdmin(companyId))
            .send({ paidAt: isoDay(1) })
            .expect(400);
        expect(future.body).toMatchObject({ code: 'ENTRY_DATE_INVALID' });
        await pay(title.id, { principalAmount: '1000.00' });
        const settled = await api()
            .post(`/api/v1/titles/${title.id}/write-off`)
            .set(await asAdmin(companyId))
            .send({})
            .expect(409);
        expect(settled.body).toMatchObject({ code: 'TITLE_NOT_OPEN' });
    });

    it('preset sem a conta de perda responde 400 SETTLEMENT_NOT_POSTABLE', async () => {
        const preset = await db().preset.create({
            data: {
                billingPlanId: seed.plan.id,
                name: 'Sem perda',
                accounts: {
                    create: [
                        { role: 'receivable', accountId: a.receivable },
                        { role: 'payable', accountId: a.payable },
                        { role: 'revenue', accountId: a.revenue },
                    ],
                },
            },
        });
        const title = (
            await api()
                .post('/api/v1/titles')
                .set(await asAdmin(companyId))
                .send(titleBody({ preset, party: seed.party }))
                .expect(201)
        ).body;
        const res = await api()
            .post(`/api/v1/titles/${title.id}/write-off`)
            .set(await asAdmin(companyId))
            .send({})
            .expect(400);
        expect(res.body).toMatchObject({ code: 'SETTLEMENT_NOT_POSTABLE' });
        expect(await getTitle(title.id)).toMatchObject({ status: 'OPEN' });
    });
});
