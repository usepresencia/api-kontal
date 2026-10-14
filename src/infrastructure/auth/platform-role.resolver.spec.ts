import { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformAccessEntity } from '@/domain/entities/platform-access.entity.js';
import type { IPlatformAccessRepository } from '@/domain/repositories/platform-access.repository.interface.js';
import { PlatformRoleResolver } from '@/infrastructure/auth/platform-role.resolver.js';

const platformAccess = {
    findByUserId: vi.fn(),
    createIfAbsent: vi.fn(),
} satisfies IPlatformAccessRepository;
const resolver = new PlatformRoleResolver(platformAccess);
const access = (role: PlatformRole) => PlatformAccessEntity.create({ userId: 'u1', role });

beforeEach(() => {
    platformAccess.findByUserId.mockReset().mockResolvedValue(null);
    platformAccess.createIfAbsent.mockReset().mockResolvedValue(true);
});

describe('PlatformRoleResolver', () => {
    it('sem registro e sem claim → null', async () => {
        await expect(resolver.resolve('u1', undefined)).resolves.toBeNull();
        expect(platformAccess.createIfAbsent).not.toHaveBeenCalled();
    });

    it('o registro persistido vence a claim', async () => {
        platformAccess.findByUserId.mockResolvedValue(access(PlatformRole.INTERNAL_BILLING));
        await expect(resolver.resolve('u1', 'INTERNAL_ADMIN')).resolves.toBe('INTERNAL_BILLING');
        expect(platformAccess.createIfAbsent).not.toHaveBeenCalled();
    });

    it('claim válida provisiona o PlatformAccess', async () => {
        await expect(resolver.resolve('u1', 'INTERNAL_ADMIN')).resolves.toBe('INTERNAL_ADMIN');
        expect(platformAccess.createIfAbsent).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u1', role: 'INTERNAL_ADMIN' }),
        );
    });

    it.each([['SUPERUSER'], [42], [null], [{}]])('ignora claim inválida %j', async claim => {
        await expect(resolver.resolve('u1', claim)).resolves.toBeNull();
        expect(platformAccess.createIfAbsent).not.toHaveBeenCalled();
    });

    it('em corrida (createIfAbsent=false) relê e usa o papel persistido', async () => {
        platformAccess.createIfAbsent.mockResolvedValue(false);
        platformAccess.findByUserId
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(access(PlatformRole.INTERNAL_BILLING));
        await expect(resolver.resolve('u1', 'INTERNAL_ADMIN')).resolves.toBe('INTERNAL_BILLING');
    });

    it('em corrida sem registro na releitura, cai na claim', async () => {
        platformAccess.createIfAbsent.mockResolvedValue(false);
        await expect(resolver.resolve('u1', 'INTERNAL_ADMIN')).resolves.toBe('INTERNAL_ADMIN');
    });
});
