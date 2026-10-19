import type { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema.js';
import { initializeFirebase } from '@/infrastructure/auth/firebase.config.js';
import { FirebaseInitService } from '@/infrastructure/auth/firebase-init.service.js';

vi.mock('@/infrastructure/auth/firebase.config.js', () => ({ initializeFirebase: vi.fn() }));

const makeConfig = (values: Partial<Record<keyof Env, string>>) =>
    ({ get: (key: keyof Env) => values[key] }) as unknown as ConfigService<Env, true>;

beforeEach(() => vi.mocked(initializeFirebase).mockClear());

describe('FirebaseInitService', () => {
    it('inicializa o Firebase com a credencial normalizada', () => {
        new FirebaseInitService(
            makeConfig({
                FIREBASE_PROJECT_ID: 'proj',
                FIREBASE_CLIENT_EMAIL: 'svc@proj.iam.gserviceaccount.com',
                FIREBASE_PRIVATE_KEY:
                    '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
            }),
        ).onModuleInit();
        expect(initializeFirebase).toHaveBeenCalledWith(
            {
                projectId: 'proj',
                clientEmail: 'svc@proj.iam.gserviceaccount.com',
                privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
            },
            expect.anything(),
        );
    });

    it('não inicializa quando falta credencial', () => {
        new FirebaseInitService(makeConfig({ FIREBASE_PROJECT_ID: 'proj' })).onModuleInit();
        expect(initializeFirebase).not.toHaveBeenCalled();
    });
});
