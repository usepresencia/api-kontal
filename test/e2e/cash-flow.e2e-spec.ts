import { randomUUID } from 'node:crypto';
import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    asTenant,
    type ReportLedger,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
let seed: ReportLedger;
let headers: Record<string, string>;
let scenario: Awaited<ReturnType<typeof runReportScenario>>;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    scenario = await runReportScenario(api, headers, seed);
});

const get = async (path: string) =>
    (await api().get(`/api/v1/${path}`).set(headers).expect(200)).body;
const cents = (text: string) => Math.round(Number(text) * 100);
const flow = (query: string) => get(`reports/cash-flow?${query}`);

describe('GET /reports/cash-flow', () => {
    it('totais e conta financeira: só pagamentos, pelo valor realmente pago', async () => {
        const body = await flow(`start=${isoDay(-60)}&end=${isoDay(0)}`);
        expect(body).toMatchObject({
            billingPlanId: seed.plan.id,
            start: isoDay(-60),
            end: isoDay(0),
        });
        expect(body.totals).toEqual({ inflows: '615.00', outflows: '300.00', net: '315.00' });
        expect(body.accounts).toEqual([
            {
                accountId: seed.accounts.bank,
                code: '1.1',
                name: 'Banco',
                inflows: '615.00',
                outflows: '300.00',
                net: '315.00',
            },
        ]);
        expect('months' in body).toBe(false);
        expect('days' in body).toBe(false);
    });

    it('groupBy=day traz cada dia com os pagamentos dele', async () => {
        const body = await flow(`start=${isoDay(-60)}&end=${isoDay(0)}&groupBy=day`);
        expect(body.days).toEqual([
            {
                date: isoDay(-5),
                inflows: '615.00',
                outflows: '0.00',
                net: '615.00',
                payments: [
                    {
                        entryId: scenario.paymentA.id,
                        titleId: scenario.titleA.id,
                        titleDescription: 'Venda A',
                        type: 'INCOME',
                        accountCode: '1.1',
                        accountName: 'Banco',
                        paymentMethod: 'PIX',
                        amount: '615.00',
                    },
                ],
            },
            {
                date: isoDay(-2),
                inflows: '0.00',
                outflows: '300.00',
                net: '-300.00',
                payments: [
                    {
                        entryId: scenario.paymentB.id,
                        titleId: scenario.titleB.id,
                        titleDescription: 'Despesa B',
                        type: 'EXPENSE',
                        accountCode: '1.1',
                        accountName: 'Banco',
                        paymentMethod: 'PIX',
                        amount: '300.00',
                    },
                ],
            },
        ]);
    });

    it('as três visões somam o mesmo líquido', async () => {
        const byDay = await flow(`start=${isoDay(-60)}&end=${isoDay(0)}&groupBy=day`);
        const byMonth = await flow(`start=${isoDay(-60)}&end=${isoDay(0)}&groupBy=month`);
        const sum = (items: { net: string }[]) =>
            items.reduce((total, item) => total + cents(item.net), 0);
        expect(sum(byDay.days)).toBe(31500);
        expect(sum(byMonth.months)).toBe(31500);
        expect(sum(byDay.accounts)).toBe(31500);
        expect(cents(byDay.totals.net)).toBe(31500);
        const keys = byMonth.months.map((item: { month: string }) => item.month);
        expect(keys).toEqual([...keys].sort());
    });

    it('período inclusivo nas duas pontas e sem movimento devolve zeros', async () => {
        expect((await flow(`start=${isoDay(-5)}&end=${isoDay(-5)}`)).totals).toEqual({
            inflows: '615.00',
            outflows: '0.00',
            net: '615.00',
        });
        expect((await flow(`start=${isoDay(-2)}&end=${isoDay(-2)}`)).totals).toEqual({
            inflows: '0.00',
            outflows: '300.00',
            net: '-300.00',
        });
        const quiet = await flow(`start=${isoDay(-4)}&end=${isoDay(-3)}`);
        expect(quiet.totals).toEqual({ inflows: '0.00', outflows: '0.00', net: '0.00' });
        expect(quiet.accounts).toEqual([]);
    });

    it('a baixa por perda (hoje) não é caixa', async () => {
        const today = await flow(`start=${isoDay(0)}&end=${isoDay(0)}`);
        expect(today.totals.net).toBe('0.00');
        const entries = await get(`entries?paidFrom=${isoDay(0)}&paidTo=${isoDay(0)}`);
        expect(entries.items.map((item: { kind: string }) => item.kind)).toEqual(['WRITE_OFF']);
    });

    it('excluir uma baixa a tira do caixa', async () => {
        await api().delete(`/api/v1/entries/${scenario.paymentA.id}`).set(headers).expect(204);
        const body = await flow(`start=${isoDay(-60)}&end=${isoDay(0)}`);
        expect(body.totals).toEqual({ inflows: '0.00', outflows: '300.00', net: '-300.00' });
    });

    it('400 para período invertido e para groupBy=day acima de 366 dias; mês aceita períodos longos', async () => {
        const inverted = await api()
            .get(`/api/v1/reports/cash-flow?start=${isoDay(0)}&end=${isoDay(-1)}`)
            .set(headers);
        expect(inverted.status).toBe(400);
        expect(inverted.body.code).toBe('DATE_RANGE_INVALID');
        const long = `start=${isoDay(-400)}&end=${isoDay(0)}`;
        const tooLong = await api()
            .get(`/api/v1/reports/cash-flow?${long}&groupBy=day`)
            .set(headers);
        expect(tooLong.status).toBe(400);
        expect(tooLong.body.code).toBe('DATE_RANGE_INVALID');
        await api().get(`/api/v1/reports/cash-flow?${long}&groupBy=month`).set(headers).expect(200);
        await api()
            .get(`/api/v1/reports/cash-flow?start=${isoDay(-1)}&end=${isoDay(0)}&groupBy=year`)
            .set(headers)
            .expect(400);
    });

    it('plano de outra empresa responde 404', async () => {
        const other = await seedReportLedger(db(), { name: 'Outra' });
        const res = await api()
            .get(
                `/api/v1/reports/cash-flow?start=${isoDay(-1)}&end=${isoDay(0)}&billingPlanId=${other.plan.id}`,
            )
            .set(headers);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('BILLING_PLAN_NOT_FOUND');
    });
});

