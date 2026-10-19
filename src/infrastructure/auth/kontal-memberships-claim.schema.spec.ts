import { parseKontalMembershipsClaim } from '@/infrastructure/auth/kontal-memberships-claim.schema.js';

const A = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const B = '4a7e1b3f-9c2d-4a6f-8b8e-2d3c4b5e6f70';

describe('parseKontalMembershipsClaim', () => {
    it('lê as empresas e os papéis da claim', () => {
        expect(
            parseKontalMembershipsClaim([
                { companyId: A, role: 'OWNER' },
                { companyId: B, role: 'OPERATIONAL' },
            ]),
        ).toEqual([
            { companyId: A, role: 'OWNER' },
            { companyId: B, role: 'OPERATIONAL' },
        ]);
    });

    it('a última entrada de uma empresa repetida vale', () => {
        expect(
            parseKontalMembershipsClaim([
                { companyId: A, role: 'OPERATIONAL' },
                { companyId: A, role: 'OWNER' },
            ]),
        ).toEqual([{ companyId: A, role: 'OWNER' }]);
    });

    it.each([
        ['ausente', undefined],
        ['não é lista', { companyId: A, role: 'OWNER' }],
        ['papel inválido', [{ companyId: A, role: 'ADMIN' }]],
        ['id que não é UUID', [{ companyId: 'abc', role: 'OWNER' }]],
        [
            'lista acima do limite',
            Array.from({ length: 9 }, (_, i) => ({
                companyId: `3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6${i}`,
                role: 'OWNER',
            })),
        ],
    ])('claim %s não dá acesso', (_label, claim) => {
        expect(parseKontalMembershipsClaim(claim)).toEqual([]);
    });
});
