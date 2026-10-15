import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { createAccountFixture, createCompanyFixture } from '@test/e2e/support/fixtures.js';
import { titleBody } from '@test/e2e/support/ledger-fixtures.js';
import {
    asTenant,
    type ReportLedger,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
let seed: ReportLedger;
let headers: Record<string, string>;
let extra: { taxes: string; cmv: string; commission: string; depreciation: string };

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    const root = await db().billingAccount.findFirstOrThrow({
        where: { billingPlanId: seed.plan.id, code: '4' },
    });
    const account = async (code: string, name: string, extras: Record<string, string>) =>
        (
            await createAccountFixture(db(), {
                billingPlanId: seed.plan.id,
                parentId: root.id,
                code,
                level: 2,
                nature: 'EXPENSE',
                accountType: 'ANALYTIC',
                name,
                ...extras,
            })
        ).id;
    extra = {
        taxes: await account('4.5', 'Impostos sobre vendas', { dreCategory: 'REVENUE_DEDUCTION' }),
        cmv: await account('4.6', 'CMV', { dreCategory: 'COST_OF_SALES' }),
        commission: await account('4.7', 'Comissões', {
            dreCategory: 'OPERATING_EXPENSE',
            costBehavior: 'VARIABLE',
        }),
        depreciation: await account('4.8', 'Depreciação', {
            dreCategory: 'OPERATING_EXPENSE',
            costBehavior: 'DEPRECIATION',
        }),
    };
    for (const [id, dreCategory] of [
        [seed.accounts.revenue, 'GROSS_REVENUE'],
        [seed.accounts.expense, 'OPERATING_EXPENSE'],
        [seed.accounts.interestExpense, 'FINANCIAL_EXPENSE'],
    ]) {
        await api()
            .put(`/api/v1/billing-accounts/${id}`)
            .set(headers)
            .send({ dreCategory })
            .expect(200);
    }
    const title = (overrides: Record<string, unknown>) =>
        api()
            .post('/api/v1/titles')
            .set(headers)
            .send(titleBody(seed.preset.id, { issueDate: isoDay(-5), ...overrides }))
            .expect(201);
    await title({ description: 'Venda', amount: '1000.00' });
    await title({ type: 'EXPENSE', description: 'Despesa geral', amount: '200.00' });
    const spend = (accountId: string, amount: string) =>
        api()
            .post('/api/v1/journal-entries')
            .set(headers)
            .send({
                date: isoDay(-5),
                description: 'Despesa',
                lines: [
                    { accountId, debit: amount },
                    { accountId: seed.accounts.bank, credit: amount },
                ],
            })
            .expect(201);
    await spend(extra.taxes, '100.00');
    await spend(extra.cmv, '300.00');
    await spend(extra.commission, '50.00');
    await spend(extra.depreciation, '20.00');
    await spend(seed.accounts.interestExpense, '10.00');
});

const get = async (path: string) =>
    (await api().get(`/api/v1/${path}`).set(headers).expect(200)).body;
const range = () => `start=${isoDay(-30)}&end=${isoDay(0)}`;
const cents = (text: string) => Math.round(Number(text) * 100);

describe('GET /reports/management-dre', () => {
    it('margem de contribuição, fixos, depreciação, financeiro e resultado', async () => {
        const body = await get(`reports/management-dre?${range()}`);
        expect(body.lines).toEqual({
            grossRevenue: '1000.00',
            revenueDeductions: '100.00',
            netRevenue: '900.00',
            variableCosts: '350.00',
            contributionMargin: '550.00',
            fixedCosts: '200.00',
            otherRevenue: '0.00',
            resultBeforeDepreciation: '350.00',
            depreciation: '20.00',
            operatingResult: '330.00',
            financialRevenue: '0.00',
            financialExpenses: '10.00',
            financialResult: '-10.00',
            resultBeforeTaxes: '320.00',
            incomeTaxes: '0.00',
            netResult: '320.00',
        });
        expect(body.contributionMarginPercent).toBe('61.11');
        expect('months' in body).toBe(false);
    });

    it('o resultado líquido fecha com o do DRE contábil', async () => {
        const management = await get(`reports/management-dre?${range()}`);
        const dre = await get(`reports/dre?${range()}`);
        expect(management.lines.netResult).toBe(dre.lines.netResult);
        expect(dre.lines.netResult).toBe('320.00');
    });

    it('lista as despesas que caíram no padrão, na ordem do plano', async () => {
        const body = await get(`reports/management-dre?${range()}`);
        expect(body.unclassified).toEqual([
            {
                accountId: seed.accounts.expense,
                code: '4.1',
                name: 'Despesas gerais',
                nature: 'EXPENSE',
                amount: '200.00',
            },
            { accountId: extra.cmv, code: '4.6', name: 'CMV', nature: 'EXPENSE', amount: '300.00' },
        ]);
    });

    it('trocar o comportamento da conta muda a margem sem mudar o resultado', async () => {
        await api()
            .put(`/api/v1/billing-accounts/${extra.commission}`)
            .set(headers)
            .send({ costBehavior: 'FIXED' })
            .expect(200);
        await api()
            .put(`/api/v1/billing-accounts/${extra.cmv}`)
            .set(headers)
            .send({ costBehavior: 'FIXED' })
            .expect(200);
        const body = await get(`reports/management-dre?${range()}`);
        expect(body.lines).toMatchObject({
            variableCosts: '0.00',
            contributionMargin: '900.00',
            fixedCosts: '550.00',
            netResult: '320.00',
        });
        expect(body.contributionMarginPercent).toBe('100.00');
        expect(body.unclassified.map((item: { code: string }) => item.code)).toEqual(['4.1']);
    });

    it('groupBy=month soma o resultado do período', async () => {
        const body = await get(`reports/management-dre?${range()}&groupBy=month`);
        const total = body.months.reduce(
            (sum: number, month: { netResult: string }) => sum + cents(month.netResult),
            0,
        );
        expect(total).toBe(32000);
        const keys = body.months.map((month: { month: string }) => month.month);
        expect(keys).toEqual([...keys].sort());
    });

    it('período sem movimento: zeros e margem nula', async () => {
        const body = await get(`reports/management-dre?start=${isoDay(-200)}&end=${isoDay(-100)}`);
        expect(Object.values(body.lines).every(value => value === '0.00')).toBe(true);
        expect(body.contributionMarginPercent).toBeNull();
        expect(body.unclassified).toEqual([]);
    });

    it('400 para período invertido, 404 para plano de outra empresa e 400 sem plano quando a empresa não tem plano', async () => {
        const inverted = await api()
            .get(`/api/v1/reports/management-dre?start=${isoDay(0)}&end=${isoDay(-1)}`)
            .set(headers);
        expect(inverted.status).toBe(400);
        expect(inverted.body.code).toBe('DATE_RANGE_INVALID');
        const other = await seedReportLedger(db(), { name: 'Outra' });
        const foreign = await api()
            .get(`/api/v1/reports/management-dre?${range()}&billingPlanId=${other.plan.id}`)
            .set(headers);
        expect(foreign.status).toBe(404);
        const empty = await createCompanyFixture(db(), { name: 'Sem plano' });
        const none = await api()
            .get(`/api/v1/reports/management-dre?${range()}`)
            .set(await asTenant('admin', empty.id));
        expect(none.status).toBe(400);
        expect(none.body.code).toBe('BILLING_PLAN_REQUIRED');
    });
});
