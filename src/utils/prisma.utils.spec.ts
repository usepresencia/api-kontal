import { ignoreUniqueConstraint, isUniqueConstraintError } from '@/utils/prisma.utils.js';

const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('isUniqueConstraintError', () => {
    it('reconhece o código P2002', () => {
        expect(isUniqueConstraintError(p2002)).toBe(true);
    });

    it('rejeita outro código do Prisma', () => {
        expect(isUniqueConstraintError(Object.assign(new Error('x'), { code: 'P2025' }))).toBe(
            false,
        );
    });

    it.each([null, undefined, 'P2002', 42])('rejeita valor que não é objeto: %s', value => {
        expect(isUniqueConstraintError(value)).toBe(false);
    });
});

describe('ignoreUniqueConstraint', () => {
    it('suprime P2002', () => {
        expect(() => ignoreUniqueConstraint(p2002)).not.toThrow();
    });

    it('propaga qualquer outro erro', () => {
        const boom = new Error('boom');
        expect(() => ignoreUniqueConstraint(boom)).toThrow(boom);
    });
});
