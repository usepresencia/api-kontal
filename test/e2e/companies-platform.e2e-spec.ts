import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { companyPayload } from '@test/e2e/support/company-payload.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();

describe('POST /companies', () => {
    it('cria empresa e endereço (201) com CNPJ, CEP e UF normalizados', async () => {
        const res = await api()
            .post('/api/v1/companies')
            .set(await bearer('admin'))
            .send(companyPayload({ cnpj: '11.222.333/0001-81' }))
            .expect(201);
        expect(res.body).toMatchObject({
            name: 'Padaria Pão Quente',
            cnpj: '11222333000181',
            openingDate: '2020-05-01',
            isActive: true,
            logoUrl: null,
            address: { zipCode: '01310100', state: 'SP', complement: 'Sala 2' },
        });
        const saved = await db().company.findUnique({
            where: { id: res.body.id },
            include: { address: true },
        });
        expect(saved?.address?.city).toBe('São Paulo');
    });

    it('400 para CNPJ inválido, com code VALIDATION_ERROR', async () => {
        const res = await api()
            .post('/api/v1/companies')
            .set(await bearer('admin'))
            .send(companyPayload({ cnpj: '11222333000182' }))
            .expect(400);
        expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('400 sem endereço', async () => {
        const { address: _address, ...withoutAddress } = companyPayload();
        await api()
            .post('/api/v1/companies')
            .set(await bearer('admin'))
            .send(withoutAddress)
            .expect(400);
    });

    it('409 CNPJ_ALREADY_REGISTERED para CNPJ repetido', async () => {
        const payload = companyPayload();
        await api()
            .post('/api/v1/companies')
            .set(await bearer('admin'))
            .send(payload)
            .expect(201);
        const res = await api()
            .post('/api/v1/companies')
            .set(await bearer('admin'))
            .send({ ...payload, name: 'Outra' })
            .expect(409);
        expect(res.body).toMatchObject({ code: 'CNPJ_ALREADY_REGISTERED' });
        expect(await db().company.count()).toBe(1);
    });

    it('403 para INTERNAL_BILLING (só INTERNAL_ADMIN cria empresas)', async () => {
        const res = await api()
            .post('/api/v1/companies')
            .set(await bearer('billing'))
            .send(companyPayload())
            .expect(403);
        expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
        expect(await db().company.count()).toBe(0);
    });
});

describe('GET /companies', () => {
    beforeEach(async () => {
        await createCompanyFixture(db(), { name: 'Banca' });
        await createCompanyFixture(db(), { name: 'Açougue' });
        await createCompanyFixture(db(), { name: 'Padaria', isActive: false });
    });

    it('lista paginada e ordenada por nome, inclusive empresas inativas', async () => {
        const first = await api()
            .get('/api/v1/companies?page=1&pageSize=2')
            .set(await bearer('admin'))
            .expect(200);
        expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 3 });
        expect(first.body.items.map((c: { name: string }) => c.name)).toEqual(['Açougue', 'Banca']);

        const second = await api()
            .get('/api/v1/companies?page=2&pageSize=2')
            .set(await bearer('admin'))
            .expect(200);
        expect(second.body.items.map((c: { name: string }) => c.name)).toEqual(['Padaria']);
        expect(second.body.items[0].isActive).toBe(false);
    });

    it('INTERNAL_BILLING também lê a lista', async () => {
        await api()
            .get('/api/v1/companies')
            .set(await bearer('billing'))
            .expect(200);
    });

    it.each(['pageSize=0', 'pageSize=101', 'page=0', 'page=abc'])('400 para %s', async query => {
        await api()
            .get(`/api/v1/companies?${query}`)
            .set(await bearer('admin'))
            .expect(400);
    });
});

describe('DELETE /companies/:id', () => {
    it('desativa a empresa (204) sem apagar dados', async () => {
        const company = await createCompanyFixture(db(), { name: 'Padaria' });
        await api()
            .delete(`/api/v1/companies/${company.id}`)
            .set(await bearer('admin'))
            .expect(204);
        const saved = await db().company.findUnique({ where: { id: company.id } });
        expect(saved?.isActive).toBe(false);
    });

    it('404 COMPANY_NOT_FOUND para empresa inexistente', async () => {
        const res = await api()
            .delete('/api/v1/companies/3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f')
            .set(await bearer('admin'))
            .expect(404);
        expect(res.body).toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    });

    it('400 para id que não é UUID', async () => {
        await api()
            .delete('/api/v1/companies/abc')
            .set(await bearer('admin'))
            .expect(400);
    });

    it('403 para INTERNAL_BILLING', async () => {
        const company = await createCompanyFixture(db());
        await api()
            .delete(`/api/v1/companies/${company.id}`)
            .set(await bearer('billing'))
            .expect(403);
        expect((await db().company.findUnique({ where: { id: company.id } }))?.isActive).toBe(true);
    });
});
