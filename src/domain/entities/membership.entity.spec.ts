import { MembershipRole } from '@/domain/auth/membership-role.js';
import { MembershipEntity } from '@/domain/entities/membership.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

describe('MembershipEntity', () => {
    it('cria ativa por padrão', () => {
        const m = MembershipEntity.create({
            id: 'm1',
            companyId: 'c1',
            userId: 'u1',
            role: MembershipRole.OPERATIONAL,
        });
        expect(m.isActive).toBe(true);
        expect(m.role).toBe('OPERATIONAL');
    });

    it.each([
        ['companyId', { id: 'm1', companyId: '', userId: 'u1' }],
        ['userId', { id: 'm1', companyId: 'c1', userId: '' }],
    ])('exige %s', (_label, ids) => {
        expect(() => MembershipEntity.create({ ...ids, role: MembershipRole.OWNER })).toThrow(
            DomainError,
        );
    });
});
