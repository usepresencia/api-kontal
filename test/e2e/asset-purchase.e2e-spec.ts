import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { createAccountFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';
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
let imob: string;
let assetRootId: string;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
    const root = await db().billingAccount.findFirstOrThrow({
        where: { billingPlanId: seed.plan.id, code: '1' },
    });
    assetRootId = root.id;
    imob = (
        await createAccountFixture(db(), {
            billingPlanId: seed.plan.id,
            parentId: root.id,
            code: '1.3',
            level: 2,
            nature: 'ASSET',
            accountType: 'ANALYTIC',
            name: 'Imobilizado',
            balanceCategory: 'NON_CURRENT_ASSET',
        })
    ).id;
});

const purchase = (overrides: Record<string, unknown> = {}) =>
    api()
        .post('/api/v1/titles')
        .set(headers)
        .send(
            titleBody(seed.preset.id, {
                type: 'EXPENSE',
                description: 'Máquina',
                amount: '5000.00',
                issueDate: isoDay(-3),
                destinationAccountId: imob,
                ...overrides,
            }),
        );
const get = async (path: string) =>
    (await api().get(`/api/v1/${path}`).set(headers).expect(200)).body;

describe('compra de ativo: título a pagar com conta de destino', () => {
    it('lança D ativo / C a pagar e guarda o destino como conta de resultado', async () => {
        const res = await purchase();
        expect(res.status).toBe(201);
        expect(res.body.resultAccountId).toBe(imob);
        const journal = await journalOf(db(), 'TITLE_CREATION', res.body.id);
        expect(journal).toMatchObject({ date: isoDay(-3), total: '5000.00' });
        expect(journal.lines).toEqual(
            sorted([d(imob, '5000.00'), c(seed.accounts.payable, '5000.00')]),
        );
    });

    it('o DRE não muda e o balanço mostra o ativo no não circulante, fechando com o passivo', async () => {
        await purchase();
        const range = `start=${isoDay(-30)}&end=${isoDay(0)}`;
        expect((await get(`reports/dre?${range}`)).totals).toEqual({
            revenues: '0.00',
            expenses: '0.00',
            result: '0.00',
        });
        const sheet = await get(`reports/balance-sheet?date=${isoDay(0)}`);
        expect(sheet.assets.nonCurrent.total).toBe('5000.00');
        expect(sheet.assets.nonCurrent.tree[0]).toMatchObject({ code: '1.3', amount: '5000.00' });
        expect(sheet.liabilities.current.total).toBe('5000.00');
        expect(sheet.assets.total).toBe(sheet.liabilitiesAndEquity);
    });

    it('a baixa e o cancelamento funcionam como em qualquer título e o controle fecha', async () => {
        const paid = (await purchase()).body;
        await api()
            .post(`/api/v1/titles/${paid.id}/entries`)
            .set(headers)
            .send({
                billingAccountId: seed.accounts.bank,
                principalAmount: '5000.00',
                paidAt: isoDay(-1),
                paymentMethod: 'PIX',
            })
            .expect(201);
        const unpaid = (await purchase({ description: 'Outra máquina', amount: '800.00' })).body;
        await api().delete(`/api/v1/titles/${unpaid.id}`).set(headers).expect(204);
        const cancel = await journalOf(db(), 'TITLE_CANCELLATION', unpaid.id);
        expect(cancel.date).toBe(isoDay(0));
        expect(cancel.lines).toEqual(
            sorted([c(imob, '800.00'), d(seed.accounts.payable, '800.00')]),
        );
        await expectLedgerReconciled(db(), seed.company.id);
    });

    it('sem destino o título segue usando a conta de despesa do preset', async () => {
        const res = await api()
            .post('/api/v1/titles')
            .set(headers)
            .send(titleBody(seed.preset.id, { type: 'EXPENSE', issueDate: isoDay(-3) }));
        expect(res.status).toBe(201);
        expect(res.body.resultAccountId).toBe(seed.accounts.expense);
    });

    it.each([
        ['título a receber', (): Record<string, unknown> => ({ type: 'INCOME' })],
        [
            'conta a receber (controle)',
            (): Record<string, unknown> => ({ destinationAccountId: seed.accounts.receivable }),
        ],
        [
            'conta a pagar (controle)',
            (): Record<string, unknown> => ({ destinationAccountId: seed.accounts.payable }),
        ],
        [
            'conta de receita',
            (): Record<string, unknown> => ({ destinationAccountId: seed.accounts.revenue }),
        ],
        ['conta sintética', (): Record<string, unknown> => ({ destinationAccountId: assetRootId })],
    ])('400 DESTINATION_ACCOUNT_INVALID para %s, sem criar o título', async (_label, overrides) => {
        const before = await db().title.count();
        const res = await purchase(overrides());
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DESTINATION_ACCOUNT_INVALID');
        expect(await db().title.count()).toBe(before);
    });

    it('400 para conta inativa, de outro plano e de outra empresa', async () => {
        const root = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: seed.plan.id, code: '1' },
        });
        const inactive = await createAccountFixture(db(), {
            billingPlanId: seed.plan.id,
            parentId: root.id,
            code: '1.4',
            level: 2,
            nature: 'ASSET',
            accountType: 'ANALYTIC',
        });
        await db().billingAccount.update({ where: { id: inactive.id }, data: { isActive: false } });
        const otherPlan = await createPlanFixture(db(), seed.company.id);
        const otherPlanAccount = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            code: '1',
            level: 1,
            nature: 'ASSET',
            accountType: 'ANALYTIC',
        });
        const other = await seedReportLedger(db(), { name: 'Outra' });
        for (const id of [inactive.id, otherPlanAccount.id, other.accounts.bank]) {
            const res = await purchase({ destinationAccountId: id });
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('DESTINATION_ACCOUNT_INVALID');
        }
    });
});

