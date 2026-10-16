import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { createAccountFixture } from '@test/e2e/support/fixtures.js';
import {
    c,
    d,
    expectLedgerReconciled,
    journalOf,
    sorted,
    titleBody,
} from '@test/e2e/support/ledger-fixtures.js';
import {
    asTenant,
    type ReportLedger,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
let seed: ReportLedger;
let headers: Record<string, string>;
let opening: string;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    opening = (
        await createAccountFixture(db(), {
            billingPlanId: seed.plan.id,
            parentId: seed.accounts.equityRoot,
            code: '5.2',
            level: 2,
            nature: 'EQUITY',
            accountType: 'ANALYTIC',
            name: 'Saldos iniciais',
        })
    ).id;
    await db().presetAccount.create({
        data: { presetId: seed.preset.id, role: 'openingBalance', accountId: opening },
    });
});

const openingTitle = (overrides: Record<string, unknown> = {}) =>
    api()
        .post('/api/v1/titles')
        .set(headers)
        .send(
            titleBody(seed, {
                description: 'Cliente antigo',
                amount: '1000.00',
                issueDate: isoDay(-90),
                expirationDate: isoDay(10),
                isOpening: true,
                openingDate: isoDay(-20),
                settledAmount: '400.00',
                ...overrides,
            }),
        );
const get = async (path: string) =>
    (await api().get(`/api/v1/${path}`).set(headers).expect(200)).body;

describe('implantação de títulos em aberto', () => {
    it('receita: lança D a receber / C saldos iniciais só pelo saldo em aberto, na data de implantação', async () => {
        const res = await openingTitle();
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            isOpening: true,
            openingDate: isoDay(-20),
            issueDate: isoDay(-90),
            amount: '1000.00',
            settledAmount: '400.00',
            remainingAmount: '600.00',
            status: 'OPEN',
            resultAccountId: opening,
        });
        const journal = await journalOf(db(), 'TITLE_CREATION', res.body.id);
        expect(journal).toMatchObject({ date: isoDay(-20), total: '600.00' });
        expect(journal.lines).toEqual(
            sorted([d(seed.accounts.receivable, '600.00'), c(opening, '600.00')]),
        );
    });

    it('despesa: lança D saldos iniciais / C a pagar', async () => {
        const res = await openingTitle({
            type: 'EXPENSE',
            description: 'Fornecedor antigo',
            amount: '300.00',
            settledAmount: undefined,
        });
        expect(res.status).toBe(201);
        const journal = await journalOf(db(), 'TITLE_CREATION', res.body.id);
        expect(journal.lines).toEqual(
            sorted([d(opening, '300.00'), c(seed.accounts.payable, '300.00')]),
        );
    });

    it('o DRE não muda; o balanço fecha com o patrimônio líquido; o controle bate com os títulos', async () => {
        await openingTitle();
        await openingTitle({
            type: 'EXPENSE',
            description: 'Fornecedor antigo',
            amount: '300.00',
            settledAmount: undefined,
        });
        expect(
            (await get(`reports/dre?start=${isoDay(-60)}&end=${isoDay(0)}`)).lines.netResult,
        ).toBe('0.00');
        const sheet = await get(`reports/balance-sheet?date=${isoDay(0)}`);
        expect(sheet.assets.total).toBe('600.00');
        expect(sheet.liabilities.total).toBe('300.00');
        expect(sheet.equity).toMatchObject({ accumulatedResult: '0.00', total: '300.00' });
        expect(sheet.liabilitiesAndEquity).toBe('600.00');
        await expectLedgerReconciled(db(), seed.company.id);
    });

    it('baixa antes da implantação é recusada; na data de implantação é aceita e o controle continua batendo', async () => {
        const title = (await openingTitle()).body;
        const pay = (paidAt: string) =>
            api().post(`/api/v1/titles/${title.id}/entries`).set(headers).send({
                billingAccountId: seed.accounts.bank,
                principalAmount: '100.00',
                paidAt,
                paymentMethod: 'PIX',
            });
        const early = await pay(isoDay(-21));
        expect(early.status).toBe(400);
        expect(early.body.code).toBe('ENTRY_DATE_INVALID');
        expect((await pay(isoDay(-20))).status).toBe(201);
        expect((await get(`titles/${title.id}`)).remainingAmount).toBe('500.00');
        await expectLedgerReconciled(db(), seed.company.id);
    });

    it.each([
        ['isOpening sem data', (): Record<string, unknown> => ({ openingDate: undefined })],
        ['data sem isOpening', (): Record<string, unknown> => ({ isOpening: undefined })],
        [
            'valor já pago igual ao valor',
            (): Record<string, unknown> => ({ settledAmount: '1000.00' }),
        ],
        ['data de implantação futura', (): Record<string, unknown> => ({ openingDate: isoDay(1) })],
        [
            'emissão depois da implantação',
            (): Record<string, unknown> => ({ issueDate: isoDay(-10) }),
        ],
    ])('400 OPENING_TITLE_INVALID para %s, sem criar o título', async (_label, overrides) => {
        const before = await db().title.count();
        const res = await openingTitle(overrides());
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('OPENING_TITLE_INVALID');
        expect(await db().title.count()).toBe(before);
    });

    it('preset sem a conta de saldos iniciais responde TITLE_NOT_POSTABLE; destino junto responde DESTINATION_ACCOUNT_INVALID', async () => {
        const destination = await openingTitle({
            type: 'EXPENSE',
            destinationAccountId: seed.accounts.expense,
        });
        expect(destination.status).toBe(400);
        expect(destination.body.code).toBe('DESTINATION_ACCOUNT_INVALID');
        await db().presetAccount.deleteMany({
            where: { presetId: seed.preset.id, role: 'openingBalance' },
        });
        const res = await openingTitle();
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('TITLE_NOT_POSTABLE');
        expect(await db().title.count()).toBe(0);
    });

    it('excluir o título de implantação estorna o lançamento e zera o controle', async () => {
        const title = (await openingTitle()).body;
        await api().delete(`/api/v1/titles/${title.id}`).set(headers).expect(204);
        const cancel = await journalOf(db(), 'TITLE_CANCELLATION', title.id);
        expect(cancel.date).toBe(isoDay(0));
        expect(cancel.lines).toEqual(
            sorted([d(opening, '600.00'), c(seed.accounts.receivable, '600.00')]),
        );
        await expectLedgerReconciled(db(), seed.company.id);
    });

    it('título comum segue sem implantação', async () => {
        const res = await api().post('/api/v1/titles').set(headers).send(titleBody(seed));
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ isOpening: false, openingDate: null });
    });
});
