import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { createCompanyFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';
import {
    asTenant,
    type ReportLedger,
    runReportScenario,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
let seed: ReportLedger;
let headers: Record<string, string>;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
});

const dre = async (query: string) => api().get(`/api/v1/reports/dre?${query}`).set(headers);

describe('GET /reports/dre', () => {
    it('DRE por função do cenário padrão: linhas, totais, árvores e conta sem categoria', async () => {
        await runReportScenario(api, headers, seed);
        const res = await dre(`start=${isoDay(-60)}&end=${isoDay(0)}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            billingPlanId: seed.plan.id,
            start: isoDay(-60),
            end: isoDay(0),
        });
        expect(res.body.lines).toEqual({
            grossRevenue: '1200.00',
            revenueDeductions: '0.00',
            netRevenue: '1200.00',
            costOfSales: '0.00',
            grossProfit: '1200.00',
            operatingExpenses: '500.00',
            otherOperatingResult: '0.00',
            operatingResult: '700.00',
            financialRevenue: '20.00',
            financialExpenses: '5.00',
            financialResult: '15.00',
            resultBeforeTaxes: '715.00',
            incomeTaxes: '0.00',
            netResult: '715.00',
        });
        expect(res.body.totals).toEqual({
            revenues: '1220.00',
            expenses: '505.00',
            result: '715.00',
        });
        expect(res.body.unclassified).toEqual([
            {
                accountId: seed.accounts.expense,
                code: '4.1',
                name: 'Despesas gerais',
                nature: 'EXPENSE',
                amount: '300.00',
            },
        ]);
        expect(res.body.revenueTree).toHaveLength(1);
        expect(res.body.revenueTree[0]).toMatchObject({ code: '3', amount: '1220.00' });
        expect(
            res.body.revenueTree[0].children.map((n: { code: string; amount: string }) => [
                n.code,
                n.amount,
            ]),
        ).toEqual([
            ['3.1', '1200.00'],
            ['3.2', '20.00'],
        ]);
        expect('months' in res.body).toBe(false);
    });

    it('período inclusivo nas duas pontas: início no dia da venda A, fim antes do pagamento', async () => {
        await runReportScenario(api, headers, seed);
        const res = await dre(`start=${isoDay(-10)}&end=${isoDay(-6)}`);
        expect(res.body.lines).toMatchObject({
            grossRevenue: '1200.00',
            operatingExpenses: '300.00',
            financialResult: '0.00',
            netResult: '900.00',
        });
    });

    it('competência: pagar um título não muda o DRE (só os encargos entram)', async () => {
        const title = (
            await api()
                .post('/api/v1/titles')
                .set(headers)
                .send({
                    presetId: seed.preset.id,
                    partyId: seed.party.id,
                    type: 'EXPENSE',
                    description: 'Aluguel',
                    amount: '80.00',
                    issueDate: isoDay(-3),
                    expirationDate: isoDay(10),
                })
                .expect(201)
        ).body;
        const before = (await dre(`start=${isoDay(-30)}&end=${isoDay(0)}`)).body;
        await api()
            .post(`/api/v1/titles/${title.id}/entries`)
            .set(headers)
            .send({
                billingAccountId: seed.accounts.bank,
                principalAmount: '80.00',
                paidAt: isoDay(-1),
                paymentMethod: 'PIX',
            })
            .expect(201);
        const after = (await dre(`start=${isoDay(-30)}&end=${isoDay(0)}`)).body;
        expect(after.lines).toEqual(before.lines);
        expect(after.totals.expenses).toBe('80.00');
    });

    it('estorno de baixa entra na data de hoje: zera os encargos do período corrente e preserva o passado', async () => {
        const { paymentA } = await runReportScenario(api, headers, seed);
        await api().delete(`/api/v1/entries/${paymentA.id}`).set(headers).expect(204);
        expect(
            (await dre(`start=${isoDay(-60)}&end=${isoDay(0)}`)).body.lines.financialResult,
        ).toBe('0.00');
        expect(
            (await dre(`start=${isoDay(-60)}&end=${isoDay(-1)}`)).body.lines.financialResult,
        ).toBe('15.00');
    });

    it('groupBy=month: meses crescentes cuja soma é o resultado do período', async () => {
        await runReportScenario(api, headers, seed);
        const res = await dre(`start=${isoDay(-60)}&end=${isoDay(0)}&groupBy=month`);
        const months = res.body.months as { month: string; result: string }[];
        expect(months.map(m => m.month)).toEqual([...months.map(m => m.month)].sort());
        const total = months.reduce((sum, m) => sum + Math.round(Number(m.result) * 100), 0);
        expect(total).toBe(71500);
    });

    it('sem lançamentos: tudo zero e árvores vazias', async () => {
        const res = await dre(`start=${isoDay(-60)}&end=${isoDay(0)}`);
        expect(res.body.lines.netResult).toBe('0.00');
        expect(res.body.revenueTree).toEqual([]);
    });
});

describe('validação e plano do DRE', () => {
    it('400 DATE_RANGE_INVALID para início depois do fim e 400 para data inválida', async () => {
        const inverted = await dre(`start=${isoDay(0)}&end=${isoDay(-1)}`);
        expect(inverted.status).toBe(400);
        expect(inverted.body.code).toBe('DATE_RANGE_INVALID');
        const invalid = await dre('start=2026-13-01&end=2026-12-31');
        expect(invalid.status).toBe(400);
        expect(invalid.body.code).toBe('VALIDATION_ERROR');
    });

    it('com dois planos usa o padrão sem billingPlanId e aceita escolher outro', async () => {
        const second = await createPlanFixture(db(), seed.company.id);
        const byDefault = await dre(`start=${isoDay(-1)}&end=${isoDay(0)}`);
        expect(byDefault.status).toBe(200);
        const chosen = await dre(`start=${isoDay(-1)}&end=${isoDay(0)}&billingPlanId=${second.id}`);
        expect(chosen.status).toBe(200);
    });

    it('empresa sem plano: 400 BILLING_PLAN_REQUIRED; plano de outra empresa: 404', async () => {
        const other = await seedReportLedger(db(), { name: 'Outra' });
        const foreign = await dre(
            `start=${isoDay(-1)}&end=${isoDay(0)}&billingPlanId=${other.plan.id}`,
        );
        expect(foreign.status).toBe(404);
        expect(foreign.body.code).toBe('BILLING_PLAN_NOT_FOUND');
        const empty = await createCompanyFixture(db(), { name: 'Sem plano' });
        const res = await api()
            .get(`/api/v1/reports/dre?start=${isoDay(-1)}&end=${isoDay(0)}`)
            .set(await asTenant('admin', empty.id));
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BILLING_PLAN_REQUIRED');
    });
});
