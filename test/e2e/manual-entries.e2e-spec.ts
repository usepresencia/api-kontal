import { randomUUID } from 'node:crypto';
import { useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import { createAccountFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';
import {
    asTenant,
    type ReportLedger,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db } = useTestApp();
let seed: ReportLedger;
let headers: Record<string, string>;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    headers = await asTenant('admin', seed.company.id);
});

const body = (overrides: Record<string, unknown> = {}) => ({
    date: isoDay(-1),
    description: 'Aporte de capital',
    lines: [
        { accountId: seed.accounts.bank, debit: '1000.00' },
        { accountId: seed.accounts.capital, credit: '1000.00', memo: 'Sócio A' },
    ],
    ...overrides,
});
const post = async (payload: Record<string, unknown>) =>
    api().post('/api/v1/journal-entries').set(headers).send(payload);
const reverse = async (id: string, payload: Record<string, unknown> = {}) =>
    api().post(`/api/v1/journal-entries/${id}/reverse`).set(headers).send(payload);

describe('POST /journal-entries', () => {
    it('201 com lançamento MANUAL numerado, débitos antes dos créditos e sem estorno', async () => {
        const res = await post(body());
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            referenceType: 'MANUAL',
            referenceId: res.body.id,
            date: isoDay(-1),
            description: 'Aporte de capital',
            totalDebits: '1000.00',
            totalCredits: '1000.00',
            reversedBy: null,
        });
        expect(typeof res.body.number).toBe('number');
        expect(res.body.lines).toEqual([
            {
                accountId: seed.accounts.bank,
                accountCode: '1.1',
                accountName: 'Banco',
                debit: '1000.00',
                credit: '0.00',
                memo: '',
            },
            {
                accountId: seed.accounts.capital,
                accountCode: '5.1',
                accountName: 'Capital social',
                debit: '0.00',
                credit: '1000.00',
                memo: 'Sócio A',
            },
        ]);
    });

    it.each([
        [
            'desbalanceado',
            () => ({
                lines: [
                    { accountId: seed.accounts.bank, debit: '10.00' },
                    { accountId: seed.accounts.capital, credit: '9.99' },
                ],
            }),
            'MANUAL_ENTRY_UNBALANCED',
        ],
        ['data futura', () => ({ date: isoDay(1) }), 'MANUAL_ENTRY_DATE_INVALID'],
        [
            'conta a receber (controle)',
            () => ({
                lines: [
                    { accountId: seed.accounts.receivable, debit: '10.00' },
                    { accountId: seed.accounts.capital, credit: '10.00' },
                ],
            }),
            'MANUAL_ENTRY_CONTROL_ACCOUNT',
        ],
        [
            'conta a pagar (controle)',
            () => ({
                lines: [
                    { accountId: seed.accounts.bank, debit: '10.00' },
                    { accountId: seed.accounts.payable, credit: '10.00' },
                ],
            }),
            'MANUAL_ENTRY_CONTROL_ACCOUNT',
        ],
        [
            'conta sintética',
            () => ({
                lines: [
                    { accountId: seed.accounts.equityRoot, debit: '10.00' },
                    { accountId: seed.accounts.bank, credit: '10.00' },
                ],
            }),
            'MANUAL_ENTRY_ACCOUNT_INVALID',
        ],
        [
            'conta inexistente',
            () => ({
                lines: [
                    { accountId: randomUUID(), debit: '10.00' },
                    { accountId: seed.accounts.bank, credit: '10.00' },
                ],
            }),
            'MANUAL_ENTRY_ACCOUNT_INVALID',
        ],
    ])('400 para %s, sem gravar nada', async (_label, overrides, code) => {
        const before = await db().journalEntry.count();
        const res = await post(body(overrides()));
        expect(res.status).toBe(400);
        expect(res.body.code).toBe(code);
        expect(await db().journalEntry.count()).toBe(before);
    });

    it('400 para conta de outro plano da empresa, conta inativa e conta de outra empresa', async () => {
        const otherPlan = await createPlanFixture(db(), seed.company.id);
        const otherPlanAccount = await createAccountFixture(db(), {
            billingPlanId: otherPlan.id,
            code: '1',
            level: 1,
            nature: 'ASSET',
            accountType: 'ANALYTIC',
        });
        const inactive = await createAccountFixture(db(), {
            billingPlanId: seed.plan.id,
            parentId: seed.accounts.equityRoot,
            code: '5.2',
            level: 2,
            nature: 'EQUITY',
            accountType: 'ANALYTIC',
        });
        await db().billingAccount.update({ where: { id: inactive.id }, data: { isActive: false } });
        const other = await seedReportLedger(db(), { name: 'Outra' });
        for (const accountId of [otherPlanAccount.id, inactive.id, other.accounts.bank]) {
            const res = await post(
                body({
                    lines: [
                        { accountId, debit: '10.00' },
                        { accountId: seed.accounts.capital, credit: '10.00' },
                    ],
                }),
            );
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('MANUAL_ENTRY_ACCOUNT_INVALID');
        }
    });

    it('400 VALIDATION_ERROR para linha com débito e crédito, uma linha só ou sem histórico', async () => {
        for (const overrides of [
            {
                lines: [
                    { accountId: seed.accounts.bank, debit: '1.00', credit: '1.00' },
                    { accountId: seed.accounts.capital, credit: '1.00' },
                ],
            },
            { lines: [{ accountId: seed.accounts.bank, debit: '1.00' }] },
            { description: ' ' },
        ]) {
            const res = await post(body(overrides));
            expect(res.status).toBe(400);
            expect(res.body.code).toBe('VALIDATION_ERROR');
        }
    });
});

