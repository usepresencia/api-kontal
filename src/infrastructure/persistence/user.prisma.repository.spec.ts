import { UserEntity } from '@/domain/entities/user.entity.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { UserPrismaRepository } from '@/infrastructure/persistence/user.prisma.repository.js';

const row = {
    id: 'u-db',
    firebaseUid: 'fb1',
    email: 'a@kontal.com',
    name: 'Ana',
    avatarUrl: null,
    phone: null,
    createdAt: new Date('2026-01-01'),
};
const candidate = UserEntity.create({
    id: 'u-new',
    firebaseUid: 'fb1',
    email: 'a@kontal.com',
    name: 'Ana',
});
const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

function makeRepo(user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
}) {
    return new UserPrismaRepository({ user } as unknown as PrismaService);
}

describe('UserPrismaRepository.findOrCreate', () => {
    it('devolve o usuário existente sem criar', async () => {
        const user = { findUnique: vi.fn().mockResolvedValue(row), create: vi.fn() };
        const result = await makeRepo(user).findOrCreate(candidate);
        expect(result.id).toBe('u-db');
        expect(user.create).not.toHaveBeenCalled();
    });

    it('cria quando não existe', async () => {
        const user = {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ ...row, id: 'u-new' }),
        };
        const result = await makeRepo(user).findOrCreate(candidate);
        expect(result.id).toBe('u-new');
        expect(user.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                id: 'u-new',
                firebaseUid: 'fb1',
                email: 'a@kontal.com',
            }),
        });
    });

    it('em corrida (P2002) relê e devolve o registro vencedor', async () => {
        const user = {
            findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row),
            create: vi.fn().mockRejectedValue(p2002),
        };
        const result = await makeRepo(user).findOrCreate(candidate);
        expect(result.id).toBe('u-db');
    });

    it('propaga erro que não é P2002', async () => {
        const boom = new Error('db down');
        const user = {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue(boom),
        };
        await expect(makeRepo(user).findOrCreate(candidate)).rejects.toBe(boom);
    });

    it('propaga o P2002 quando a releitura não encontra ninguém', async () => {
        const user = {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue(p2002),
        };
        await expect(makeRepo(user).findOrCreate(candidate)).rejects.toBe(p2002);
    });
});
