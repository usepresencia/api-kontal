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
import { createAccountFixture } from '@test/e2e/support/fixtures.js';

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
    api()
        .post(`/api/v1/titles/${titleId}/entries`)
        .set(await asAdmin(companyId))
        .send({
            billingAccountId: a.bank,
            principalAmount: '300.00',
            paidAt: isoDay(-5),
            paymentMethod: 'PIX',
            ...overrides,
        });
const getTitle = async (id: string) =>
    (
        await api()
            .get(`/api/v1/titles/${id}`)
            .set(await asAdmin(companyId))
            .expect(200)
    ).body;

describe('pagamento simples e parcial (receita)', () => {
    it('baixa parcial: D conta da baixa / C a receber, abate o saldo e mantém em aberto', async () => {
        const title = await createTitle();
        const res = await pay(title.id);
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            kind: 'PAYMENT',
            principalAmount: '300.00',
            totalAmount: '300.00',
            billingAccountName: 'Banco',
            titleDescription: 'Venda',
            paidAt: isoDay(-5),
        });
        const journal = await journalOf(db(), 'SETTLEMENT', res.body.id);
        expect(journal).toMatchObject({ date: isoDay(-5), total: '300.00' });
        expect(journal.lines).toEqual(sorted([d(a.bank, '300.00'), c(a.receivable, '300.00')]));
        expect(await getTitle(title.id)).toMatchObject({
            status: 'OPEN',
            settledAmount: '300.00',
            remainingAmount: '700.00',
        });
        await expectLedgerReconciled(db(), companyId);
    });

    it('baixas que somam o valor quitam o título; mais que o saldo ou em título quitado é recusado', async () => {
        const title = await createTitle();
        await pay(title.id, { principalAmount: '300.00' });
        const over = await pay(title.id, { principalAmount: '700.01' });
        expect(over.status).toBe(409);
        expect(over.body).toMatchObject({ code: 'ENTRY_EXCEEDS_BALANCE' });
        await pay(title.id, { principalAmount: '700.00' }).then(res =>
            expect(res.status).toBe(201),
        );
        expect(await getTitle(title.id)).toMatchObject({
            status: 'SETTLED',
            remainingAmount: '0.00',
        });
        const closed = await pay(title.id, { principalAmount: '0.01' });
        expect(closed.status).toBe(409);
        expect(closed.body).toMatchObject({ code: 'TITLE_NOT_OPEN' });
        await expectLedgerReconciled(db(), companyId);
    });
});

describe('pagamento com juros, multa e desconto', () => {
    it('receita: D conta da baixa (total) e desconto concedido / C a receber (principal) e juros recebidos', async () => {
        const title = await createTitle();
        const res = await pay(title.id, {
            principalAmount: '1000.00',
            interestAmount: '50.00',
            fineAmount: '20.00',
            discountAmount: '30.00',
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            totalAmount: '1040.00',
            interestAmount: '50.00',
            fineAmount: '20.00',
            discountAmount: '30.00',
        });
        const journal = await journalOf(db(), 'SETTLEMENT', res.body.id);
        expect(journal.total).toBe('1070.00');
        expect(journal.lines).toEqual(
            sorted([
                d(a.bank, '1040.00'),
                d(a.discountGranted, '30.00'),
                c(a.receivable, '1000.00'),
                c(a.interestIncome, '70.00'),
            ]),
        );
        expect(await getTitle(title.id)).toMatchObject({
            status: 'SETTLED',
            settledAmount: '1000.00',
        });
        await expectLedgerReconciled(db(), companyId);
    });

    it('despesa: D a pagar (principal) e juros pagos / C conta da baixa (total) e desconto obtido', async () => {
        const title = await createTitle({ type: 'EXPENSE', description: 'Fornecedor' });
        const res = await pay(title.id, {
            principalAmount: '1000.00',
            interestAmount: '50.00',
            fineAmount: '20.00',
            discountAmount: '30.00',
        });
        expect(res.status).toBe(201);
        const journal = await journalOf(db(), 'SETTLEMENT', res.body.id);
        expect(journal.lines).toEqual(
            sorted([
                d(a.payable, '1000.00'),
                d(a.interestExpense, '70.00'),
                c(a.bank, '1040.00'),
                c(a.discountObtained, '30.00'),
            ]),
        );
        await expectLedgerReconciled(db(), companyId);
    });

    it('juros sem a conta de juros no preset responde 400 SETTLEMENT_NOT_POSTABLE e nada é gravado', async () => {
        const preset = await db().preset.create({
            data: {
                billingPlanId: seed.plan.id,
                name: 'Sem encargos',
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
        const res = await pay(title.id, { interestAmount: '10.00' });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'SETTLEMENT_NOT_POSTABLE' });
        expect(await db().entry.count()).toBe(0);
        expect((await getTitle(title.id)).settledAmount).toBe('0.00');
    });
});

describe('validações da baixa', () => {
    it.each([
        ['data futura', { paidAt: isoDay(1) }, 'ENTRY_DATE_INVALID'],
        ['data anterior à emissão', { paidAt: isoDay(-11) }, 'ENTRY_DATE_INVALID'],
        ['desconto acima do principal', { discountAmount: '300.01' }, 'ENTRY_AMOUNT_INVALID'],
        ['principal zero', { principalAmount: '0.00' }, 'ENTRY_AMOUNT_INVALID'],
    ])('400 %s', async (_label, overrides, code) => {
        const title = await createTitle();
        const res = await pay(title.id, overrides);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code });
        expect(await db().entry.count()).toBe(0);
    });

    it('400 de validação para valor com 3 casas, forma de pagamento e data inválidas', async () => {
        const title = await createTitle();
        for (const overrides of [
            { principalAmount: '10.123' },
            { paymentMethod: 'BOLETO' },
            { paidAt: '10/10/2026' },
            { interestAmount: 5 },
        ]) {
            expect((await pay(title.id, overrides)).status).toBe(400);
        }
    });

    it('400 ENTRY_ACCOUNT_INVALID para conta sintética, de receita, de outro plano e a própria conta de controle', async () => {
        const title = await createTitle();
        const synthetic = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: seed.plan.id, code: '1' },
        });
        const otherPlan = await db().billingPlan.create({ data: { companyId, name: 'Outro' } });
        const foreignRoot = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            code: '1',
            level: 1,
        });
        const foreign = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            parentId: foreignRoot.id,
            code: '1.1',
            level: 2,
            accountType: 'ANALYTIC',
        });
        for (const billingAccountId of [synthetic.id, a.revenue, foreign.id, a.receivable]) {
            const res = await pay(title.id, { billingAccountId });
            expect(res.status).toBe(400);
            expect(res.body).toMatchObject({ code: 'ENTRY_ACCOUNT_INVALID' });
        }
        expect(await db().entry.count()).toBe(0);
    });
});

