import {
    MAX_CLAIM_COMPANIES,
    grantMembership,
    revokeMembership,
} from '@/domain/auth/kontal-memberships-claim.js';

const entry = (n: number, role: 'OWNER' | 'OPERATIONAL' = 'OWNER') => ({
    companyId: `company-${n}`,
    role,
});

describe('grantMembership', () => {
    it('inclui a empresa mantendo as outras', () => {
        expect(grantMembership([entry(1)], entry(2))).toEqual([entry(1), entry(2)]);
    });

    it('troca o papel da empresa que já estava na claim, sem duplicar', () => {
        expect(grantMembership([entry(1), entry(2)], entry(1, 'OPERATIONAL'))).toEqual([
            entry(2),
            entry(1, 'OPERATIONAL'),
        ]);
    });

    it('recusa passar do limite de empresas', () => {
        const full = Array.from({ length: MAX_CLAIM_COMPANIES }, (_, i) => entry(i));
        expect(() => grantMembership(full, entry(99))).toThrow(
            expect.objectContaining({ code: 'CLAIM_LIMIT_EXCEEDED' }),
        );
        expect(grantMembership(full, entry(0, 'OPERATIONAL'))).toHaveLength(MAX_CLAIM_COMPANIES);
    });

    it('não altera a lista recebida', () => {
        const original = [entry(1)];
        grantMembership(original, entry(2));
        expect(original).toEqual([entry(1)]);
    });
});

describe('revokeMembership', () => {
    it('tira só a empresa informada', () => {
        expect(revokeMembership([entry(1), entry(2)], 'company-1')).toEqual([entry(2)]);
    });

    it('empresa que não estava na claim não muda nada', () => {
        expect(revokeMembership([entry(1)], 'company-9')).toEqual([entry(1)]);
    });
});
