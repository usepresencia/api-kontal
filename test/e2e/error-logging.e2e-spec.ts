import { firebaseFirestore } from '@/infrastructure/auth/firebase.config.js';
import { bearer, useTestApp } from '@test/e2e/support/app.js';
import { createCompanyFixture } from '@test/e2e/support/fixtures.js';
import { waitFor } from '@test/e2e/support/wait-for.js';

const { api, db } = useTestApp();

describe('log de erros 5xx no Firestore Emulator', () => {
    beforeEach(async () => {
        await createCompanyFixture(db(), { id: 'c1', name: 'Padaria' });
    });

    it('responde 500 genérico e grava a entrada com empresa, usuário e contexto', async () => {
        const res = await api()
            .get('/api/v1/probe/boom')
            .set(await bearer('admin'))
            .set('X-Tenant-Id', 'c1')
            .set('x-correlation-id', 'log-test-12345')
            .expect(500);
        expect(res.body).toMatchObject({
            code: 'INTERNAL_ERROR',
            correlationId: 'log-test-12345',
            message: 'Erro interno no servidor',
        });
        expect(JSON.stringify(res.body)).not.toContain('falha de teste');

        await waitFor(async () => {
            const snap = await firebaseFirestore()
                .collection('logs')
                .doc('log-test-12345')
                .collection('entries')
                .get();
            expect(snap.size).toBe(1);
            expect(snap.docs[0].data()).toMatchObject({
                module: 'api-kontal',
                code: 'INTERNAL_ERROR',
                message: 'falha de teste',
                tenantId: 'c1',
                tenantName: 'Padaria',
                userUid: 'uid-admin',
                context: expect.objectContaining({ status: 500, method: 'GET' }),
            });
        });
    });
});
