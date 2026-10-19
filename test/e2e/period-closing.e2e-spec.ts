import { useTestApp } from '@test/e2e/support/app.js';
import { lastDayOf, monthDay, monthKey } from '@test/e2e/support/closing-fixtures.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';
import { journalOf, titleBody } from '@test/e2e/support/ledger-fixtures.js';
import {
    asTenant,
    type ReportLedger,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
let seed: ReportLedger;
let headers: Record<string, string>;

const post = (path: string, body: Record<string, unknown> = {}) =>
    api().post(`/api/v1/${path}`).set(headers).send(body);
const close = (month: string, extra: Record<string, unknown> = {}) =>
    post('period-closings', { month, ...extra });
const manual = (date: string) =>
    post('journal-entries', {
        date,
        description: 'Aporte',
        lines: [
            { accountId: seed.accounts.bank, debit: '100.00' },
            { accountId: seed.accounts.capital, credit: '100.00' },
        ],
    });
const pay = (titleId: string, paidAt: string) =>
    post(`titles/${titleId}/entries`, {
        billingAccountId: seed.accounts.bank,
        principalAmount: '100.00',
        paidAt,
        paymentMethod: 'PIX',
    });

/** Três meses de movimento: aporte em M3, três títulos emitidos em M3 e um pagamento em M3. */
async function prepare() {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    const aporte = (await manual(monthDay(3, 10)).expect(201)).body;
    const issue = async (description: string, day: number) =>
        (
            await post(
                'titles',
                titleBody(seed, {
                    description,
                    amount: '1000.00',
                    issueDate: monthDay(3, day),
                    expirationDate: isoDay(20),
                }),
            ).expect(201)
        ).body;
    const t1 = await issue('T1', 5);
    const t2 = await issue('T2', 6);
    const t3 = await issue('T3', 7);
    const paymentInM3 = (await pay(t2.id, monthDay(3, 15)).expect(201)).body;
    return { aporte, t1, t2, t3, paymentInM3 };
}

describe('fechamento mensal', () => {
    it('em sequência a partir do mês do lançamento mais antigo, só de meses encerrados', async () => {
        await prepare();
        const wrongFirst = await close(monthKey(2));
        expect(wrongFirst.status).toBe(400);
        expect(wrongFirst.body.code).toBe('PERIOD_CLOSING_INVALID');

        const first = await close(monthKey(3));
        expect(first.status).toBe(201);
        expect(first.body).toMatchObject({
            month: monthKey(3),
            throughDate: lastDayOf(monthKey(3)),
            closingEntryId: null,
        });

        for (const month of [monthKey(1), monthKey(3), monthKey(0), monthKey(-1)]) {
            const res = await close(month);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PERIOD_CLOSING_INVALID');
        }
        expect((await close(monthKey(2))).status).toBe(201);
        const list = (await api().get('/api/v1/period-closings').set(headers).expect(200)).body;
        expect(list.closedThrough).toBe(lastDayOf(monthKey(2)));
        expect(list.items.map((item: { month: string }) => item.month)).toEqual([
            monthKey(2),
            monthKey(3),
        ]);
    });

    it('empresa sem lançamentos fecha qualquer mês encerrado', async () => {
        const empty = await createCompanyFixture(db(), { name: 'Vazia' });
        const res = await api()
            .post('/api/v1/period-closings')
            .set(await asTenant('admin', empty.id))
            .send({ month: monthKey(1) });
        expect(res.status).toBe(201);
    });

    it('dois fechamentos simultâneos do mesmo mês: um passa, o outro perde a corrida', async () => {
        await prepare();
        const results = await Promise.all([close(monthKey(3)), close(monthKey(3))]);
        expect(results.map(result => result.status).sort()).toEqual([201, 400]);
        expect(await db().periodClosing.count()).toBe(1);
    });
});

describe('trava de período', () => {
    it('recusa criar título, série, lançamento manual, baixa e perda em data fechada', async () => {
        const { t1, t3 } = await prepare();
        await close(monthKey(3)).expect(201);
        const before = await db().journalEntry.count();
        const closedDay = lastDayOf(monthKey(3));
        const attempts = [
            () => manual(closedDay),
            () =>
                post(
                    'titles',
                    titleBody(seed, {
                        issueDate: monthDay(3, 20),
                        expirationDate: isoDay(20),
                    }),
                ),
            () =>
                post('title-series', {
                    kind: 'INSTALLMENT',
                    presetId: seed.preset.id,
                    partyId: seed.party.id,
                    type: 'EXPENSE',
                    description: 'S',
                    amount: '30.00',
                    issueDate: monthDay(3, 20),
                    expirationDate: isoDay(20),
                    count: 2,
                }),
            () => pay(t1.id, monthDay(3, 20)),
            () => post(`titles/${t3.id}/write-off`, { paidAt: monthDay(3, 25) }),
        ];
        for (const attempt of attempts) {
            const res = await attempt();
            expect(res.status).toBe(409);
            expect(res.body.code).toBe('PERIOD_CLOSED');
        }
        expect(await db().journalEntry.count()).toBe(before);
        expect(await db().title.count()).toBe(3);
        expect(await db().titleSeries.count()).toBe(0);
    });

    it('aceita datas depois da trava (primeiro dia do mês seguinte)', async () => {
        const { t1 } = await prepare();
        await close(monthKey(3)).expect(201);
        expect((await manual(monthDay(2, 1))).status).toBe(201);
        expect(
            (
                await post(
                    'titles',
                    titleBody(seed, {
                        issueDate: monthDay(2, 1),
                        expirationDate: isoDay(20),
                    }),
                )
            ).status,
        ).toBe(201);
        expect((await pay(t1.id, monthDay(2, 5))).status).toBe(201);
    });

    it('estornos seguem permitidos e entram hoje: lançamento manual e cancelamento de título', async () => {
        const { aporte, t3 } = await prepare();
        await close(monthKey(3)).expect(201);
        const reversal = await post(`journal-entries/${aporte.id}/reverse`);
        expect(reversal.status).toBe(201);
        expect(reversal.body.date).toBe(isoDay(0));
        await api().delete(`/api/v1/titles/${t3.id}`).set(headers).expect(204);
        expect((await journalOf(db(), 'TITLE_CANCELLATION', t3.id)).date).toBe(isoDay(0));
    });

    it('excluir uma baixa paga em período fechado é recusado; a paga em período aberto é excluída', async () => {
        const { t1, paymentInM3 } = await prepare();
        await close(monthKey(3)).expect(201);
        const open = (await pay(t1.id, monthDay(2, 5)).expect(201)).body;
        const blocked = await api().delete(`/api/v1/entries/${paymentInM3.id}`).set(headers);
        expect(blocked.status).toBe(409);
        expect(blocked.body.code).toBe('PERIOD_CLOSED');
        expect(await db().entry.count({ where: { id: paymentInM3.id } })).toBe(1);
        await api().delete(`/api/v1/entries/${open.id}`).set(headers).expect(204);
    });

    it('editar descrição de baixa de período fechado continua livre', async () => {
        const { paymentInM3 } = await prepare();
        await close(monthKey(3)).expect(201);
        const res = await api()
            .put(`/api/v1/entries/${paymentInM3.id}`)
            .set(headers)
            .send({ description: 'Conferido' });
        expect(res.status).toBe(200);
        expect(res.body.description).toBe('Conferido');
    });
});
