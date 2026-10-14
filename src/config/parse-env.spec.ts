import { parseEnv } from '@/config/parse-env.js';

const valid = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    FIREBASE_PROJECT_ID: 'proj',
    FIREBASE_CLIENT_EMAIL: 'svc@proj.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'KEY',
};

describe('parseEnv', () => {
    it('aplica os defaults', () => {
        const env = parseEnv(valid);
        expect(env.NODE_ENV).toBe('development');
        expect(env.PORT).toBe(3333);
        expect(env.PG_POOL_MAX).toBe(10);
        expect(env.CORS_ALLOWED_ORIGINS).toBeUndefined();
    });

    it('converte PORT e PG_POOL_MAX para número', () => {
        const env = parseEnv({ ...valid, PORT: '4000', PG_POOL_MAX: '20' });
        expect(env.PORT).toBe(4000);
        expect(env.PG_POOL_MAX).toBe(20);
    });

    it.each([
        'DATABASE_URL',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
    ])('falha citando %s quando ausente', key => {
        const rest: Record<string, string> = { ...valid };
        delete rest[key];
        expect(() => parseEnv(rest)).toThrow(new RegExp(`Invalid environment:.*${key}`));
    });

    it('converte \\n literais da chave privada em quebras de linha', () => {
        const env = parseEnv({ ...valid, FIREBASE_PRIVATE_KEY: 'linha1\\nlinha2' });
        expect(env.FIREBASE_PRIVATE_KEY).toBe('linha1\nlinha2');
    });

    it('rejeita NODE_ENV inválido', () => {
        expect(() => parseEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    });
});
