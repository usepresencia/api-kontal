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
const assetRoot = async () =>
    (
        await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: seed.plan.id, code: '1' },
        })
    ).id;

describe('GET /reports/daily-journal', () => {
    it('pagina os dias com movimento em ordem crescente, com lançamentos numerados e dias fechados', async () => {
        const base = `reports/daily-journal?start=${isoDay(-30)}&end=${isoDay(0)}&pageSize=2`;
        const first = await get(`${base}&page=1`);
        expect(first).toMatchObject({ page: 1, pageSize: 2, total: 7 });
        expect(first.items.map((day: { date: string }) => day.date)).toEqual([
            isoDay(-30),
            isoDay(-10),
        ]);
        expect(first.items[0]).toMatchObject({ totalDebits: '5000.00', totalCredits: '5000.00' });
        expect(first.items[0].entries[0]).toMatchObject({
            referenceType: 'MANUAL',
            description: 'Aporte de capital',
        });
        const numbers: number[] = [];
        for (let page = 1; page <= 4; page++) {
            for (const day of (await get(`${base}&page=${page}`)).items) {
                expect(day.totalDebits).toBe(day.totalCredits);
                numbers.push(...day.entries.map((entry: { number: number }) => entry.number));
            }
        }
        expect(numbers).toHaveLength(7);
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    });

    it('pageSize acima de 31 é recusado', async () => {
        await api()
            .get(`/api/v1/reports/daily-journal?start=${isoDay(-1)}&end=${isoDay(0)}&pageSize=32`)
            .set(headers)
            .expect(400);
    });
});

describe('GET /reports/account-ledger', () => {
    const period = `start=${isoDay(-15)}&end=${isoDay(0)}`;

    it('conta analítica por lançamento: saldo anterior, saldo após cada lançamento e contrapartidas', async () => {
        const body = await get(`reports/account-ledger?accountId=${seed.accounts.bank}&${period}`);
        expect(body).toMatchObject({
            account: { id: seed.accounts.bank, code: '1.1' },
            openingBalance: { amount: '5000.00', side: 'D' },
            closingBalance: { amount: '5315.00', side: 'D' },
            total: 2,
        });
        expect(
            body.items.map((item: { debit: string; credit: string; balance: unknown }) => [
                item.debit,
                item.credit,
                item.balance,
            ]),
        ).toEqual([
            ['615.00', '0.00', { amount: '5615.00', side: 'D' }],
            ['0.00', '300.00', { amount: '5315.00', side: 'D' }],
        ]);
        expect(body.items[0].counterparts.map((c: { code: string }) => c.code)).toEqual([
            '1.2',
            '3.2',
            '4.2',
        ]);
        expect(body.items[0].journalEntryId).toBeDefined();
    });

    it('a paginação não altera o saldo acumulado (janela calculada antes do LIMIT)', async () => {
        const body = await get(
            `reports/account-ledger?accountId=${seed.accounts.bank}&${period}&pageSize=1&page=2`,
        );
        expect(body.items).toHaveLength(1);
        expect(body.items[0].balance).toEqual({ amount: '5315.00', side: 'D' });
    });

    it('groupBy=day devolve o saldo ao fim de cada dia', async () => {
        const body = await get(
            `reports/account-ledger?accountId=${seed.accounts.bank}&${period}&groupBy=day`,
        );
        expect(body.days).toEqual([
            {
                date: isoDay(-5),
                debits: '615.00',
                credits: '0.00',
                balance: { amount: '5615.00', side: 'D' },
            },
            {
                date: isoDay(-2),
                debits: '0.00',
                credits: '300.00',
                balance: { amount: '5315.00', side: 'D' },
            },
        ]);
    });

    it('conta sintética soma as descendentes', async () => {
        const body = await get(`reports/account-ledger?accountId=${await assetRoot()}&${period}`);
        expect(body).toMatchObject({
            openingBalance: { amount: '5000.00', side: 'D' },
            closingBalance: { amount: '5715.00', side: 'D' },
            total: 5,
        });
        const payment = body.items.find((item: { debit: string }) => item.debit === '615.00');
        expect(payment).toMatchObject({
            credit: '600.00',
            balance: { amount: '6215.00', side: 'D' },
        });
    });

    it('conta de outra empresa: 404 BILLING_ACCOUNT_NOT_FOUND', async () => {
        const other = await seedReportLedger(db(), { name: 'Outra' });
        const res = await api()
            .get(`/api/v1/reports/account-ledger?accountId=${other.accounts.bank}&${period}`)
            .set(headers);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('BILLING_ACCOUNT_NOT_FOUND');
    });
});

describe('GET /journal-entries', () => {
    it('lista do mais recente ao mais antigo, com filtros por tipo, conta e período', async () => {
        const all = await get('journal-entries?pageSize=100');
        expect(all.total).toBe(7);
        expect(all.items[0]).toMatchObject({ date: isoDay(0), referenceType: 'SETTLEMENT' });
        expect((await get('journal-entries?referenceType=SETTLEMENT')).total).toBe(3);
        expect((await get(`journal-entries?accountId=${seed.accounts.bank}`)).total).toBe(3);
        expect((await get(`journal-entries?from=${isoDay(-8)}&to=${isoDay(-5)}`)).total).toBe(3);
        const manual = await get('journal-entries?referenceType=MANUAL');
        expect(
            manual.items[0].lines.map(
                (l: { accountCode: string; debit: string; credit: string }) => [
                    l.accountCode,
                    l.debit,
                    l.credit,
                ],
            ),
        ).toEqual([
            ['1.1', '5000.00', '0.00'],
            ['5.1', '0.00', '5000.00'],
        ]);
    });

    it('GET /:id devolve o lançamento; inexistente ou de outra empresa: 404 JOURNAL_ENTRY_NOT_FOUND', async () => {
        const one = await get(`journal-entries/${scenario.manual.id}`);
        expect(one).toMatchObject({
            id: scenario.manual.id,
            number: scenario.manual.number,
            reversedBy: null,
        });
        const missing = await api().get(`/api/v1/journal-entries/${randomUUID()}`).set(headers);
        expect(missing.status).toBe(404);
        expect(missing.body.code).toBe('JOURNAL_ENTRY_NOT_FOUND');
    });

    it('período invertido: 400 DATE_RANGE_INVALID', async () => {
        const res = await api()
            .get(`/api/v1/journal-entries?from=${isoDay(0)}&to=${isoDay(-1)}`)
            .set(headers);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DATE_RANGE_INVALID');
    });
});
