import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema.js';
import { ServiceKeyGuard } from '@/infrastructure/auth/service-key.guard.js';
import { makeContext } from '@test/support/execution-context.js';

const KEY = 'k'.repeat(32);
const guardWith = (key: string | undefined) =>
    new ServiceKeyGuard({ get: () => key } as unknown as ConfigService<Env, true>);

describe('ServiceKeyGuard', () => {
    it('libera a chave correta', () => {
        const { ctx } = makeContext({ headers: { 'x-service-key': KEY } });
        expect(guardWith(KEY).canActivate(ctx)).toBe(true);
    });

    it.each([
        ['ausente', {}],
        ['errada', { 'x-service-key': 'x'.repeat(32) }],
        ['com tamanho diferente', { 'x-service-key': 'curta' }],
        ['repetida', { 'x-service-key': [KEY, KEY] }],
    ])('401 UNAUTHORIZED com chave %s', (_label, headers) => {
        const { ctx } = makeContext({ headers });
        expect(() => guardWith(KEY).canActivate(ctx)).toThrow(
            expect.objectContaining({ code: 'UNAUTHORIZED' }),
        );
    });

    it('503 PROVISIONING_DISABLED quando o ambiente não define a chave', () => {
        const { ctx } = makeContext({ headers: { 'x-service-key': KEY } });
        expect(() => guardWith(undefined).canActivate(ctx)).toThrow(
            expect.objectContaining({ code: 'PROVISIONING_DISABLED' }),
        );
    });
});
