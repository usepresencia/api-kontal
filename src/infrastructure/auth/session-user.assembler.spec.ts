import { CompanyEntity } from '@/domain/entities/company.entity.js';
import { MembershipEntity } from '@/domain/entities/membership.entity.js';
import { UserEntity } from '@/domain/entities/user.entity.js';
import type { IMembershipRepository } from '@/domain/repositories/membership.repository.interface.js';
import { SessionUserAssembler } from '@/infrastructure/auth/session-user.assembler.js';

const memberships = {
    findByUserAndCompany: vi.fn(),
    findActiveByUserId: vi.fn(),
} satisfies IMembershipRepository;
const assembler = new SessionUserAssembler(memberships);
const user = UserEntity.create({
    id: 'u1',
    firebaseUid: 'fb1',
    email: 'ana@kontal.com',
    name: 'Ana',
});

beforeEach(() => {
    memberships.findActiveByUserId.mockReset().mockResolvedValue([]);
});

describe('SessionUserAssembler', () => {
    it('usuário comum quando não há papel de plataforma', async () => {
        const session = await assembler.assemble(user, null);
        expect(session).toMatchObject({
            userId: 'u1',
            firebaseUid: 'fb1',
            email: 'ana@kontal.com',
            name: 'Ana',
            isPlatformUser: false,
            memberships: [],
        });
        expect(session.platformRole).toBeUndefined();
    });

    it('platform user quando há papel', async () => {
        const session = await assembler.assemble(user, 'INTERNAL_ADMIN');
        expect(session).toMatchObject({ isPlatformUser: true, platformRole: 'INTERNAL_ADMIN' });
    });

    it('mapeia as memberships ativas com a empresa', async () => {
        memberships.findActiveByUserId.mockResolvedValue([
            {
                membership: MembershipEntity.create({
                    id: 'm1',
                    companyId: 'c1',
                    userId: 'u1',
                    role: 'ACCOUNTANT',
                }),
                company: CompanyEntity.create({ id: 'c1', name: 'Padaria' }),
            },
        ]);
        const session = await assembler.assemble(user, null);
        expect(session.memberships).toEqual([
            {
                companyId: 'c1',
                role: 'ACCOUNTANT',
                isActive: true,
                company: { id: 'c1', name: 'Padaria' },
            },
        ]);
    });

    it('propaga erro de banco', async () => {
        memberships.findActiveByUserId.mockRejectedValue(new Error('db down'));
        await expect(assembler.assemble(user, null)).rejects.toThrow('db down');
    });
});
