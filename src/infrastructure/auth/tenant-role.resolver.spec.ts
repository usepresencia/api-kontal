import { MembershipRole } from '@/domain/auth/membership-role.js';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import { CompanyEntity } from '@/domain/entities/company.entity.js';
import { MembershipEntity } from '@/domain/entities/membership.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import type { IMembershipRepository } from '@/domain/repositories/membership.repository.interface.js';
import { TenantRoleResolver } from '@/infrastructure/auth/tenant-role.resolver.js';

const memberships = {
    findByUserAndCompany: vi.fn(),
    findActiveByUserId: vi.fn(),
} satisfies IMembershipRepository;
const companies = { findById: vi.fn(), findAllActive: vi.fn() } satisfies ICompanyRepository;
const resolver = new TenantRoleResolver(memberships, companies);

const platformUser = (platformRole: PlatformRole) =>
    ({ userId: 'u1', isPlatformUser: true, platformRole }) as SessionUser;
const regularUser = { userId: 'u1', isPlatformUser: false } as SessionUser;
const member = (role: MembershipRole, isActive = true) =>
    MembershipEntity.create({ id: 'm1', companyId: 'c1', userId: 'u1', role, isActive });

beforeEach(() => {
    memberships.findByUserAndCompany.mockReset().mockResolvedValue(null);
    companies.findById
        .mockReset()
        .mockResolvedValue(CompanyEntity.create({ id: 'c1', name: 'Padaria' }));
});

describe('TenantRoleResolver: platform users', () => {
    it('INTERNAL_ADMIN assume OWNER', async () => {
        await expect(
            resolver.resolve(platformUser(PlatformRole.INTERNAL_ADMIN), 'c1'),
        ).resolves.toBe(MembershipRole.OWNER);
    });

    it('INTERNAL_BILLING assume SUPPORT', async () => {
        await expect(
            resolver.resolve(platformUser(PlatformRole.INTERNAL_BILLING), 'c1'),
        ).resolves.toBe(MembershipRole.SUPPORT);
    });

    it('o mapeamento de plataforma vale mesmo com membership real diferente', async () => {
        memberships.findByUserAndCompany.mockResolvedValue(member(MembershipRole.ACCOUNTANT));
        await expect(
            resolver.resolve(platformUser(PlatformRole.INTERNAL_ADMIN), 'c1'),
        ).resolves.toBe(MembershipRole.OWNER);
        expect(memberships.findByUserAndCompany).not.toHaveBeenCalled();
    });

    it('404 COMPANY_NOT_FOUND quando a empresa não existe', async () => {
        companies.findById.mockResolvedValue(null);
        await expect(
            resolver.resolve(platformUser(PlatformRole.INTERNAL_ADMIN), 'nope'),
        ).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
    });

    it.each([PlatformRole.INTERNAL_SUPPORT, PlatformRole.COPYWRITE])(
        '%s é recusado sem sondar a existência da empresa',
        async role => {
            await expect(resolver.resolve(platformUser(role), 'c1')).rejects.toBeInstanceOf(
                DomainError,
            );
            expect(companies.findById).not.toHaveBeenCalled();
        },
    );
});

describe('TenantRoleResolver: usuários com membership', () => {
    it('devolve o papel da membership ativa', async () => {
        memberships.findByUserAndCompany.mockResolvedValue(member(MembershipRole.ACCOUNTANT));
        await expect(resolver.resolve(regularUser, 'c1')).resolves.toBe(MembershipRole.ACCOUNTANT);
    });

    it('403 FORBIDDEN sem membership', async () => {
        await expect(resolver.resolve(regularUser, 'c1')).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });

    it('403 FORBIDDEN com membership inativa', async () => {
        memberships.findByUserAndCompany.mockResolvedValue(member(MembershipRole.OWNER, false));
        await expect(resolver.resolve(regularUser, 'c1')).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });
});