describe('GET /entries: filtros de pagamento', () => {
    it('lista as três baixas com o tipo do título', async () => {
        const body = await get('entries?pageSize=100');
        expect(body.total).toBe(3);
        expect(
            body.items.every((item: { titleType: string }) =>
                ['INCOME', 'EXPENSE'].includes(item.titleType),
            ),
        ).toBe(true);
    });

    it('filtra por tipo do título, período de pagamento e conta, sozinhos e combinados', async () => {
        expect((await get('entries?titleType=INCOME')).total).toBe(2);
        expect((await get('entries?titleType=EXPENSE')).total).toBe(1);
        expect(
            (await get(`entries?paidFrom=${isoDay(-5)}&paidTo=${isoDay(-5)}`)).items.map(
                (item: { id: string }) => item.id,
            ),
        ).toEqual([scenario.paymentA.id]);
        expect((await get(`entries?paidFrom=${isoDay(-2)}`)).total).toBe(2);
        expect((await get(`entries?paidTo=${isoDay(-5)}`)).total).toBe(1);
        expect((await get(`entries?billingAccountId=${seed.accounts.bank}`)).total).toBe(2);
        expect(
            (
                await get(`entries?titleType=EXPENSE&billingAccountId=${seed.accounts.bank}`)
            ).items.map((item: { id: string }) => item.id),
        ).toEqual([scenario.paymentB.id]);
    });

    it('conta de outra empresa não devolve nada; período invertido responde 400', async () => {
        const other = await seedReportLedger(db(), { name: 'Outra' });
        expect((await get(`entries?billingAccountId=${other.accounts.bank}`)).total).toBe(0);
        expect((await get(`entries?billingAccountId=${randomUUID()}`)).total).toBe(0);
        const res = await api()
            .get(`/api/v1/entries?paidFrom=${isoDay(0)}&paidTo=${isoDay(-1)}`)
            .set(headers);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DATE_RANGE_INVALID');
    });
});
