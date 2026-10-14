import { MembershipRole } from '@/domain/auth/membership-role.js';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import { CompanyEntity } from '@/domain/entities/company.entity.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import { AccessibleCompaniesService } from '@/application/auth/accessible-companies.service.js';

const companies = { findById: vi.fn(), findAllActive: vi.fn() } satisfies ICompanyRepository;
const service = new AccessibleCompaniesService(companies);

const base = {
    userId: 'u1',
    firebaseUid: 'fb1',
    email: 'ana@kontal.com',
    name: 'Ana',
    avatarUrl: null,
    phone: null,
};
const platformUser = (platformRole: PlatformRole): SessionUser => ({
    ...base,
    memberships: [],
    isPlatformUser: true,
    platformRole,
});
const regularUser: SessionUser = {
    ...base,
    isPlatformUser: false,
    memberships: [
        {
            companyId: 'c1',
            role: MembershipRole.ACCOUNTANT,
            isActive: true,
            company: { id: 'c1', name: 'Padaria' },
        },
        {
            companyId: 'c2',
            role: MembershipRole.OWNER,
            isActive: false,
            company: { id: 'c2', name: 'Oficina' },
        },
    ],
};

beforeEach(() => {
    companies.findAllActive
        .mockReset()
        .mockResolvedValue([
            CompanyEntity.create({ id: 'c1', name: 'Padaria' }),
            CompanyEntity.create({ id: 'c3', name: 'Zeladoria' }),
        ]);
});

describe('AccessibleCompaniesService.list', () => {
    it('INTERNAL_ADMIN vê todas as empresas ativas como OWNER', async () => {
        const list = await service.list(platformUser(PlatformRole.INTERNAL_ADMIN));
        expect(list).toEqual([
            { companyId: 'c1', name: 'Padaria', role: 'OWNER', isActive: true },
            { companyId: 'c3', name: 'Zeladoria', role: 'OWNER', isActive: true },
        ]);
    });

    it('INTERNAL_BILLING vê todas as empresas ativas como SUPPORT', async () => {
        const list = await service.list(platformUser(PlatformRole.INTERNAL_BILLING));
        expect(list.every(c => c.role === 'SUPPORT')).toBe(true);
    });

    it('usuário comum vê só as memberships ativas, sem consultar todas as empresas', async () => {
        expect(await service.list(regularUser)).toEqual([
            { companyId: 'c1', name: 'Padaria', role: 'ACCOUNTANT', isActive: true },
        ]);
        expect(companies.findAllActive).not.toHaveBeenCalled();
    });

    it('papel de plataforma sem acesso ao Kontal lança DomainError FORBIDDEN', async () => {
        await expect(service.list(platformUser(PlatformRole.COPYWRITE))).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });
    });
});
