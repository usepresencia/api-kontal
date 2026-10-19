import { bearer, useTestApp } from '@test/e2e/support/app.js';

const { api, db } = useTestApp();

describe('restrição ao staff permitido', () => {
    it('403 para cliente da Presencia (e o User dele é gravado — efeito colateral conhecido)', async () => {
        const res = await api()
            .get('/api/v1/auth/me')
            .set(await bearer('customer'))
            .expect(403);
        expect(res.body).toMatchObject({ code: 'FORBIDDEN' });
        expect(await db().user.count({ where: { firebaseUid: 'uid-customer' } })).toBe(1);
        expect(await db().platformAccess.count()).toBe(0);
    });

    it('403 para INTERNAL_SUPPORT', async () => {
        await api()
            .get('/api/v1/auth/me')
            .set(await bearer('support'))
            .expect(403);
    });

    it('INTERNAL_ADMIN acessa e é provisionado uma única vez', async () => {
        const first = await api()
            .get('/api/v1/auth/me')
            .set(await bearer('admin'))
            .expect(200);
        expect(first.body).toMatchObject({ firebaseUid: 'uid-admin', email: 'admin@kontal.test' });
        await api()
            .get('/api/v1/auth/me')
            .set(await bearer('admin'))
            .expect(200);
        expect(await db().user.count({ where: { firebaseUid: 'uid-admin' } })).toBe(1);
        expect(await db().platformAccess.count()).toBe(1);
    });

    it('POST /auth/session devolve 200 com o bootstrap', async () => {
        const res = await api()
            .post('/api/v1/auth/session')
            .set(await bearer('admin'))
            .expect(200);
        expect(res.body).toMatchObject({
            isPlatformUser: true,
            platformRole: 'INTERNAL_ADMIN',
            memberships: [],
            user: { email: 'admin@kontal.test', name: 'Admin' },
        });
    });
});
