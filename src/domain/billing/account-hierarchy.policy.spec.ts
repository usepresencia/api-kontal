import { AccountType } from '@/domain/billing/account-type.js';
import {
    assertCanChangeType,
    assertValidPlacement,
} from '@/domain/billing/account-hierarchy.policy.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const { ANALYTIC, SYNTHETIC } = AccountType;
const expectCode = (fn: () => unknown, code: string) => {
    expect(fn).toThrow(DomainError);
    expect(fn).toThrow(expect.objectContaining({ code }));
};

describe('assertValidPlacement', () => {
    it('conta sintética raiz fica no nível 1', () => {
        expect(assertValidPlacement(SYNTHETIC, null)).toBe(1);
    });

    it('conta analítica raiz é recusada', () => {
        expectCode(() => assertValidPlacement(ANALYTIC, null), 'ACCOUNT_ANALYTIC_REQUIRES_PARENT');
    });

    it('filha de pai sintético fica um nível abaixo (analítica ou sintética)', () => {
        expect(assertValidPlacement(ANALYTIC, { accountType: SYNTHETIC, level: 2 })).toBe(3);
        expect(assertValidPlacement(SYNTHETIC, { accountType: SYNTHETIC, level: 1 })).toBe(2);
    });

    it('pai analítico é recusado', () => {
        expectCode(
            () => assertValidPlacement(SYNTHETIC, { accountType: ANALYTIC, level: 2 }),
            'ACCOUNT_PARENT_NOT_SYNTHETIC',
        );
    });

    it('aceita o nível 5 e recusa o 6', () => {
        expect(assertValidPlacement(ANALYTIC, { accountType: SYNTHETIC, level: 4 })).toBe(5);
        expectCode(
            () => assertValidPlacement(ANALYTIC, { accountType: SYNTHETIC, level: 5 }),
            'ACCOUNT_MAX_DEPTH_EXCEEDED',
        );
    });
});

describe('assertCanChangeType', () => {
    it('virar sintética é sempre permitido', () => {
        expect(() => assertCanChangeType(SYNTHETIC, false, true)).not.toThrow();
    });

    it('virar analítica exige pai', () => {
        expectCode(
            () => assertCanChangeType(ANALYTIC, false, false),
            'ACCOUNT_ANALYTIC_REQUIRES_PARENT',
        );
    });

    it('virar analítica é recusado se a conta tem filhas', () => {
        expectCode(() => assertCanChangeType(ANALYTIC, true, true), 'ACCOUNT_HAS_CHILDREN');
    });

    it('virar analítica com pai e sem filhas é permitido', () => {
        expect(() => assertCanChangeType(ANALYTIC, true, false)).not.toThrow();
    });
});
