import { MembershipRole } from '@/domain/auth/membership-role.js';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import { SessionService } from '@/application/auth/session.service.js';

const service = new SessionService();
const base = {
    userId: 'u1',
    firebaseUid: 'fb1',
    email: 'ana@kontal.com',
    name: 'Ana',
    avatarUrl: null,
    phone: null,
};

describe('SessionService.createSession', () => {
    it('devolve usuário, papel de plataforma e memberships de um platform user', () => {
        const user: SessionUser = {
            ...base,
            memberships: [],
            isPlatformUser: true,
            platformRole: PlatformRole.INTERNAL_ADMIN,
        };
        expect(service.createSession(user)).toEqual({
            user: { id: 'u1', email: 'ana@kontal.com', name: 'Ana', avatarUrl: null, phone: null },
            isPlatformUser: true,
            platformRole: 'INTERNAL_ADMIN',
            memberships: [],
        });
    });

    it('para usuário comum, platformRole é null e memberships trazem o nome da empresa', () => {
        const user: SessionUser = {
            ...base,
            isPlatformUser: false,
            memberships: [
                {
                    companyId: 'c1',
                    role: MembershipRole.ACCOUNTANT,
                    isActive: true,
                    company: { id: 'c1', name: 'Padaria' },
                },
            ],
        };
        const session = service.createSession(user);
        expect(session.isPlatformUser).toBe(false);
        expect(session.platformRole).toBeNull();
        expect(session.memberships).toEqual([
            { companyId: 'c1', companyName: 'Padaria', role: 'ACCOUNTANT', isActive: true },
        ]);
    });
});
