import { firebaseAuth } from '@/infrastructure/auth/firebase.config.js';
import { useTestApp } from '@test/e2e/support/app.js';
import { emulatorTokenForUid } from '@test/e2e/support/firebase-emulator.js';
import { createCompanyFixture, createPlanFixture } from '@test/e2e/support/fixtures.js';

const { api, db } = useTestApp();
const KEY = 'e2e-provisioning-key-0123456789abcdef';
const keyHeader = { 'X-Service-Key': KEY };
const UNKNOWN = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

const grantBody = (companyId: string, overrides: Record<string, unknown> = {}) => ({
    eventId: 'evt-grant-1',
    email: 'Novo.Usuario@Presencia.test',
    name: 'Novo Usuário',
    companyId,
    role: 'OWNER',
    ...overrides,
});

describe('provisionamento de acesso (chave de serviço)', () => {
    it('401 sem a chave ou com chave errada, e nada é criado', async () => {
        const company = await createCompanyFixture(db());
        await api().post('/api/v1/provisioning/access').send(grantBody(company.id)).expect(401);
        await api()
            .post('/api/v1/provisioning/access')
            .set({ 'X-Service-Key': 'x'.repeat(32) })
            .send(grantBody(company.id))
            .expect(401);
        expect(await db().provisioning.count()).toBe(0);
        await expect(
            firebaseAuth().getUserByEmail('novo.usuario@presencia.test'),
        ).rejects.toMatchObject({ code: 'auth/user-not-found' });
    });

    it('cria a conta, grava a claim e o usuário entra na empresa no primeiro login', async () => {
        const company = await createCompanyFixture(db(), { name: 'Presencia Ltda' });
        await createPlanFixture(db(), company.id, { name: 'Plano' });

        const res = await api()
            .post('/api/v1/provisioning/access')
            .set(keyHeader)
            .send(grantBody(company.id))
            .expect(200);
        expect(res.body).toEqual({ alreadyProcessed: false });

        const account = await firebaseAuth().getUserByEmail('novo.usuario@presencia.test');
        expect(account.displayName).toBe('Novo Usuário');
        expect(account.customClaims?.kontalMemberships).toEqual([
            { companyId: company.id, role: 'OWNER' },
        ]);
        expect(await db().provisioning.findUnique({ where: { id: 'evt-grant-1' } })).toMatchObject({
            action: 'GRANT',
            status: 'DONE',
            email: 'novo.usuario@presencia.test',
            companyId: company.id,
            role: 'OWNER',
        });

        const headers = { Authorization: `Bearer ${await emulatorTokenForUid(account.uid)}` };
        const session = await api().post('/api/v1/auth/session').set(headers).expect(200);
        expect(session.body.memberships).toMatchObject([
            { companyId: company.id, companyName: 'Presencia Ltda', role: 'OWNER' },
        ]);
        await api()
            .get('/api/v1/billing-plans')
            .set({ ...headers, 'X-Tenant-Id': company.id })
            .expect(200);
    });

    it('é idempotente: repetir o evento não refaz nada', async () => {
        const company = await createCompanyFixture(db());
        await api()
            .post('/api/v1/provisioning/access')
            .set(keyHeader)
            .send(grantBody(company.id))
            .expect(200);
        const again = await api()
            .post('/api/v1/provisioning/access')
            .set(keyHeader)
            .send(grantBody(company.id, { role: 'SUPPORT' }))
            .expect(200);
        expect(again.body).toEqual({ alreadyProcessed: true });
        const account = await firebaseAuth().getUserByEmail('novo.usuario@presencia.test');
        expect(account.customClaims?.kontalMemberships).toEqual([
            { companyId: company.id, role: 'OWNER' },
        ]);
        expect(await db().provisioning.count()).toBe(1);
    });

    it('preserva as outras claims e as outras empresas da conta', async () => {
        const first = await createCompanyFixture(db());
        const second = await createCompanyFixture(db());
        await firebaseAuth().createUser({ uid: 'uid-existing', email: 'existente@presencia.test' });
        await firebaseAuth().setCustomUserClaims('uid-existing', {
            platformRole: 'INTERNAL_BILLING',
            activationCompleted: true,
        });
        for (const [i, company] of [first, second].entries()) {
            await api()
                .post('/api/v1/provisioning/access')
                .set(keyHeader)
                .send(
                    grantBody(company.id, {
                        eventId: `evt-${i}`,
                        email: 'existente@presencia.test',
                    }),
                )
                .expect(200);
        }
        const claims = (await firebaseAuth().getUser('uid-existing')).customClaims;
        expect(claims).toMatchObject({
            platformRole: 'INTERNAL_BILLING',
            activationCompleted: true,
        });
        expect(claims?.kontalMemberships).toHaveLength(2);
    });

    it('revogar tira a empresa da claim e o acesso some no próximo login', async () => {
        const company = await createCompanyFixture(db());
        await api()
            .post('/api/v1/provisioning/access')
            .set(keyHeader)
            .send(grantBody(company.id))
            .expect(200);
        const account = await firebaseAuth().getUserByEmail('novo.usuario@presencia.test');
        const first = { Authorization: `Bearer ${await emulatorTokenForUid(account.uid)}` };
        await api().get('/api/v1/auth/me').set(first).expect(200);

        const res = await api()
            .post('/api/v1/provisioning/access/revoke')
            .set(keyHeader)
            .send({
                eventId: 'evt-revoke-1',
                email: 'novo.usuario@presencia.test',
                companyId: company.id,
            })
            .expect(200);
        expect(res.body).toEqual({ alreadyProcessed: false });
        expect((await firebaseAuth().getUser(account.uid)).customClaims?.kontalMemberships).toEqual(
            [],
        );

        const second = { Authorization: `Bearer ${await emulatorTokenForUid(account.uid)}` };
        await api().get('/api/v1/auth/me').set(second).expect(403);
        expect(
            await db().membership.count({ where: { companyId: company.id, isActive: true } }),
        ).toBe(0);
    });

    it('revogar conta inexistente não é erro', async () => {
        const company = await createCompanyFixture(db());
        await api()
            .post('/api/v1/provisioning/access/revoke')
            .set(keyHeader)
            .send({ eventId: 'evt-r', email: 'ninguem@presencia.test', companyId: company.id })
            .expect(200);
    });

    it('404 para empresa inexistente, sem criar a conta no Firebase', async () => {
        const res = await api()
            .post('/api/v1/provisioning/access')
            .set(keyHeader)
            .send(grantBody(UNKNOWN))
            .expect(404);
        expect(res.body).toMatchObject({ code: 'COMPANY_NOT_FOUND' });
        expect(
            await firebaseAuth()
                .getUserByEmail('novo.usuario@presencia.test')
                .catch(() => null),
        ).toBeNull();
    });

    it('400 para corpo inválido', async () => {
        const company = await createCompanyFixture(db());
        for (const body of [
            grantBody(company.id, { email: 'nao-e-email' }),
            grantBody(company.id, { role: 'ADMIN' }),
            grantBody(company.id, { companyId: 'abc' }),
            { ...grantBody(company.id), eventId: '' },
        ]) {
            await api().post('/api/v1/provisioning/access').set(keyHeader).send(body).expect(400);
        }
    });
});
