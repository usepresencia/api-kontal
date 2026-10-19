import { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformAccessEntity } from '@/domain/entities/platform-access.entity.js';
import { PlatformAccessPrismaRepository } from '@/infrastructure/persistence/platform-access.prisma.repository.js';
import type { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const access = PlatformAccessEntity.create({ userId: 'u1', role: PlatformRole.INTERNAL_ADMIN });
const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

function makeRepo(platformAccess: Record<string, ReturnType<typeof vi.fn>>) {
    return new PlatformAccessPrismaRepository({ platformAccess } as unknown as PrismaService);
}

describe('PlatformAccessPrismaRepository.createIfAbsent', () => {
    it('devolve true quando cria', async () => {
        const repo = makeRepo({ create: vi.fn().mockResolvedValue({}) });
        await expect(repo.createIfAbsent(access)).resolves.toBe(true);
    });

    it('devolve false em corrida (P2002)', async () => {
        const repo = makeRepo({ create: vi.fn().mockRejectedValue(p2002) });
        await expect(repo.createIfAbsent(access)).resolves.toBe(false);
    });

    it('propaga erro que não é P2002', async () => {
        const boom = new Error('db down');
        const repo = makeRepo({ create: vi.fn().mockRejectedValue(boom) });
        await expect(repo.createIfAbsent(access)).rejects.toBe(boom);
    });
});

describe('PlatformAccessPrismaRepository.findByUserId', () => {
    it('devolve null quando não existe', async () => {
        const repo = makeRepo({ findUnique: vi.fn().mockResolvedValue(null) });
        await expect(repo.findByUserId('u1')).resolves.toBeNull();
    });

    it('reidrata a entidade', async () => {
        const repo = makeRepo({
            findUnique: vi.fn().mockResolvedValue({ userId: 'u1', role: 'INTERNAL_BILLING' }),
        });
        const result = await repo.findByUserId('u1');
        expect(result?.role).toBe('INTERNAL_BILLING');
    });
});
