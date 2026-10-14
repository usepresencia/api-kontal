import { bearer, useTestApp } from '@test/e2e/support/app.js';

const { api, db } = useTestApp();

describe('isolamento por empresa e papéis', () => {
    beforeEach(async () => {
        await db().company.create({ data: { id: 'c1', name: 'Padaria' } });
    });

    it('403 TENANT_REQUIRED sem X-Tenant-Id', async () => {
        const res = await api()
            .get('/api/v1/probe/company')
            .set(await bearer('admin'))
            .expect(403);
        expect(res.body).toMatchObject({ code: 'TENANT_REQUIRED' });
    });

    it('404 COMPANY_NOT_FOUND para empresa inexistente', async () => {
        const res = await api()
            .get('/api/v1/probe/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', 'nope')
            .expect(404);
        expect(res.body).toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    });

    it('ADMIN resolve OWNER e o contexto carrega o autor', async () => {
        const res = await api()
            .get('/api/v1/probe/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', 'c1')
            .expect(200);
        expect(res.body).toMatchObject({
            companyId: 'c1',
            membershipRole: 'OWNER',
            platformRole: 'INTERNAL_ADMIN',
        });
    });

    it('BILLING resolve SUPPORT: lê, mas não escreve', async () => {
        const read = await api()
            .get('/api/v1/probe/company')
            .set(await bearer('billing'))
            .set('X-Tenant-Id', 'c1')
            .expect(200);
        expect(read.body).toMatchObject({ membershipRole: 'SUPPORT' });

        const write = await api()
            .post('/api/v1/probe/write')
            .set(await bearer('billing'))
            .set('X-Tenant-Id', 'c1')
            .expect(403);
        expect(write.body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('ADMIN (OWNER) escreve', async () => {
        const res = await api()
            .post('/api/v1/probe/write')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', 'c1')
            .expect(201);
        expect(res.body).toEqual({ ok: true, companyId: 'c1' });
    });
});
