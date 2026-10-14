import { bearer, useTestApp } from '@test/e2e/support/app.js';

const { api, db } = useTestApp();

describe('healthcheck e formato de erro', () => {
    it('GET /api/v1/health é público e devolve o correlation id', async () => {
        const res = await api().get('/api/v1/health').expect(200);
        expect(res.body).toEqual({ status: 'ok' });
        expect(res.headers['x-correlation-id']).toBeDefined();
    });

    it('reaproveita o x-correlation-id seguro enviado pelo cliente', async () => {
        const res = await api().get('/api/v1/health').set('x-correlation-id', 'abc12345-XYZ');
        expect(res.headers['x-correlation-id']).toBe('abc12345-XYZ');
    });

    it('substitui um x-correlation-id inseguro', async () => {
        const res = await api().get('/api/v1/health').set('x-correlation-id', 'a b/../c');
        expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('401 sem token traz code e correlationId', async () => {
        const res = await api().get('/api/v1/auth/me').expect(401);
        expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
        expect(res.body.correlationId).toBe(res.headers['x-correlation-id']);
    });

    it('401 com token que o Auth Emulator rejeita', async () => {
        await api().get('/api/v1/auth/me').set('Authorization', 'Bearer lixo').expect(401);
    });

    it('401 quando o token válido não tem e-mail, sem criar usuário', async () => {
        await api()
            .get('/api/v1/auth/me')
            .set(await bearer('noemail'))
            .expect(401);
        expect(await db().user.count()).toBe(0);
    });
});
