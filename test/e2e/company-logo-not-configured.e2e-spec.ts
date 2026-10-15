import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';

vi.hoisted(() => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
});

const { api, db } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
});

describe('logo sem Cloudinary configurado', () => {
    it('a assinatura responde 503 MEDIA_NOT_CONFIGURED', async () => {
        const res = await api()
            .post('/api/v1/company/logo/signature')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(503);
        expect(res.body).toMatchObject({ code: 'MEDIA_NOT_CONFIGURED' });
    });

    it('salvar a URL responde 503 MEDIA_NOT_CONFIGURED', async () => {
        const res = await api()
            .put('/api/v1/company/logo')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send({
                url: `https://res.cloudinary.com/demo-cloud/image/upload/v1/kontal/companies/${COMPANY_ID}/logo.png`,
            })
            .expect(503);
        expect(res.body).toMatchObject({ code: 'MEDIA_NOT_CONFIGURED' });
    });

    it('o restante da API de empresa segue funcionando', async () => {
        await api()
            .get('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(200);
    });
});