describe('editar o preset depois de criar o título', () => {
    it('a baixa usa as contas gravadas no título, não as atuais do preset, e o razão continua fechando', async () => {
        const title = await createTitle();
        const newReceivable = await createAccountFixture(db(), {
            billingPlanId: seed.plan.id,
            parentId: (
                await db().billingAccount.findFirstOrThrow({
                    where: { billingPlanId: seed.plan.id, code: '1' },
                })
            ).id,
            code: '1.9',
            level: 2,
            nature: 'ASSET',
            accountType: 'ANALYTIC',
        });
        await api()
            .put(`/api/v1/presets/${seed.preset.id}`)
            .set(await asAdmin(companyId))
            .send({
                name: 'Preset editado',
                accounts: {
                    receivable: newReceivable.id,
                    payable: a.payable,
                    revenue: a.revenue,
                    expense: a.expense,
                    interestIncome: a.interestIncome,
                    discountGranted: a.discountGranted,
                    badDebt: a.badDebt,
                    interestExpense: a.interestExpense,
                    discountObtained: a.discountObtained,
                    debtForgiveness: a.debtForgiveness,
                },
            })
            .expect(200);
        const res = await pay(title.id, { principalAmount: '1000.00' });
        expect(res.status).toBe(201);
        const journal = await journalOf(db(), 'SETTLEMENT', res.body.id);
        expect(journal.lines).toEqual(sorted([d(a.bank, '1000.00'), c(a.receivable, '1000.00')]));
        expect(await db().journalLine.count({ where: { accountId: newReceivable.id } })).toBe(0);
        await expectLedgerReconciled(db(), companyId);
    });
});

describe('PUT /entries/:id e leitura', () => {
    it('altera só descrição e forma de pagamento; valores e data enviados são ignorados', async () => {
        const title = await createTitle();
        const entry = (await pay(title.id)).body;
        const res = await api()
            .put(`/api/v1/entries/${entry.id}`)
            .set(await asAdmin(companyId))
            .send({
                description: 'Recebido',
                paymentMethod: 'CASH',
                principalAmount: '1.00',
                paidAt: isoDay(-1),
            })
            .expect(200);
        expect(res.body).toMatchObject({
            description: 'Recebido',
            paymentMethod: 'CASH',
            principalAmount: '300.00',
            paidAt: isoDay(-5),
        });
        await api()
            .put(`/api/v1/entries/${entry.id}`)
            .set(await asAdmin(companyId))
            .send({})
            .expect(400);
    });

    it('lista paginada por data decrescente, geral e por título', async () => {
        const title = await createTitle();
        await pay(title.id, { principalAmount: '100.00', paidAt: isoDay(-8) });
        await pay(title.id, { principalAmount: '100.00', paidAt: isoDay(-3) });
        const all = await api()
            .get('/api/v1/entries')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(all.body.items.map((e: { paidAt: string }) => e.paidAt)).toEqual([
            isoDay(-3),
            isoDay(-8),
        ]);
        const byTitle = await api()
            .get(`/api/v1/titles/${title.id}/entries?pageSize=1`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(byTitle.body).toMatchObject({ pageSize: 1, total: 2 });
        const filtered = await api()
            .get(`/api/v1/entries?titleId=${title.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(filtered.body.total).toBe(2);
        const one = await api()
            .get(`/api/v1/entries/${all.body.items[0].id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(one.body.titleDescription).toBe('Venda');
        await api()
            .get('/api/v1/entries/abc')
            .set(await asAdmin(companyId))
            .expect(400);
        const missing = await api()
            .get('/api/v1/entries/3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f')
            .set(await asAdmin(companyId))
            .expect(404);
        expect(missing.body).toMatchObject({ code: 'ENTRY_NOT_FOUND' });
    });
});
