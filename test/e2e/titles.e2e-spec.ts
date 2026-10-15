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

const create = async (overrides: Record<string, unknown> = {}) =>
    api()
        .post('/api/v1/titles')
        .set(await asAdmin(companyId))
        .send(titleBody(seed.preset.id, overrides));

describe('POST /titles', () => {
    it('receita: grava o título com as contas do preset e o lançamento D a receber / C receita', async () => {
        const res = await create();
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            type: 'INCOME',
            status: 'OPEN',
            amount: '1000.00',
            settledAmount: '0.00',
            remainingAmount: '1000.00',
            presetName: 'Preset completo',
            controlAccountId: a.receivable,
            resultAccountId: a.revenue,
            issueDate: isoDay(-10),
            expirationDate: isoDay(20),
        });
        const journal = await journalOf(db(), 'TITLE_CREATION', res.body.id);
        expect(journal).toMatchObject({ date: isoDay(-10), total: '1000.00' });
        expect(journal.lines).toEqual(
            sorted([d(a.receivable, '1000.00'), c(a.revenue, '1000.00')]),
        );
        await expectLedgerReconciled(db(), companyId);
    });

    it('despesa: D despesa / C a pagar', async () => {
        const res = await create({ type: 'EXPENSE', description: 'Aluguel' });
        expect(res.status).toBe(201);
        const journal = await journalOf(db(), 'TITLE_CREATION', res.body.id);
        expect(journal.lines).toEqual(sorted([d(a.expense, '1000.00'), c(a.payable, '1000.00')]));
        await expectLedgerReconciled(db(), companyId);
    });

    it('sem emissão informada usa hoje', async () => {
        const res = await create({ issueDate: undefined });
        expect(res.body.issueDate).toBe(isoDay(0));
        expect((await journalOf(db(), 'TITLE_CREATION', res.body.id)).date).toBe(isoDay(0));
    });

    it('400 para valor com mais de 2 casas, valor zero, tipo inválido e data inválida', async () => {
        for (const overrides of [
            { amount: '10.123' },
            { amount: '0.00' },
            { type: 'OUTRO' },
            { expirationDate: '01/11/2026' },
            { feesPercentageMonthly: 2 },
        ]) {
            const res = await create(overrides);
            expect(res.status).toBe(400);
        }
        expect(await db().title.count()).toBe(0);
        expect(await db().journalEntry.count()).toBe(0);
    });

    it('400 TITLE_NOT_POSTABLE quando o preset não tem a conta do tipo e nada é gravado', async () => {
        const preset = await db().preset.create({
            data: {
                billingPlanId: seed.plan.id,
                name: 'Sem receita',
                accounts: {
                    create: [
                        { role: 'receivable', accountId: a.receivable },
                        { role: 'payable', accountId: a.payable },
                        { role: 'expense', accountId: a.expense },
                    ],
                },
            },
        });
        const res = await api()
            .post('/api/v1/titles')
            .set(await asAdmin(companyId))
            .send(titleBody(preset.id));
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'TITLE_NOT_POSTABLE' });
        expect(await db().title.count()).toBe(0);
        expect(await db().journalEntry.count()).toBe(0);
    });

    it('400 PRESET_INACTIVE e 404 PRESET_NOT_FOUND', async () => {
        await db().preset.update({ where: { id: seed.preset.id }, data: { isActive: false } });
        const inactive = await create();
        expect(inactive.status).toBe(400);
        expect(inactive.body).toMatchObject({ code: 'PRESET_INACTIVE' });
        const missing = await api()
            .post('/api/v1/titles')
            .set(await asAdmin(companyId))
            .send(titleBody('3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f'));
        expect(missing.status).toBe(404);
        expect(missing.body).toMatchObject({ code: 'PRESET_NOT_FOUND' });
    });
});

