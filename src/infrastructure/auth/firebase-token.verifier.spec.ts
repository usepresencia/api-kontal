import { UnauthorizedException } from '@nestjs/common';
import { firebaseAuth } from '@/infrastructure/auth/firebase.config.js';
import { FirebaseTokenVerifier } from '@/infrastructure/auth/firebase-token.verifier.js';

vi.mock('@/infrastructure/auth/firebase.config.js', () => ({ firebaseAuth: vi.fn() }));

const verifyIdToken = vi.fn();
const verifier = new FirebaseTokenVerifier();

beforeEach(() => {
    verifyIdToken.mockReset();
    vi.mocked(firebaseAuth).mockReturnValue({ verifyIdToken } as never);
});

describe('FirebaseTokenVerifier', () => {
    it('devolve o token decodificado', async () => {
        verifyIdToken.mockResolvedValue({ uid: 'fb1' });
        await expect(verifier.verify('tok')).resolves.toEqual({ uid: 'fb1' });
        expect(verifyIdToken).toHaveBeenCalledWith('tok');
    });

    it('401 quando o Firebase rejeita o token (auth/*)', async () => {
        verifyIdToken.mockRejectedValue(
            Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }),
        );
        await expect(verifier.verify('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('propaga erro de infraestrutura sem convertê-lo em 401', async () => {
        const boom = new Error('network down');
        verifyIdToken.mockRejectedValue(boom);
        await expect(verifier.verify('tok')).rejects.toBe(boom);
    });

    it('propaga erro com code que não é de auth', async () => {
        const boom = Object.assign(new Error('x'), { code: 'app/network-error' });
        verifyIdToken.mockRejectedValue(boom);
        await expect(verifier.verify('tok')).rejects.toBe(boom);
    });

    it('propaga rejeição que não é Error', async () => {
        verifyIdToken.mockRejectedValue('texto');
        await expect(verifier.verify('tok')).rejects.toBe('texto');
    });
});
