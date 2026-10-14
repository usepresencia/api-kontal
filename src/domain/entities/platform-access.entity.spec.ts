import { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformAccessEntity } from '@/domain/entities/platform-access.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

describe('PlatformAccessEntity', () => {
    it('cria com userId e papel', () => {
        const access = PlatformAccessEntity.create({
            userId: 'u1',
            role: PlatformRole.INTERNAL_ADMIN,
        });
        expect(access.role).toBe('INTERNAL_ADMIN');
    });

    it('exige userId', () => {
        expect(() =>
            PlatformAccessEntity.create({ userId: '', role: PlatformRole.INTERNAL_ADMIN }),
        ).toThrow(DomainError);
    });
});
