import { useTestApp } from '@test/e2e/support/app.js';
import { monthDay, monthKey } from '@test/e2e/support/closing-fixtures.js';
import {
    asTenant,
    type ReportLedger,
    seedReportLedger,
} from '@test/e2e/support/report-fixtures.js';

const { api, db, queries } = useTestApp();
const MAX_QUERIES = 12;
const START = '2026-01-01';
const END = '2026-12-31';
let seed: ReportLedger;
let titleId: string;

beforeEach(async () => {
    seed = await seedReportLedger(db());
    titleId = (
        await db().title.create({
            data: {
                companyId: seed.company.id,
                presetId: seed.preset.id,
                controlAccountId: seed.accounts.payable,
                resultAccountId: seed.accounts.expense,
                type: 'EXPENSE',
                description: 'Contas',
                amount: '9999.00',
                issueDate: new Date('2026-01-01T00:00:00.000Z'),
                expirationDate: new Date('2026-12-31T00:00:00.000Z'),
            },
        })
    ).id;
});

const headers = async () => {
    const auth = await asTenant('admin', seed.company.id);
    await api().get('/api/v1/auth/me').set(auth).expect(200);
    return auth;
};

async function addPayments(count: number, from: number) {
    await db().entry.createMany({
        data: Array.from({ length: count }, (_, i) => ({
            titleId,
            kind: 'PAYMENT' as const,
            billingAccountId: seed.accounts.bank,
            principalAmount: '1.00',
            totalAmount: '1.00',
            paidAt: new Date(Date.UTC(2026, 0, 1 + from + i)),
            paymentMethod: 'PIX' as const,
        })),
    });
}

describe('os relatórios e filtros novos não crescem em queries com o volume', () => {
    const routes = () => [
        `reports/cash-flow?start=${START}&end=${END}`,
        `reports/cash-flow?start=${START}&end=${END}&groupBy=month`,
        `reports/cash-flow?start=${START}&end=${END}&groupBy=day`,
        `reports/management-dre?start=${START}&end=${END}&groupBy=month`,
        'period-closings',
        `entries?paidFrom=${START}&paidTo=${END}&titleType=EXPENSE&billingAccountId=${seed.accounts.bank}&pageSize=100`,
    ];

    it('cada rota com 3 e com 40 dias de pagamentos', async () => {
        const auth = await headers();
        await addPayments(3, 0);
        const small: number[] = [];
        for (const path of routes()) {
            small.push(
                await queries().count(() => api().get(`/api/v1/${path}`).set(auth).expect(200)),
            );
        }
        await addPayments(37, 3);
        for (const [index, path] of routes().entries()) {
            const large = await queries().count(() =>
                api().get(`/api/v1/${path}`).set(auth).expect(200),
            );
            expect({ path, large }).toEqual({ path, large: small[index] });
            expect(large).toBeGreaterThan(0);
            expect(large).toBeLessThanOrEqual(MAX_QUERIES);
        }
    });

    it('fechar e reabrir um mês usam um número limitado de queries', async () => {
        const auth = await headers();
        await api()
            .post('/api/v1/journal-entries')
            .set(auth)
            .send({
                date: monthDay(3, 10),
                description: 'Aporte',
                lines: [
                    { accountId: seed.accounts.bank, debit: '1.00' },
                    { accountId: seed.accounts.capital, credit: '1.00' },
                ],
            })
            .expect(201);
        const closeCount = await queries().count(() =>
            api()
                .post('/api/v1/period-closings')
                .set(auth)
                .send({ month: monthKey(3) })
                .expect(201),
        );
        const reopenCount = await queries().count(() =>
            api().delete('/api/v1/period-closings/latest').set(auth).expect(204),
        );
        expect(closeCount).toBeGreaterThan(0);
        expect(reopenCount).toBeGreaterThan(0);
        expect(Math.max(closeCount, reopenCount)).toBeLessThanOrEqual(MAX_QUERIES + 4);
    });
});
