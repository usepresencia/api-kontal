import type { Request } from 'express';
import { buildErrorLogInput } from '@/presentation/errors/error-log-input.builder.js';

const makeRequest = (extra: Record<string, unknown> = {}) =>
    ({
        method: 'GET',
        path: '/api/v1/x',
        headers: {},
        ...extra,
    }) as unknown as Request;

describe('buildErrorLogInput', () => {
    it('extrai empresa, usuário e rota da requisição', () => {
        const input = buildErrorLogInput(
            new Error('boom'),
            makeRequest({
                headers: { 'x-tenant-id': 'c1' },
                user: { firebaseUid: 'uid1' },
                route: { path: '/x' },
            }),
            500,
            'INTERNAL_ERROR',
            'corr-12345678',
        );
        expect(input).toMatchObject({
            correlationId: 'corr-12345678',
            message: 'boom',
            code: 'INTERNAL_ERROR',
            status: 500,
            method: 'GET',
            route: '/x',
            path: '/api/v1/x',
            companyId: 'c1',
            userUid: 'uid1',
        });
        expect(input.stack).toContain('boom');
    });

    it.each([[undefined], [''], [['a', 'b']]])(
        'companyId fica undefined quando o header é %j',
        header => {
            const input = buildErrorLogInput(
                new Error('x'),
                makeRequest({ headers: { 'x-tenant-id': header } }),
                500,
                'INTERNAL_ERROR',
                'corr-12345678',
            );
            expect(input.companyId).toBeUndefined();
        },
    );

    it('usa String() e não tem stack quando o valor lançado não é Error', () => {
        const input = buildErrorLogInput(
            'texto solto',
            makeRequest(),
            500,
            'INTERNAL_ERROR',
            'corr-12345678',
        );
        expect(input.message).toBe('texto solto');
        expect(input.stack).toBeUndefined();
    });
});
