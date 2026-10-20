import { z } from 'zod';

/** Texto opcional em que string vazia equivale a variável ausente. */
const optionalText = z.preprocess(
    value => (value === '' ? undefined : value),
    z.string().min(1).optional(),
);

export const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
        PORT: z.coerce.number().default(3333),

        DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
        PG_POOL_MAX: z.coerce.number().default(10),

        FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
        FIREBASE_CLIENT_EMAIL: z.string().min(1, 'FIREBASE_CLIENT_EMAIL is required'),
        FIREBASE_PRIVATE_KEY: z.string().min(1, 'FIREBASE_PRIVATE_KEY is required'),

        /** Origens permitidas para CORS, separadas por vírgula. */
        CORS_ALLOWED_ORIGINS: z.string().optional(),

        /** Chave de serviço do provisionamento por outros sistemas; sem ela a rota fica desativada. */
        PROVISIONING_API_KEY: z.preprocess(
            value => (value === '' ? undefined : value),
            z
                .string()
                .min(32, 'PROVISIONING_API_KEY precisa ter ao menos 32 caracteres')
                .optional(),
        ),

        CLOUDINARY_CLOUD_NAME: optionalText,
        CLOUDINARY_API_KEY: optionalText,
        CLOUDINARY_API_SECRET: optionalText,
    })
    .refine(
        env => {
            const defined = [
                env.CLOUDINARY_CLOUD_NAME,
                env.CLOUDINARY_API_KEY,
                env.CLOUDINARY_API_SECRET,
            ].filter(Boolean).length;
            return defined === 0 || defined === 3;
        },
        {
            message:
                'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET devem ser definidas juntas',
            path: ['CLOUDINARY_CLOUD_NAME'],
        },
    );

export type Env = z.infer<typeof envSchema>;
