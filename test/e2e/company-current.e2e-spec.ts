import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { companyPayload } from '@test/e2e/support/company-payload.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
});

describe('GET /company', () => {
    it('devolve a empresa do X-Tenant-Id com o endereço', async () => {
        const res = await api()
            .get('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(200);
        expect(res.body).toMatchObject({
            id: COMPANY_ID,
            name: 'Padaria',
            address: { state: 'SP', zipCode: '01310100' },
        });
    });

    it('INTERNAL_BILLING (SUPPORT) também lê', async () => {
        await api()
            .get('/api/v1/company')
            .set(await bearer('billing'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(200);
    });

    it('403 TENANT_REQUIRED sem X-Tenant-Id', async () => {
        const res = await api()
            .get('/api/v1/company')
            .set(await bearer('admin'))
            .expect(403);
        expect(res.body).toMatchObject({ code: 'TENANT_REQUIRED' });
    });

    it('404 COMPANY_NOT_FOUND para empresa inexistente', async () => {
        const res = await api()
            .get('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f')
            .expect(404);
        expect(res.body).toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    });
});

describe('PUT /company', () => {
    it('OWNER (INTERNAL_ADMIN) altera dados e endereço', async () => {
        const res = await api()
            .put('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send(
                companyPayload({
                    name: 'Padaria Nova',
                    address: { ...companyPayload().address, city: 'Campinas' },
                }),
            )
            .expect(200);
        expect(res.body).toMatchObject({
            id: COMPANY_ID,
            name: 'Padaria Nova',
            address: { city: 'Campinas' },
        });
        const saved = await db().company.findUnique({
            where: { id: COMPANY_ID },
            include: { address: true },
        });
        expect(saved?.name).toBe('Padaria Nova');
        expect(saved?.address?.city).toBe('Campinas');
    });

    it('400 para corpo inválido', async () => {
        await api()
            .put('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send(companyPayload({ email: 'x' }))
            .expect(400);
    });

    it('409 CNPJ_ALREADY_REGISTERED quando o CNPJ é de outra empresa', async () => {
        const other = await createCompanyFixture(db(), { name: 'Outra' });
        const res = await api()
            .put('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send(companyPayload({ cnpj: other.cnpj }))
            .expect(409);
        expect(res.body).toMatchObject({ code: 'CNPJ_ALREADY_REGISTERED' });
    });

    it('403 FORBIDDEN para INTERNAL_BILLING (SUPPORT é somente leitura)', async () => {
        const res = await api()
            .put('/api/v1/company')
            .set(await bearer('billing'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send(companyPayload())
            .expect(403);
        expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
        expect((await db().company.findUnique({ where: { id: COMPANY_ID } }))?.name).toBe(
            'Padaria',
        );
    });
});
