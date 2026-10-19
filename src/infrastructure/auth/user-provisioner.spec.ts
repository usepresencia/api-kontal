import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserEntity } from '@/domain/entities/user.entity.js';
import type { IUserRepository } from '@/domain/repositories/user.repository.interface.js';
import { UserProvisioner } from '@/infrastructure/auth/user-provisioner.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

const users = { findOrCreate: vi.fn() } satisfies IUserRepository;
const provisioner = new UserProvisioner(users);
const token = (claims: Record<string, unknown>) =>
    ({ uid: 'fb1', ...claims }) as unknown as DecodedIdToken;

beforeEach(() => {
    users.findOrCreate.mockReset().mockImplementation(async (candidate: UserEntity) => candidate);
});

describe('UserProvisioner', () => {
    it('cria o usuário a partir das claims do token', async () => {
        const user = await provisioner.provision(
            token({ email: 'Ana@Kontal.com', name: 'Ana', picture: 'http://x/a.png' }),
        );
        expect(user).toMatchObject({
            firebaseUid: 'fb1',
            email: 'ana@kontal.com',
            name: 'Ana',
            avatarUrl: 'http://x/a.png',
        });
        expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('usa a parte local do e-mail como nome quando o token não tem name', async () => {
        const user = await provisioner.provision(token({ email: 'joao@kontal.com' }));
        expect(user.name).toBe('joao');
    });

    it('usa "User" quando a parte local do e-mail é vazia', async () => {
        const user = await provisioner.provision(token({ email: '@kontal.com' }));
        expect(user.name).toBe('User');
    });

    it('guarda o telefone do token', async () => {
        const user = await provisioner.provision(
            token({ email: 'a@kontal.com', phone_number: '+5511999999999' }),
        );
        expect(user.phone).toBe('+5511999999999');
    });

    it('401 UNAUTHORIZED quando o token não traz e-mail, sem tocar no repositório', async () => {
        const error = await provisioner.provision(token({})).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(CodedHttpException);
        expect(error).toMatchObject({ code: 'UNAUTHORIZED' });
        expect(users.findOrCreate).not.toHaveBeenCalled();
    });

    it('devolve o usuário que o repositório resolver (existente ou vencedor da corrida)', async () => {
        const existing = { id: 'u-db' } as UserEntity;
        users.findOrCreate.mockResolvedValue(existing);
        await expect(provisioner.provision(token({ email: 'a@kontal.com' }))).resolves.toBe(
            existing,
        );
    });
});
