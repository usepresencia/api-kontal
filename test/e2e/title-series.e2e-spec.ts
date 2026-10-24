import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { isoDay } from '@test/e2e/support/dates.js';
import {
    c,
    d,
    expectLedgerReconciled,
    journalOf,
    seedLedger,
    sorted,
} from '@test/e2e/support/ledger-fixtures.js';

const { api, db, queries } = useTestApp();
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

const seriesBody = (overrides: Record<string, unknown> = {}) => ({
    kind: 'INSTALLMENT',
    presetId: seed.preset.id,
    partyId: seed.party.id,
    type: 'INCOME',
    description: 'Venda',
    amount: '100.00',
    issueDate: '2026-01-20',
    expirationDate: '2026-01-31',
    count: 3,
    ...overrides,
});
const post = async (overrides: Record<string, unknown> = {}) =>
    api()
        .post('/api/v1/title-series')
        .set(await asAdmin(companyId))
        .send(seriesBody(overrides));

describe('POST /title-series: parcelado', () => {
    it('gera as parcelas com a sobra de centavos, mesma emissão, vencimento sem deriva e um lançamento por parcela', async () => {
        const res = await post();
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            kind: 'INSTALLMENT',
            frequency: 'MONTHLY',
            totalCount: 3,
            baseDescription: 'Venda',
        });
        const titles = res.body.titles as {
            id: string;
            seriesIndex: number;
            description: string;
            amount: string;
            issueDate: string;
            expirationDate: string;
        }[];
        expect(
            titles.map(t => [
                t.seriesIndex,
                t.description,
                t.amount,
                t.issueDate,
                t.expirationDate,
            ]),
        ).toEqual([
            [1, 'Venda Ref.: jan/2026', '33.34', '2026-01-20', '2026-01-31'],
            [2, 'Venda Ref.: fev/2026', '33.33', '2026-01-20', '2026-02-28'],
            [3, 'Venda Ref.: mar/2026', '33.33', '2026-01-20', '2026-03-31'],
        ]);
        for (const title of titles) {
            const journal = await journalOf(db(), 'TITLE_CREATION', title.id);
            expect(journal.date).toBe('2026-01-20');
            expect(journal.lines).toEqual(
                sorted([d(a.receivable, title.amount), c(a.revenue, title.amount)]),
            );
        }
        expect(await db().journalEntry.count()).toBe(3);
        await expectLedgerReconciled(db(), companyId);
        const read = await api()
            .get(`/api/v1/title-series/${res.body.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(read.body.titles).toHaveLength(3);
        const filtered = await api()
            .get(`/api/v1/titles?seriesId=${res.body.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(filtered.body.total).toBe(3);
    });

    it('cada parcela é baixada de forma independente', async () => {
        const res = await post({ amount: '300.00' });
        const [first, second] = res.body.titles;
        await api()
            .post(`/api/v1/titles/${first.id}/entries`)
            .set(await asAdmin(companyId))
            .send({
                billingAccountId: a.bank,
                principalAmount: '100.00',
                paidAt: '2026-01-31',
                paymentMethod: 'PIX',
            })
            .expect(201);
        const titles = await api()
            .get(`/api/v1/titles?seriesId=${res.body.id}`)
            .set(await asAdmin(companyId))
            .expect(200);
        expect(titles.body.items.map((t: { status: string }) => t.status)).toEqual([
            'SETTLED',
            'OPEN',
            'OPEN',
        ]);
        expect(second.status).toBe('OPEN');
        await expectLedgerReconciled(db(), companyId);
    });

    it.each([
        ['sem quantidade', { count: undefined }, 'SERIES_INVALID'],
        ['com data final', { until: '2026-12-31' }, 'SERIES_INVALID'],
        ['com uma parcela', { count: 1 }, 'SERIES_INVALID'],
        ['61 parcelas', { count: 61, amount: '1000.00' }, 'SERIES_LIMIT_EXCEEDED'],
        ['total menor que o número de parcelas', { amount: '0.02', count: 3 }, 'SERIES_INVALID'],
    ])('400 para parcelado %s', async (_label, overrides, code) => {
        const res = await post(overrides);
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code });
        expect(await db().title.count()).toBe(0);
        expect(await db().titleSeries.count()).toBe(0);
    });
});

