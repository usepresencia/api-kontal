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

describe('parseEnv: Cloudinary', () => {
    const cloudinary = {
        CLOUDINARY_CLOUD_NAME: 'demo-cloud',
        CLOUDINARY_API_KEY: '123456789012345',
        CLOUDINARY_API_SECRET: 'segredo',
    };

    it('aceita nenhuma das três variáveis', () => {
        const env = parseEnv(valid);
        expect(env.CLOUDINARY_CLOUD_NAME).toBeUndefined();
        expect(env.CLOUDINARY_API_KEY).toBeUndefined();
        expect(env.CLOUDINARY_API_SECRET).toBeUndefined();
    });

    it('aceita as três variáveis', () => {
        const env = parseEnv({ ...valid, ...cloudinary });
        expect(env.CLOUDINARY_CLOUD_NAME).toBe('demo-cloud');
        expect(env.CLOUDINARY_API_SECRET).toBe('segredo');
    });

    it.each([
        ['só o cloud name', ['CLOUDINARY_CLOUD_NAME']],
        ['só a api key', ['CLOUDINARY_API_KEY']],
        ['cloud name e api key', ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY']],
        ['api key e secret', ['CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']],
    ])('falha quando há %s sem as demais', (_label, keys) => {
        const partial = Object.fromEntries(
            keys.map(key => [key, cloudinary[key as keyof typeof cloudinary]]),
        );
        expect(() => parseEnv({ ...valid, ...partial })).toThrow(/CLOUDINARY/);
    });

    it('trata string vazia como variável ausente', () => {
        const env = parseEnv({
            ...valid,
            CLOUDINARY_CLOUD_NAME: '',
            CLOUDINARY_API_KEY: '',
            CLOUDINARY_API_SECRET: '',
        });
        expect(env.CLOUDINARY_CLOUD_NAME).toBeUndefined();
    });
});

describe('parseEnv: PROVISIONING_API_KEY', () => {
    it('é opcional e vazia vale como ausente', () => {
        expect(parseEnv(valid).PROVISIONING_API_KEY).toBeUndefined();
        expect(
            parseEnv({ ...valid, PROVISIONING_API_KEY: '' }).PROVISIONING_API_KEY,
        ).toBeUndefined();
    });

    it('aceita a chave com 32 caracteres ou mais', () => {
        const key = 'k'.repeat(32);
        expect(parseEnv({ ...valid, PROVISIONING_API_KEY: key }).PROVISIONING_API_KEY).toBe(key);
    });

    it('recusa chave curta', () => {
        expect(() => parseEnv({ ...valid, PROVISIONING_API_KEY: 'curta' })).toThrow(
            /PROVISIONING_API_KEY/,
        );
    });
});