describe('compra de ativo parcelada e recorrente', () => {
    it('as parcelas usam o destino como conta de resultado e cada uma lança D ativo', async () => {
        await api()
            .post('/api/v1/title-series')
            .set(headers)
            .send({
                kind: 'INSTALLMENT',
                presetId: seed.preset.id,
                type: 'EXPENSE',
                description: 'Máquina parcelada',
                amount: '3000.00',
                issueDate: isoDay(-3),
                expirationDate: isoDay(30),
                count: 3,
                destinationAccountId: imob,
            })
            .expect(201);
        const titles = await db().title.findMany({
            where: { companyId: seed.company.id, seriesId: { not: null } },
        });
        expect(titles).toHaveLength(3);
        expect(titles.every(title => title.resultAccountId === imob)).toBe(true);
        for (const title of titles) {
            const journal = await journalOf(db(), 'TITLE_CREATION', title.id);
            expect(journal.lines).toEqual(
                sorted([d(imob, '1000.00'), c(seed.accounts.payable, '1000.00')]),
            );
        }
    });

    it('a extensão da série recorrente mantém o destino', async () => {
        await api()
            .post('/api/v1/title-series')
            .set(headers)
            .send({
                kind: 'RECURRING',
                presetId: seed.preset.id,
                type: 'EXPENSE',
                description: 'Leasing',
                amount: '100.00',
                issueDate: isoDay(-3),
                expirationDate: isoDay(30),
                count: 2,
                destinationAccountId: imob,
            })
            .expect(201);
        const series = await db().titleSeries.findFirstOrThrow({
            where: { companyId: seed.company.id },
        });
        await api()
            .post(`/api/v1/title-series/${series.id}/extend`)
            .set(headers)
            .send({ count: 1 })
            .expect(201);
        const titles = await db().title.findMany({ where: { seriesId: series.id } });
        expect(titles).toHaveLength(3);
        expect(titles.every(title => title.resultAccountId === imob)).toBe(true);
    });

    it('destino em série a receber é recusado sem gravar nada', async () => {
        const res = await api()
            .post('/api/v1/title-series')
            .set(headers)
            .send({
                kind: 'INSTALLMENT',
                presetId: seed.preset.id,
                type: 'INCOME',
                description: 'Venda',
                amount: '30.00',
                expirationDate: isoDay(30),
                count: 2,
                destinationAccountId: imob,
            });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('DESTINATION_ACCOUNT_INVALID');
        expect(await db().titleSeries.count()).toBe(0);
    });
});