describe('POST /title-series: recorrente', () => {
    const recurring = (overrides: Record<string, unknown> = {}) =>
        seriesBody({
            kind: 'RECURRING',
            type: 'EXPENSE',
            description: 'Aluguel',
            amount: '2500.00',
            count: 3,
            issueDate: '2026-11-05',
            expirationDate: '2026-11-10',
            ...overrides,
        });

    it('por quantidade: valor igual, competência e vencimento mensais, lançamento D despesa / C a pagar de cada mês', async () => {
        const res = await api()
            .post('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .send(recurring());
        expect(res.status).toBe(201);
        const titles = res.body.titles as {
            id: string;
            description: string;
            amount: string;
            issueDate: string;
            expirationDate: string;
        }[];
        expect(titles.map(t => [t.description, t.amount, t.issueDate, t.expirationDate])).toEqual([
            ['Aluguel Ref.: nov/2026', '2500.00', '2026-11-05', '2026-11-10'],
            ['Aluguel Ref.: dez/2026', '2500.00', '2026-12-05', '2026-12-10'],
            ['Aluguel Ref.: jan/2027', '2500.00', '2027-01-05', '2027-01-10'],
        ]);
        const journal = await journalOf(db(), 'TITLE_CREATION', titles[1].id);
        expect(journal.date).toBe('2026-12-05');
        expect(journal.lines).toEqual(sorted([d(a.expense, '2500.00'), c(a.payable, '2500.00')]));
        await expectLedgerReconciled(db(), companyId);
    });

    it('por data final, com frequência semanal e anual', async () => {
        const monthly = await api()
            .post('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .send(recurring({ count: undefined, until: '2027-01-10' }));
        expect(monthly.body.titles).toHaveLength(3);
        const weekly = await api()
            .post('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .send(recurring({ count: 3, frequency: 'WEEKLY' }));
        expect(weekly.body.titles.map((t: { expirationDate: string }) => t.expirationDate)).toEqual(
            ['2026-11-10', '2026-11-17', '2026-11-24'],
        );
        const yearly = await api()
            .post('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .send(recurring({ count: 2, frequency: 'YEARLY' }));
        expect(yearly.body.titles.map((t: { expirationDate: string }) => t.expirationDate)).toEqual(
            ['2026-11-10', '2027-11-10'],
        );
    });

    it.each([
        ['sem fim', { count: undefined }, 'SERIES_INVALID'],
        ['com quantidade e data final', { until: '2027-01-10' }, 'SERIES_INVALID'],
        [
            'data final antes da primeira ocorrência',
            { count: undefined, until: '2026-11-09' },
            'SERIES_INVALID',
        ],
        ['mais de 60 ocorrências', { count: 61 }, 'SERIES_LIMIT_EXCEEDED'],
    ])('400 para recorrente %s', async (_label, overrides, code) => {
        const res = await api()
            .post('/api/v1/title-series')
            .set(await asAdmin(companyId))
            .send(recurring(overrides));
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code });
        expect(await db().title.count()).toBe(0);
    });

    it('400 de validação para frequência, tipo de série e valor inválidos; 404 e 400 para preset', async () => {
        for (const overrides of [
            { frequency: 'DAILY' },
            { kind: 'X' },
            { amount: '1.234' },
            { count: 1.5 },
        ]) {
            expect((await post(overrides)).status).toBe(400);
        }
        const missing = await post({ presetId: '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f' });
        expect(missing.status).toBe(404);
        expect(missing.body).toMatchObject({ code: 'PRESET_NOT_FOUND' });
    });
});

describe('inserção em lote: o número de queries não cresce com a quantidade de parcelas', () => {
    it('gerar 3 e 40 parcelas executa a mesma quantidade de queries', async () => {
        const auth = await asAdmin(companyId);
        await api().get('/api/v1/auth/me').set(auth).expect(200);
        const small = await queries().count(async () => {
            await api()
                .post('/api/v1/title-series')
                .set(auth)
                .send(seriesBody({ count: 3 }))
                .expect(201);
        });
        const large = await queries().count(async () => {
            await api()
                .post('/api/v1/title-series')
                .set(auth)
                .send(seriesBody({ count: 40, amount: '400.00' }))
                .expect(201);
        });
        expect(large).toBe(small);
        expect(large).toBeLessThanOrEqual(20);
    });
});
