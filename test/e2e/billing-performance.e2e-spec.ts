import { toSortKey } from '@/domain/billing/account-code.js';
import { bearer, useTestApp } from '@test/e2e/support/app.js';
import {
    createAccountFixture,
    createCompanyFixture,
    createPlanFixture,
} from '@test/e2e/support/fixtures.js';

const { api, db, queries } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const MAX_QUERIES_PER_REQUEST = 12;

async function seedPlan(name: string, accounts: number): Promise<string> {
    const plan = await createPlanFixture(db(), COMPANY_ID, { name });
    const root = await createAccountFixture(db(), { billingPlanId: plan.id, code: '1', level: 1 });
    await db().billingAccount.createMany({
        data: Array.from({ length: accounts - 1 }, (_, i) => ({
            billingPlanId: plan.id,
            parentId: root.id,
            name: `Conta ${i + 1}`,
            accountType: 'ANALYTIC' as const,
            code: `1.${i + 1}`,
            sortKey: toSortKey(`1.${i + 1}`),
            level: 2,
        })),
    });
    return plan.id;
}

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
});

/** Cabeçalhos autenticados; o primeiro login já provisiona o usuário, fora da medição. */
const headers = async () => {
    const auth = { ...(await bearer('admin')), 'X-Tenant-Id': COMPANY_ID };
    await api().get('/api/v1/auth/me').set(auth).expect(200);
    return auth;
};

describe('sem N+1: o número de queries não cresce com o número de linhas', () => {
    it('GET /billing-accounts faz o mesmo número de queries com 3 e com 50 contas', async () => {
        const small = await seedPlan('Pequeno', 3);
        const large = await seedPlan('Grande', 50);
        const auth = await headers();

        const smallCount = await queries().count(async () => {
            const res = await api()
                .get(`/api/v1/billing-accounts?planId=${small}&pageSize=100`)
                .set(auth)
                .expect(200);
            expect(res.body.items).toHaveLength(3);
        });
        const largeCount = await queries().count(async () => {
            const res = await api()
                .get(`/api/v1/billing-accounts?planId=${large}&pageSize=100`)
                .set(auth)
                .expect(200);
            expect(res.body.items).toHaveLength(50);
        });

        expect(largeCount).toBe(smallCount);
        expect(largeCount).toBeLessThanOrEqual(MAX_QUERIES_PER_REQUEST);
    });

    it('GET /billing-plans/:id/accounts faz o mesmo número de queries com 3 e com 50 contas', async () => {
        const small = await seedPlan('Pequeno', 3);
        const large = await seedPlan('Grande', 50);
        const auth = await headers();

        const smallCount = await queries().count(async () => {
            await api().get(`/api/v1/billing-plans/${small}/accounts`).set(auth).expect(200);
        });
        const largeCount = await queries().count(async () => {
            const res = await api()
                .get(`/api/v1/billing-plans/${large}/accounts`)
                .set(auth)
                .expect(200);
            expect(res.body).toHaveLength(50);
        });

        expect(largeCount).toBe(smallCount);
        expect(largeCount).toBeLessThanOrEqual(MAX_QUERIES_PER_REQUEST);
    });

    it('GET /billing-plans faz o mesmo número de queries com 2 e com 30 planos', async () => {
        await createPlanFixture(db(), COMPANY_ID, { name: 'P1' });
        await createPlanFixture(db(), COMPANY_ID, { name: 'P2' });
        const auth = await headers();
        const smallCount = await queries().count(async () => {
            await api().get('/api/v1/billing-plans?pageSize=100').set(auth).expect(200);
        });

        for (let i = 0; i < 28; i += 1)
            await createPlanFixture(db(), COMPANY_ID, { name: `Extra ${i}` });
        const largeCount = await queries().count(async () => {
            const res = await api().get('/api/v1/billing-plans?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(30);
        });

        expect(largeCount).toBe(smallCount);
    });

    it('GET /companies faz o mesmo número de queries com 3 e com 25 empresas', async () => {
        await createCompanyFixture(db(), { name: 'Extra 1' });
        await createCompanyFixture(db(), { name: 'Extra 2' });
        const auth = await bearer('admin');
        await api().get('/api/v1/auth/me').set(auth).expect(200);
        const smallCount = await queries().count(async () => {
            await api().get('/api/v1/companies?pageSize=100').set(auth).expect(200);
        });

        for (let i = 0; i < 22; i += 1) await createCompanyFixture(db(), { name: `Mais ${i}` });
        const largeCount = await queries().count(async () => {
            const res = await api().get('/api/v1/companies?pageSize=100').set(auth).expect(200);
            expect(res.body.items).toHaveLength(25);
        });

        expect(largeCount).toBe(smallCount);
    });

    it('criar uma conta usa um número limitado de queries, independente do tamanho da árvore', async () => {
        const plan = await seedPlan('Grande', 50);
        const root = await db().billingAccount.findFirstOrThrow({
            where: { billingPlanId: plan, code: '1' },
        });
        const auth = await headers();
        const count = await queries().count(async () => {
            await api()
                .post('/api/v1/billing-accounts')
                .set(auth)
                .send({
                    billingPlanId: plan,
                    parentId: root.id,
                    name: 'Nova',
                    accountType: 'ANALYTIC',
                })
                .expect(201);
        });
        expect(count).toBeLessThanOrEqual(MAX_QUERIES_PER_REQUEST + 4);
    });
});
