import { bearer, useTestApp } from '@test/e2e/support/app.js';

const { api, db } = useTestApp();

describe('GET /auth/tenants', () => {
    beforeEach(async () => {
        await db().company.createMany({
            data: [
                { id: 'c-b', name: 'Banca' },
                { id: 'c-a', name: 'Açougue' },
                { id: 'c-x', name: 'Fechada', isActive: false },
            ],
        });
    });

    it('INTERNAL_ADMIN lista as empresas ativas como OWNER', async () => {
        const res = await api()
            .get('/api/v1/auth/tenants')
            .set(await bearer('admin'))
            .expect(200);
        expect(res.body.map((c: { companyId: string }) => c.companyId)).toEqual(['c-a', 'c-b']);
        expect(res.body.every((c: { role: string }) => c.role === 'OWNER')).toBe(true);
    });

    it('INTERNAL_BILLING lista as empresas ativas como SUPPORT', async () => {
        const res = await api()
            .get('/api/v1/auth/tenants')
            .set(await bearer('billing'))
            .expect(200);
        expect(res.body.every((c: { role: string }) => c.role === 'SUPPORT')).toBe(true);
    });
});
