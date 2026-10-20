import { FirebaseAccountsAdapter } from '@/infrastructure/auth/firebase-accounts.adapter.js';

const A = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const auth = {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    getUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
};
vi.mock('@/infrastructure/auth/firebase.config.js', () => ({ firebaseAuth: () => auth }));

const adapter = new FirebaseAccountsAdapter();

beforeEach(() => {
    for (const fn of Object.values(auth)) fn.mockReset();
});

describe('FirebaseAccountsAdapter', () => {
    it('lê as empresas da claim kontalMemberships', async () => {
        auth.getUserByEmail.mockResolvedValue({
            uid: 'u1',
            customClaims: {
                platformRole: 'INTERNAL_ADMIN',
                kontalMemberships: [{ companyId: A, role: 'OWNER' }],
            },
        });
        await expect(adapter.findByEmail('a@b.c')).resolves.toEqual({
            uid: 'u1',
            memberships: [{ companyId: A, role: 'OWNER' }],
        });
    });

    it('conta sem claim volta com lista vazia', async () => {
        auth.getUserByEmail.mockResolvedValue({ uid: 'u1' });
        await expect(adapter.findByEmail('a@b.c')).resolves.toEqual({ uid: 'u1', memberships: [] });
    });

    it('conta inexistente volta null; outros erros sobem', async () => {
        auth.getUserByEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });
        await expect(adapter.findByEmail('a@b.c')).resolves.toBeNull();
        auth.getUserByEmail.mockRejectedValueOnce(new Error('rede'));
        await expect(adapter.findByEmail('a@b.c')).rejects.toThrow('rede');
    });

    it('cria a conta com o nome, quando informado', async () => {
        auth.createUser.mockResolvedValue({ uid: 'u2' });
        await adapter.create({ email: 'a@b.c', name: 'Ana' });
        expect(auth.createUser).toHaveBeenCalledWith({ email: 'a@b.c', displayName: 'Ana' });
        await adapter.create({ email: 'a@b.c' });
        expect(auth.createUser).toHaveBeenLastCalledWith({ email: 'a@b.c' });
    });

    it('grava a claim preservando as outras claims da conta', async () => {
        auth.getUser.mockResolvedValue({
            uid: 'u1',
            customClaims: { platformRole: 'INTERNAL_BILLING', activationCompleted: true },
        });
        await adapter.setMemberships('u1', [{ companyId: A, role: 'OWNER' }]);
        expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', {
            platformRole: 'INTERNAL_BILLING',
            activationCompleted: true,
            kontalMemberships: [{ companyId: A, role: 'OWNER' }],
        });
    });
});
