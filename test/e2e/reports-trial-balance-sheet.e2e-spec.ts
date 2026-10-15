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

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    await runReportScenario(api, headers, seed);
});

const get = async (path: string) =>
    (await api().get(`/api/v1/reports/${path}`).set(headers).expect(200)).body;
type Line = {
    code: string;
    openingBalance: unknown;
    debits: string;
    credits: string;
    closingBalance: unknown;
};

describe('GET /reports/trial-balance', () => {
    it('saldos anterior e final com lado, movimento do período e provas', async () => {
        const body = await get(`trial-balance?start=${isoDay(-15)}&end=${isoDay(0)}`);
        const line = (code: string) => (body.lines as Line[]).find(item => item.code === code);
        expect((body.lines as Line[]).map(item => item.code)).toEqual([
            '1',
            '1.1',
            '1.2',
            '2',
            '2.1',
            '3',
            '3.1',
            '3.2',
            '4',
            '4.1',
            '4.2',
            '4.3',
            '5',
            '5.1',
        ]);
        expect(line('1.1')).toMatchObject({
            openingBalance: { amount: '5000.00', side: 'D' },
            debits: '615.00',
            credits: '300.00',
            closingBalance: { amount: '5315.00', side: 'D' },
        });
        expect(line('1.2')).toMatchObject({
            debits: '1200.00',
            credits: '800.00',
            closingBalance: { amount: '400.00', side: 'D' },
        });
        expect(line('2.1')).toMatchObject({
            debits: '300.00',
            credits: '300.00',
            closingBalance: { amount: '0.00', side: 'D' },
        });
        expect(line('5.1')).toMatchObject({
            openingBalance: { amount: '5000.00', side: 'C' },
            closingBalance: { amount: '5000.00', side: 'C' },
        });
        expect(line('1')).toMatchObject({
            openingBalance: { amount: '5000.00', side: 'D' },
            debits: '1815.00',
            credits: '1100.00',
            closingBalance: { amount: '5715.00', side: 'D' },
        });
        expect(body.totals).toEqual({
            debits: '2620.00',
            credits: '2620.00',
            openingDebitBalances: '5000.00',
            openingCreditBalances: '5000.00',
            closingDebitBalances: '6220.00',
            closingCreditBalances: '6220.00',
        });
    });

    it('maxLevel=1 mostra só os grupos e mantém os totais; maxLevel=6 é recusado', async () => {
        const full = await get(`trial-balance?start=${isoDay(-15)}&end=${isoDay(0)}`);
        const top = await get(`trial-balance?start=${isoDay(-15)}&end=${isoDay(0)}&maxLevel=1`);
        expect((top.lines as Line[]).map(item => item.code)).toEqual(['1', '2', '3', '4', '5']);
        expect(top.totals).toEqual(full.totals);
        await api()
            .get(`/api/v1/reports/trial-balance?start=${isoDay(-1)}&end=${isoDay(0)}&maxLevel=6`)
            .set(headers)
            .expect(400);
    });
});

describe('GET /reports/balance-sheet', () => {
    it('ativo = passivo + PL com o resultado acumulado não apurado', async () => {
        const body = await get(`balance-sheet?date=${isoDay(0)}`);
        expect(body).toMatchObject({
            date: isoDay(0),
            assets: {
                current: { total: '5715.00' },
                nonCurrent: { total: '0.00', tree: [] },
                total: '5715.00',
            },
            liabilities: { total: '0.00' },
            equity: {
                accounts: { total: '5000.00' },
                accumulatedResult: '715.00',
                total: '5715.00',
            },
            liabilitiesAndEquity: '5715.00',
        });
        expect(body.assets.current.tree[0]).toMatchObject({ code: '1', amount: '5715.00' });
        expect((body.unclassified as { code: string }[]).map(item => item.code)).toEqual([
            '1.1',
            '1.2',
            '2.1',
        ]);
    });

    it('a categoria de balanço move a conta para o não circulante', async () => {
        await api()
            .put(`/api/v1/billing-accounts/${seed.accounts.receivable}`)
            .set(headers)
            .send({ balanceCategory: 'NON_CURRENT_ASSET' })
            .expect(200);
        const body = await get(`balance-sheet?date=${isoDay(0)}`);
        expect(body.assets.current.total).toBe('5315.00');
        expect(body.assets.nonCurrent.total).toBe('400.00');
        expect(body.assets.nonCurrent.tree[0]).toMatchObject({
            code: '1.2',
            balanceCategory: 'NON_CURRENT_ASSET',
        });
        expect(body.assets.total).toBe(body.liabilitiesAndEquity);
    });

    it('data inclusiva: antes das vendas só o aporte; resultado acumulado zero', async () => {
        const body = await get(`balance-sheet?date=${isoDay(-30)}`);
        expect(body).toMatchObject({
            assets: { total: '5000.00' },
            equity: { accumulatedResult: '0.00', total: '5000.00' },
        });
        expect((await get(`balance-sheet?date=${isoDay(-31)}`)).assets.total).toBe('0.00');
    });

    it('400 sem data', async () => {
        await api().get('/api/v1/reports/balance-sheet').set(headers).expect(400);
    });
});
