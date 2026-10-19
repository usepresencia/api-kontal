import { AuthController } from '@/presentation/auth/auth.controller.js';
import type { SessionUser } from '@/domain/auth/session-user.js';

const controller = new AuthController({} as never, {} as never);

const base = {
    userId: 'u1',
    firebaseUid: 'f1',
    email: 'a@b.com',
    name: 'Ana',
    avatarUrl: null,
    phone: null,
    memberships: [],
};

describe('AuthController.getMe', () => {
    it('informa o papel de plataforma do administrador', () => {
        const user = {
            ...base,
            isPlatformUser: true,
            platformRole: 'INTERNAL_ADMIN',
        } as SessionUser;
        expect(controller.getMe(user)).toMatchObject({
            isPlatformUser: true,
            platformRole: 'INTERNAL_ADMIN',
        });
    });

    it('devolve papel nulo para quem não é da plataforma', () => {
        const user = { ...base, isPlatformUser: false } as SessionUser;
        expect(controller.getMe(user)).toMatchObject({ isPlatformUser: false, platformRole: null });
    });
});
