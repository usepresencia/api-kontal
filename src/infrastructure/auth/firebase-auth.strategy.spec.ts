import { UnauthorizedException } from '@nestjs/common';
import type { SessionUser } from '@/domain/auth/session-user.js';
import type { UserEntity } from '@/domain/entities/user.entity.js';
import { FirebaseAuthStrategy } from '@/infrastructure/auth/firebase-auth.strategy.js';
import type { FirebaseTokenVerifier } from '@/infrastructure/auth/firebase-token.verifier.js';
import type { PlatformRoleResolver } from '@/infrastructure/auth/platform-role.resolver.js';
import type { SessionUserAssembler } from '@/infrastructure/auth/session-user.assembler.js';
import type { UserProvisioner } from '@/infrastructure/auth/user-provisioner.js';

const verifier = { verify: vi.fn() };
const provisioner = { provision: vi.fn() };
const platformRoles = { resolve: vi.fn() };
const assembler = { assemble: vi.fn() };

const strategy = new FirebaseAuthStrategy(
    verifier as unknown as FirebaseTokenVerifier,
    provisioner as unknown as UserProvisioner,
    platformRoles as unknown as PlatformRoleResolver,
    assembler as unknown as SessionUserAssembler,
);

const decoded = { uid: 'fb1', email: 'a@kontal.com', platformRole: 'INTERNAL_ADMIN' };
const user = { id: 'u1' } as UserEntity;
const session = { userId: 'u1' } as SessionUser;
const withBearer = { headers: { authorization: 'Bearer tok' } };

beforeEach(() => {
    verifier.verify.mockReset().mockResolvedValue(decoded);
    provisioner.provision.mockReset().mockResolvedValue(user);
    platformRoles.resolve.mockReset().mockResolvedValue('INTERNAL_ADMIN');
    assembler.assemble.mockReset().mockResolvedValue(session);
});

describe('FirebaseAuthStrategy', () => {
    it('orquestra token → usuário → papel → sessão e devolve o SessionUser', async () => {
        await expect(strategy.validate(withBearer)).resolves.toBe(session);
        expect(verifier.verify).toHaveBeenCalledWith('tok');
        expect(provisioner.provision).toHaveBeenCalledWith(decoded);
        expect(platformRoles.resolve).toHaveBeenCalledWith('u1', 'INTERNAL_ADMIN');
        expect(assembler.assemble).toHaveBeenCalledWith(user, 'INTERNAL_ADMIN');
    });

    it('401 sem header Authorization, sem chamar o Firebase', async () => {
        await expect(strategy.validate({ headers: {} })).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
        expect(verifier.verify).not.toHaveBeenCalled();
    });

    it('não provisiona nada quando a verificação do token falha', async () => {
        verifier.verify.mockRejectedValue(new UnauthorizedException());
        await expect(strategy.validate(withBearer)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(provisioner.provision).not.toHaveBeenCalled();
    });

    it('não resolve papel quando o provisionamento falha', async () => {
        provisioner.provision.mockRejectedValue(new Error('db down'));
        await expect(strategy.validate(withBearer)).rejects.toThrow('db down');
        expect(platformRoles.resolve).not.toHaveBeenCalled();
    });
});