describe('GET /titles', () => {
    it('lista paginada por vencimento com filtros', async () => {
        await create({ description: 'C', expirationDate: isoDay(30) });
        await create({ description: 'A', expirationDate: isoDay(10), type: 'EXPENSE' });
        await create({ description: 'B', expirationDate: isoDay(20) });
        const all = await api()
            .get('/api/v1/titles?pageSize=2')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(all.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
        expect(all.body.items.map((t: { description: string }) => t.description)).toEqual([
            'A',
            'B',
        ]);

        const income = await api()
            .get('/api/v1/titles?type=INCOME')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(income.body.total).toBe(2);
        const range = await api()
            .get(`/api/v1/titles?dueFrom=${isoDay(15)}&dueTo=${isoDay(25)}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(range.body.items.map((t: { description: string }) => t.description)).toEqual(['B']);
        const open = await api()
            .get('/api/v1/titles?status=SETTLED')
            .set(await asAdmin(companyId))
            .expect(200);
        expect(open.body.total).toBe(0);
        await api()
            .get('/api/v1/titles?pageSize=101')
            .set(await asAdmin(companyId))
            .expect(400);
        await api()
            .get('/api/v1/titles?type=X')
            .set(await asAdmin(companyId))
            .expect(400);
    });

    it('GET /:id devolve o título; 404 e 400 para id desconhecido e malformado', async () => {
        const created = await create();
        await api()
            .get(`/api/v1/titles/${created.body.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        const missing = await api()
            .get('/api/v1/titles/3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f')
            .set(await asAdmin(companyId))
            .expect(404);
        expect(missing.body).toMatchObject({ code: 'TITLE_NOT_FOUND' });
        await api()
            .get('/api/v1/titles/abc')
            .set(await asAdmin(companyId))
            .expect(400);
    });
});

describe('PUT /titles/:id', () => {
    it('altera descrição, vencimento e juros e não mexe no razão', async () => {
        const created = await create();
        const res = await api()
            .put(`/api/v1/titles/${created.body.id}`)
            .set(await asAdmin(companyId))
            .send({
                description: 'Venda corrigida',
                expirationDate: isoDay(40),
                feesPercentageMonthly: 0.05,
            })
            .expect(200);
        expect(res.body).toMatchObject({
            description: 'Venda corrigida',
            expirationDate: isoDay(40),
            feesPercentageMonthly: 0.05,
            amount: '1000.00',
        });
        expect(await db().journalEntry.count()).toBe(1);
    });

    it('aceita os campos travados quando iguais e responde 409 TITLE_FIELD_LOCKED quando mudam', async () => {
        const created = await create();
        await api()
            .put(`/api/v1/titles/${created.body.id}`)
            .set(await asAdmin(companyId))
            .send({
                description: 'x',
                type: 'INCOME',
                amount: '1000.00',
                presetId: seed.preset.id,
                issueDate: isoDay(-10),
            })
            .expect(200);
        for (const locked of [
            { amount: '999.99' },
            { type: 'EXPENSE' },
            { issueDate: isoDay(-9) },
        ]) {
            const res = await api()
                .put(`/api/v1/titles/${created.body.id}`)
                .set(await asAdmin(companyId))
                .send(locked)
                .expect(409);
            expect(res.body).toMatchObject({ code: 'TITLE_FIELD_LOCKED' });
        }
        expect(
            (await db().title.findUniqueOrThrow({ where: { id: created.body.id } })).amount.toFixed(
                2,
            ),
        ).toBe('1000.00');
    });
});

describe('DELETE /titles/:id', () => {
    it('exclui o título (204) e posta o estorno da criação, deixando o razão zerado', async () => {
        const created = await create();
        await api()
            .delete(`/api/v1/titles/${created.body.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        expect(await db().title.count()).toBe(0);
        const reversal = await journalOf(db(), 'TITLE_CANCELLATION', created.body.id);
        expect(reversal.date).toBe(isoDay(0));
        expect(reversal.lines).toEqual(
            sorted([c(a.receivable, '1000.00'), d(a.revenue, '1000.00')]),
        );
        expect(await db().journalEntry.count()).toBe(2);
        await expectLedgerReconciled(db(), companyId);
    });

    it('título com competência futura é estornado na data do lançamento original', async () => {
        const created = await create({ issueDate: isoDay(60), expirationDate: isoDay(90) });
        await api()
            .delete(`/api/v1/titles/${created.body.id}`)
            .set(await asAdmin(companyId))
            .expect(204);
        expect((await journalOf(db(), 'TITLE_CANCELLATION', created.body.id)).date).toBe(
            isoDay(60),
        );
    });

    it('409 TITLE_HAS_ENTRIES quando há baixa, 404 para desconhecido', async () => {
        const created = await create();
        await api()
            .post(`/api/v1/titles/${created.body.id}/entries`)
            .set(await asAdmin(companyId))
            .send({
                billingAccountId: a.bank,
                principalAmount: '100.00',
                paidAt: isoDay(-5),
                paymentMethod: 'PIX',
            })
            .expect(201);
        const blocked = await api()
            .delete(`/api/v1/titles/${created.body.id}`)
            .set(await asAdmin(companyId))
            .expect(409);
        expect(blocked.body).toMatchObject({ code: 'TITLE_HAS_ENTRIES' });
        expect(await db().title.count()).toBe(1);
        await api()
            .delete('/api/v1/titles/3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f')
            .set(await asAdmin(companyId))
            .expect(404);
    });
});
