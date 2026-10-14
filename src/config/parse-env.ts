import { type Env, envSchema } from '@/config/env.schema.js';

/**
 * Valida as variáveis de ambiente e converte `\n` literais da chave privada em quebras de linha.
 * @throws Error `Invalid environment: <var>: <motivo>; ...`
 */
export function parseEnv(env: Record<string, unknown> = process.env): Env {
    const privateKey = env.FIREBASE_PRIVATE_KEY;
    const parsed = envSchema.safeParse({
        ...env,
        FIREBASE_PRIVATE_KEY:
            typeof privateKey === 'string' ? privateKey.replace(/\\n/g, '\n') : privateKey,
    });
    if (!parsed.success) {
        const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Invalid environment: ${msg}`);
    }
    return parsed.data;
}
