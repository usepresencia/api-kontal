import { createHash } from 'node:crypto';
import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const logoUrl = (companyId: string, cloud = 'demo-cloud', ext = 'png') =>
    `https://res.cloudinary.com/${cloud}/image/upload/v1700000000/kontal/companies/${companyId}/logo.${ext}`;

beforeEach(async () => {
    await createCompanyFixture(db(), { id: COMPANY_ID, name: 'Padaria' });
});

describe('POST /company/logo/signature', () => {
    it('devolve parâmetros cuja assinatura confere com o segredo do servidor', async () => {
        const res = await api()
            .post('/api/v1/company/logo/signature')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(200);
        const b = res.body;
        expect(b).toMatchObject({
            cloudName: 'demo-cloud',
            apiKey: '123456789012345',
            publicId: `kontal/companies/${COMPANY_ID}/logo`,
            allowedFormats: 'png,jpg,jpeg,webp',
            overwrite: true,
            invalidate: true,
            uploadUrl: 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload',
        });
        const expected = createHash('sha1')
            .update(
                `allowed_formats=${b.allowedFormats}&invalidate=true&overwrite=true&public_id=${b.publicId}&timestamp=${b.timestamp}test-secret`,
            )
            .digest('hex');
        expect(b.signature).toBe(expected);
        expect(JSON.stringify(b)).not.toContain('test-secret');
    });

    it('403 para INTERNAL_BILLING (SUPPORT não altera o logo)', async () => {
        await api()
            .post('/api/v1/company/logo/signature')
            .set(await bearer('billing'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(403);
    });
});

describe('PUT /company/logo e DELETE /company/logo', () => {
    it('grava a URL do logo da própria empresa e a devolve em GET /company', async () => {
        const url = logoUrl(COMPANY_ID);
        const saved = await api()
            .put('/api/v1/company/logo')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send({ url })
            .expect(200);
        expect(saved.body.logoUrl).toBe(url);
        const current = await api()
            .get('/api/v1/company')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(200);
        expect(current.body.logoUrl).toBe(url);
    });

    it.each([
        ['logo de outra empresa', logoUrl(OTHER_ID)],
        ['outro cloud name', logoUrl(COMPANY_ID, 'outro-cloud')],
        ['extensão não permitida', logoUrl(COMPANY_ID, 'demo-cloud', 'gif')],
        ['http', logoUrl(COMPANY_ID).replace('https:', 'http:')],
        ['com query', `${logoUrl(COMPANY_ID)}?x=1`],
    ])('400 LOGO_URL_INVALID para %s', async (_label, url) => {
        const res = await api()
            .put('/api/v1/company/logo')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send({ url })
            .expect(400);
        expect(res.body).toMatchObject({ code: 'LOGO_URL_INVALID' });
        expect((await db().company.findUnique({ where: { id: COMPANY_ID } }))?.logoUrl).toBeNull();
    });

    it('400 para corpo sem URL válida', async () => {
        await api()
            .put('/api/v1/company/logo')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send({ url: 'não é url' })
            .expect(400);
    });

    it('403 para INTERNAL_BILLING', async () => {
        await api()
            .put('/api/v1/company/logo')
            .set(await bearer('billing'))
            .set('X-Tenant-Id', COMPANY_ID)
            .send({ url: logoUrl(COMPANY_ID) })
            .expect(403);
    });

    it('DELETE limpa o logo (204)', async () => {
        await db().company.update({
            where: { id: COMPANY_ID },
            data: { logoUrl: logoUrl(COMPANY_ID) },
        });
        await api()
            .delete('/api/v1/company/logo')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', COMPANY_ID)
            .expect(204);
        expect((await db().company.findUnique({ where: { id: COMPANY_ID } }))?.logoUrl).toBeNull();
    });
});
