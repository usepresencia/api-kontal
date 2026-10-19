import { bearer, bearerWithClaims, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const NOT_A_COMPANY = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

const claim = (...entries: { companyId: string; role: string }[]) => ({
    kontalMemberships: entries,
});

describe('acesso por claim kontalMemberships', () => {
    it('quem tem a claim acessa a empresa e a sessão traz o vínculo', async () => {
        const company = await createCompanyFixture(db(), { name: 'Presencia Ltda' });
        const headers = await bearerWithClaims(
            'member',
            claim({ companyId: company.id, role: 'OWNER' }),
        );

        const session = await api().post('/api/v1/auth/session').set(headers).expect(200);
        expect(session.body).toMatchObject({
            isPlatformUser: false,
            memberships: [{ companyId: company.id, companyName: 'Presencia Ltda', role: 'OWNER' }],
        });

        await createPlanFixture(db(), company.id, { name: 'Plano' });
        const plans = await api()
            .get('/api/v1/billing-plans')
            .set({ ...headers, 'X-Tenant-Id': company.id })
            .expect(200);
        expect(plans.body.total).toBe(1);
    });

    it('o papel OWNER da claim permite escrever na empresa', async () => {
        const company = await createCompanyFixture(db());
        const headers = await bearerWithClaims(
            'member',
            claim({ companyId: company.id, role: 'OWNER' }),
        );
        await api()
            .post('/api/v1/billing-plans')
            .set({ ...headers, 'X-Tenant-Id': company.id })
            .send({ name: 'Plano novo' })
            .expect(201);
    });

    it('não alcança outra empresa que não está na claim', async () => {
        const mine = await createCompanyFixture(db());
        const other = await createCompanyFixture(db());
        const headers = await bearerWithClaims(
            'member',
            claim({ companyId: mine.id, role: 'OWNER' }),
        );
        await api()
            .get('/api/v1/billing-plans')
            .set({ ...headers, 'X-Tenant-Id': other.id })
            .expect(403);
    });

    it('usuário de empresa não lista nem cria empresas da plataforma', async () => {
        const company = await createCompanyFixture(db());
        const headers = await bearerWithClaims(
            'member',
            claim({ companyId: company.id, role: 'OWNER' }),
        );
        await api().get('/api/v1/companies').set(headers).expect(403);
        await api().post('/api/v1/companies').set(headers).send({}).expect(403);
        await api().delete(`/api/v1/companies/${company.id}`).set(headers).expect(403);
    });

    it('perder a claim tira o acesso e desativa o vínculo no próximo login', async () => {
        const company = await createCompanyFixture(db());
        const withClaim = await bearerWithClaims(
            'member',
            claim({ companyId: company.id, role: 'OWNER' }),
        );
        await api()
            .get('/api/v1/billing-plans')
            .set({ ...withClaim, 'X-Tenant-Id': company.id })
            .expect(200);

        const withoutClaim = await bearerWithClaims('member', {});
        await api().get('/api/v1/auth/me').set(withoutClaim).expect(403);
        await api()
            .get('/api/v1/billing-plans')
            .set({ ...withoutClaim, 'X-Tenant-Id': company.id })
            .expect(403);
        expect(
            await db().membership.count({ where: { companyId: company.id, isActive: true } }),
        ).toBe(0);
    });

    it('mudar o papel na claim atualiza o vínculo', async () => {
        const company = await createCompanyFixture(db());
        await bearerWithClaims('member', claim({ companyId: company.id, role: 'OWNER' })).then(
            headers => api().get('/api/v1/auth/me').set(headers).expect(200),
        );
        const headers = await bearerWithClaims(
            'member',
            claim({ companyId: company.id, role: 'SUPPORT' }),
        );
        await api().get('/api/v1/auth/me').set(headers).expect(200);
        const rows = await db().membership.findMany({ where: { companyId: company.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ role: 'SUPPORT', isActive: true });
    });

    it('claim com empresa inexistente não dá acesso e não cria vínculo', async () => {
        const headers = await bearerWithClaims(
            'member',
            claim({ companyId: NOT_A_COMPANY, role: 'OWNER' }),
        );
        await api().get('/api/v1/auth/me').set(headers).expect(403);
        expect(await db().membership.count()).toBe(0);
    });

    it('claim malformada não dá acesso', async () => {
        const headers = await bearerWithClaims('member', { kontalMemberships: 'tudo' });
        await api().get('/api/v1/auth/me').set(headers).expect(403);
    });

    it('cliente sem claim continua barrado', async () => {
        await api()
            .get('/api/v1/auth/me')
            .set(await bearer('customer'))
            .expect(403);
    });

    it('a equipe da plataforma segue acessando todas as empresas', async () => {
        const company = await createCompanyFixture(db());
        await api()
            .get('/api/v1/billing-plans')
            .set({ ...(await bearer('admin')), 'X-Tenant-Id': company.id })
            .expect(200);
        await api()
            .get('/api/v1/companies')
            .set(await bearer('billing'))
            .expect(200);
    });
});
