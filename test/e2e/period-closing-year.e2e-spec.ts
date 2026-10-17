import { useTestApp } from '@test/e2e/support/app.js';
import { businessToday } from '@test/e2e/support/dates.js';
import { createAccountFixture } from '@test/e2e/support/fixtures.js';
import {
    asTenant,
    expectReportsReconciled,
    type ReportLedger,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
const YEAR = businessToday().getUTCFullYear() - 1;
const dec = (day: number) => `${YEAR}-12-${String(day).padStart(2, '0')}`;
let seed: ReportLedger;
let headers: Record<string, string>;
let retained: string;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    retained = (
        await createAccountFixture(db(), {
            billingPlanId: seed.plan.id,
            parentId: seed.accounts.equityRoot,
            code: '5.2',
            level: 2,
            nature: 'EQUITY',
            accountType: 'ANALYTIC',
            name: 'Lucros acumulados',
        })
    ).id;
});

const manual = (date: string, debit: string, credit: string, amount: string) =>
    api()
        .post('/api/v1/journal-entries')
        .set(headers)
        .send({
            date,
            description: 'Lançamento',
            lines: [
                { accountId: debit, debit: amount },
                { accountId: credit, credit: amount },
            ],
        });
const closeYear = (extra: Record<string, unknown> = {}) =>
    api()
        .post('/api/v1/period-closings')
        .set(headers)
        .send({ month: `${YEAR}-12`, retainedEarningsAccountId: retained, ...extra });
const get = async (path: string) =>
    (await api().get(`/api/v1/${path}`).set(headers).expect(200)).body;
const a = () => seed.accounts;

async function profitYear() {
    await manual(dec(10), a().bank, a().revenue, '1000.00').expect(201);
    await manual(dec(15), a().expense, a().bank, '400.00').expect(201);
}

describe('apuração do exercício', () => {
    it('lucro: zera receitas e despesas contra os lucros acumulados em 31/12', async () => {
        await profitYear();
        const res = await closeYear();
        expect(res.status).toBe(201);
        expect(res.body.closingEntryId).not.toBeNull();
        const entry = await get(`journal-entries/${res.body.closingEntryId}`);
        expect(entry).toMatchObject({
            referenceType: 'CLOSING',
            date: dec(31),
            totalDebits: '1000.00',
            totalCredits: '1000.00',
        });
        expect(
            entry.lines.map((l: { accountCode: string; debit: string; credit: string }) => [
                l.accountCode,
                l.debit,
                l.credit,
            ]),
        ).toEqual([
            ['3.1', '1000.00', '0.00'],
            ['4.1', '0.00', '400.00'],
            ['5.2', '0.00', '600.00'],
        ]);
    });

    it('o DRE do ano não zera, o balancete fecha e o balanço leva o lucro para o patrimônio líquido', async () => {
        await profitYear();
        await closeYear().expect(201);
        const dre = await get(`reports/dre?start=${YEAR}-01-01&end=${dec(31)}`);
        expect(dre.lines.netResult).toBe('600.00');
        expect(dre.totals).toEqual({ revenues: '1000.00', expenses: '400.00', result: '600.00' });
        const sheet = await get(`reports/balance-sheet?date=${dec(31)}`);
        expect(sheet.equity).toMatchObject({ accumulatedResult: '0.00', total: '600.00' });
        expect(sheet.assets.total).toBe('600.00');
        expect(sheet.assets.total).toBe(sheet.liabilitiesAndEquity);
        const trial = await get(`reports/trial-balance?start=${dec(1)}&end=${dec(31)}`);
        expect(trial.totals.debits).toBe(trial.totals.credits);
        const revenue = trial.lines.find((line: { code: string }) => line.code === '3.1');
        expect(revenue.closingBalance).toEqual({ amount: '0.00', side: 'D' });
    });

    it('invariante 7 (a linha de lucros = o resultado do DRE) e as invariantes do bloco 4 antes da apuração', async () => {
        await profitYear();
        const closing = (await closeYear().expect(201)).body;
        const entry = await get(`journal-entries/${closing.closingEntryId}`);
        const dre = await get(`reports/dre?start=${YEAR}-01-01&end=${dec(31)}`);
        const retainedLine = entry.lines.find(
            (line: { accountId: string }) => line.accountId === retained,
        );
        expect(retainedLine.credit).toBe(dre.lines.netResult);
        await expectReportsReconciled(api, headers, dec(1), dec(30));
    });

    it('prejuízo: debita os lucros acumulados', async () => {
        await manual(dec(10), a().bank, a().revenue, '100.00').expect(201);
        await manual(dec(15), a().expense, a().bank, '400.00').expect(201);
        const res = await closeYear().expect(201);
        const entry = await get(`journal-entries/${res.body.closingEntryId}`);
        expect(
            entry.lines.map((l: { accountCode: string; debit: string; credit: string }) => [
                l.accountCode,
                l.debit,
                l.credit,
            ]),
        ).toEqual([
            ['3.1', '100.00', '0.00'],
            ['5.2', '300.00', '0.00'],
            ['4.1', '0.00', '400.00'],
        ]);
        expect((await get(`reports/dre?start=${YEAR}-01-01&end=${dec(31)}`)).lines.netResult).toBe(
            '-300.00',
        );
        expect((await get(`reports/balance-sheet?date=${dec(31)}`)).equity.accounts.total).toBe(
            '-300.00',
        );
    });

    it('ano sem resultado fecha sem lançamento de apuração', async () => {
        await manual(dec(10), a().bank, a().capital, '100.00').expect(201);
        const res = await closeYear().expect(201);
        expect(res.body.closingEntryId).toBeNull();
        expect(await db().journalEntry.count({ where: { referenceType: 'CLOSING' } })).toBe(0);
    });

    it('400 RETAINED_EARNINGS_ACCOUNT_INVALID sem a conta, com conta de ativo ou sintética; nada é gravado', async () => {
        await profitYear();
        for (const body of [
            { retainedEarningsAccountId: undefined },
            { retainedEarningsAccountId: a().bank },
            { retainedEarningsAccountId: a().equityRoot },
        ]) {
            const res = await closeYear(body);
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('RETAINED_EARNINGS_ACCOUNT_INVALID');
        }
        expect(await db().periodClosing.count()).toBe(0);
        expect(await db().journalEntry.count({ where: { referenceType: 'CLOSING' } })).toBe(0);
    });
});

