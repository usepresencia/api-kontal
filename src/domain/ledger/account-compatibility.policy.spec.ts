import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import {
    assertPresetAccounts,
    assertSettlementAccount,
} from '@/domain/ledger/account-compatibility.policy.js';
import type { PresetAccountIds } from '@/domain/ledger/preset-roles.js';

const ref = (
    id: string,
    nature: AccountNature,
    overrides: Partial<AccountRef> = {},
): AccountRef => ({
    id,
    billingPlanId: 'p1',
    accountType: AccountType.ANALYTIC,
    nature,
    isActive: true,
    ...overrides,
});

const ids = (overrides: Partial<PresetAccountIds> = {}): PresetAccountIds => ({
    receivable: 'ar',
    payable: 'ap',
    revenue: 'rev',
    expense: 'exp',
    interestIncome: null,
    discountGranted: null,
    badDebt: null,
    interestExpense: null,
    discountObtained: null,
    debtForgiveness: null,
    ...overrides,
});

const refs = [
    ref('ar', AccountNature.ASSET),
    ref('ap', AccountNature.LIABILITY),
    ref('rev', AccountNature.REVENUE),
    ref('exp', AccountNature.EXPENSE),
];

const expectCode = (fn: () => unknown, code: string) => {
    expect(fn).toThrow(expect.objectContaining({ code }));
};

describe('assertPresetAccounts', () => {
    it('aceita contas analíticas, ativas, do plano e com a natureza do papel', () => {
        expect(() => assertPresetAccounts('p1', ids(), refs)).not.toThrow();
    });

    it('ignora papéis opcionais sem conta', () => {
        expect(() =>
            assertPresetAccounts('p1', ids({ revenue: null, expense: null }), refs),
        ).not.toThrow();
    });

    it.each([
        ['a receber ausente', ids({ receivable: null })],
        ['a pagar ausente', ids({ payable: null })],
    ])('papel obrigatório %s é recusado', (_label, accountIds) => {
        expectCode(() => assertPresetAccounts('p1', accountIds, refs), 'PRESET_ACCOUNT_INVALID');
    });

    it('conta que não foi encontrada na empresa é recusada', () => {
        expectCode(
            () => assertPresetAccounts('p1', ids({ revenue: 'desconhecida' }), refs),
            'PRESET_ACCOUNT_INVALID',
        );
    });

    it('conta de outro plano responde PRESET_PLAN_MISMATCH', () => {
        const other = [
            ...refs.slice(0, 2),
            ref('rev', AccountNature.REVENUE, { billingPlanId: 'p2' }),
            refs[3],
        ];
        expectCode(() => assertPresetAccounts('p1', ids(), other), 'PRESET_PLAN_MISMATCH');
    });

    it.each([
        ['sintética', { accountType: AccountType.SYNTHETIC }],
        ['inativa', { isActive: false }],
    ])('conta %s é recusada', (_label, overrides) => {
        const list = [...refs.slice(0, 3), ref('exp', AccountNature.EXPENSE, overrides)];
        expectCode(() => assertPresetAccounts('p1', ids(), list), 'PRESET_ACCOUNT_INVALID');
    });

    it.each([
        ['a receber', { receivable: 'rev' }],
        ['a pagar', { payable: 'ar' }],
        ['receita', { revenue: 'exp' }],
        ['despesa', { expense: 'rev' }],
    ])('natureza errada no papel %s é recusada', (_label, overrides) => {
        expectCode(
            () => assertPresetAccounts('p1', ids(overrides), refs),
            'PRESET_ACCOUNT_INVALID',
        );
    });

    it('papéis opcionais exigem a natureza do papel (juros recebidos = receita)', () => {
        const list = [...refs, ref('jr', AccountNature.REVENUE), ref('dc', AccountNature.EXPENSE)];
        expect(() =>
            assertPresetAccounts('p1', ids({ interestIncome: 'jr', discountGranted: 'dc' }), list),
        ).not.toThrow();
        expectCode(
            () => assertPresetAccounts('p1', ids({ interestIncome: 'dc' }), list),
            'PRESET_ACCOUNT_INVALID',
        );
    });
});

describe('assertSettlementAccount', () => {
    it.each([AccountNature.ASSET, AccountNature.LIABILITY])(
        'aceita conta analítica ativa do plano, de natureza %s',
        nature => {
            expect(() => assertSettlementAccount('p1', 'ar', ref('bank', nature))).not.toThrow();
        },
    );

    it('conta inexistente na empresa é recusada', () => {
        expectCode(() => assertSettlementAccount('p1', 'ar', undefined), 'ENTRY_ACCOUNT_INVALID');
    });

    it.each([
        ['de outro plano', { billingPlanId: 'p2' }],
        ['sintética', { accountType: AccountType.SYNTHETIC }],
        ['inativa', { isActive: false }],
    ])('conta %s é recusada', (_label, overrides) => {
        expectCode(
            () => assertSettlementAccount('p1', 'ar', ref('bank', AccountNature.ASSET, overrides)),
            'ENTRY_ACCOUNT_INVALID',
        );
    });

    it.each([AccountNature.REVENUE, AccountNature.EXPENSE, AccountNature.EQUITY])(
        'conta de natureza %s é recusada',
        nature => {
            expectCode(
                () => assertSettlementAccount('p1', 'ar', ref('x', nature)),
                'ENTRY_ACCOUNT_INVALID',
            );
        },
    );

    it('a própria conta de controle é recusada', () => {
        expectCode(
            () => assertSettlementAccount('p1', 'ar', ref('ar', AccountNature.ASSET)),
            'ENTRY_ACCOUNT_INVALID',
        );
    });
});
