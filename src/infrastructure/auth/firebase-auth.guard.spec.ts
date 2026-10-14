import { FirebaseAuthGuard } from '@/infrastructure/auth/firebase-auth.guard.js';
import { fakeReflector, makeContext } from '@test/support/execution-context.js';

describe('FirebaseAuthGuard', () => {
    it('libera rotas @Public() sem acionar o Passport', () => {
        const guard = new FirebaseAuthGuard(fakeReflector({ isPublic: true }));
        expect(guard.canActivate(makeContext().ctx)).toBe(true);
    });
});