describe('POST /journal-entries/:id/reverse', () => {
    it('201 com as linhas invertidas na data de hoje; o original passa a apontar para o estorno', async () => {
        const original = (await post(body())).body;
        const res = await reverse(original.id, { description: 'Lançado em duplicidade' });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            referenceType: 'MANUAL_REVERSAL',
            referenceId: original.id,
            date: isoDay(0),
            description: 'Lançado em duplicidade',
        });
        expect(
            res.body.lines.map((l: { accountCode: string; debit: string; credit: string }) => [
                l.accountCode,
                l.debit,
                l.credit,
            ]),
        ).toEqual([
            ['5.1', '1000.00', '0.00'],
            ['1.1', '0.00', '1000.00'],
        ]);
        const reread = await api()
            .get(`/api/v1/journal-entries/${original.id}`)
            .set(headers)
            .expect(200);
        expect(reread.body.reversedBy).toBe(res.body.id);
    });

    it('409 JOURNAL_ALREADY_REVERSED no segundo estorno; 409 JOURNAL_NOT_REVERSIBLE para estorno e lançamento automático', async () => {
        const original = (await post(body())).body;
        const reversal = (await reverse(original.id)).body;
        expect((await reverse(original.id)).body.code).toBe('JOURNAL_ALREADY_REVERSED');
        expect((await reverse(reversal.id)).body.code).toBe('JOURNAL_NOT_REVERSIBLE');
        const title = (
            await api()
                .post('/api/v1/titles')
                .set(headers)
                .send({
                    presetId: seed.preset.id,
                    partyId: seed.party.id,
                    type: 'INCOME',
                    description: 'Venda',
                    amount: '10.00',
                    issueDate: isoDay(-1),
                    expirationDate: isoDay(10),
                })
                .expect(201)
        ).body;
        const creation = await db().journalEntry.findFirstOrThrow({
            where: { referenceId: title.id },
        });
        const res = await reverse(creation.id);
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('JOURNAL_NOT_REVERSIBLE');
    });

    it('oito estornos simultâneos: um 201, os demais 409 JOURNAL_ALREADY_REVERSED, um único estorno gravado', async () => {
        const original = (await post(body())).body;
        const results = await Promise.all(Array.from({ length: 8 }, () => reverse(original.id)));
        expect(results.filter(r => r.status === 201)).toHaveLength(1);
        const losers = results.filter(r => r.status !== 201);
        expect(losers.map(r => [r.status, r.body.code])).toEqual(
            Array(7).fill([409, 'JOURNAL_ALREADY_REVERSED']),
        );
        expect(
            await db().journalEntry.count({
                where: { referenceType: 'MANUAL_REVERSAL', referenceId: original.id },
            }),
        ).toBe(1);
    });

    it('lançamento de outra empresa: 404 JOURNAL_ENTRY_NOT_FOUND', async () => {
        const other = await seedReportLedger(db(), { name: 'Outra' });
        const foreign = (
            await api()
                .post('/api/v1/journal-entries')
                .set(await asTenant('admin', other.company.id))
                .send({
                    date: isoDay(-1),
                    description: 'x',
                    lines: [
                        { accountId: other.accounts.bank, debit: '1.00' },
                        { accountId: other.accounts.capital, credit: '1.00' },
                    ],
                })
                .expect(201)
        ).body;
        const res = await reverse(foreign.id);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('JOURNAL_ENTRY_NOT_FOUND');
    });
});
