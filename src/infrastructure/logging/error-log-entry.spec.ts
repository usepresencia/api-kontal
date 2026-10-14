import type { ApiErrorLogInput } from '@/infrastructure/logging/error-log.types.js';
import { buildErrorLogEntry } from '@/infrastructure/logging/error-log-entry.js';

const base: ApiErrorLogInput = {
    correlationId: 'abc12345',
    message: 'boom',
    code: 'INTERNAL_ERROR',
    status: 500,
    method: 'GET',
    path: '/api/v1/x',
};
const now = new Date('2026-10-14T12:00:00.000Z');

describe('buildErrorLogEntry', () => {
    it('monta a entrada com module api-kontal, empresa e contexto', () => {
        const entry = buildErrorLogEntry(
            { ...base, companyId: 'c1', userUid: 'uid1', route: '/x' },
            'Padaria',
            now,
        );
        expect(entry).toMatchObject({
            level: 'error',
            source: 'api',
            module: 'api-kontal',
            correlationId: 'abc12345',
            tenantId: 'c1',
            tenantName: 'Padaria',
            userUid: 'uid1',
            timestamp: '2026-10-14T12:00:00.000Z',
            savedAt: '2026-10-14T12:00:00.000Z',
            context: { method: 'GET', route: '/x', url: '/api/v1/x', status: 500 },
        });
    });

    it('não inclui campos undefined, nem no contexto', () => {
        const entry = buildErrorLogEntry(base, undefined, now);
        expect(Object.values(entry)).not.toContain(undefined);
        expect(Object.values(entry.context as object)).not.toContain(undefined);
        expect(entry).not.toHaveProperty('tenantId');
    });

    it('trunca mensagem (2000) e stack (8000)', () => {
        const entry = buildErrorLogEntry(
            { ...base, message: 'm'.repeat(3000), stack: 's'.repeat(9000) },
            undefined,
            now,
        );
        expect((entry.message as string).length).toBe(2000);
        expect((entry.stack as string).length).toBe(8000);
    });
});