describe('reabertura', () => {
    it('estorna a apuração em 31/12, devolve os valores do ano e libera novos lançamentos', async () => {
        await profitYear();
        await closeYear().expect(201);
        expect((await manual(dec(20), a().bank, a().revenue, '50.00')).status).toBe(409);

        await api().delete('/api/v1/period-closings/latest').set(headers).expect(204);
        const list = await get('period-closings');
        expect(list).toEqual({ closedThrough: null, items: [] });
        const reversal = await db().journalEntry.findFirstOrThrow({
            where: { referenceType: 'CLOSING_REVERSAL' },
            include: { lines: true },
        });
        expect(reversal.date.toISOString().slice(0, 10)).toBe(dec(31));
        expect(reversal.lines).toHaveLength(3);
        const sheet = await get(`reports/balance-sheet?date=${dec(31)}`);
        expect(sheet.equity).toMatchObject({ accumulatedResult: '600.00' });
        expect(sheet.equity.accounts.total).toBe('0.00');
        expect((await get(`reports/dre?start=${YEAR}-01-01&end=${dec(31)}`)).lines.netResult).toBe(
            '600.00',
        );
    });

    it('depois de reabrir, novo lançamento entra e o fechamento seguinte apura o ano atualizado', async () => {
        await profitYear();
        await closeYear().expect(201);
        await api().delete('/api/v1/period-closings/latest').set(headers).expect(204);
        await manual(dec(20), a().bank, a().revenue, '50.00').expect(201);
        const again = await closeYear().expect(201);
        const entry = await get(`journal-entries/${again.body.closingEntryId}`);
        expect(
            entry.lines.find((line: { accountId: string }) => line.accountId === retained).credit,
        ).toBe('650.00');
        expect((await get(`reports/dre?start=${YEAR}-01-01&end=${dec(31)}`)).lines.netResult).toBe(
            '650.00',
        );
    });

    it('sem fechamento responde 404 PERIOD_CLOSING_NOT_FOUND', async () => {
        const res = await api().delete('/api/v1/period-closings/latest').set(headers);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('PERIOD_CLOSING_NOT_FOUND');
    });
});
