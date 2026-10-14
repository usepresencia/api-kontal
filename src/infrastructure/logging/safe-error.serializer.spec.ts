import { serializeError } from '@/infrastructure/logging/safe-error.serializer.js';

afterEach(() => vi.unstubAllEnvs());

describe('serializeError', () => {
    it('trata valor vazio', () => {
        expect(serializeError(undefined)).toEqual({
            name: 'UnknownError',
            message: 'No error information available',
        });
    });

    it('trunca string em 500 caracteres', () => {
        expect(serializeError('x'.repeat(800)).message).toHaveLength(500);
    });

    it('serializa Error com code e mantém o stack fora de produção', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const err = Object.assign(new Error('falhou'), { code: 'E_X' });
        const out = serializeError(err);
        expect(out).toMatchObject({ name: 'Error', message: 'falhou', code: 'E_X' });
        expect(out.stack).toBeDefined();
    });

    it('omite o stack em produção', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(serializeError(new Error('falhou')).stack).toBeUndefined();
    });

    it('remove campos sensíveis de objetos que não são Error', () => {
        const out = serializeError({
            message: 'x',
            config: { token: 'segredo' },
            Authorization: 'Bearer y',
        });
        expect(out.message).toBe('{"message":"x"}');
    });

    it('converte primitivos não-string', () => {
        expect(serializeError(42).message).toBe('42');
    });
});
