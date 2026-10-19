import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { assertDestinationAccount } from '@/domain/ledger/account-compatibility.policy.js';

const ref = (overrides: Partial<AccountRef> = {}): AccountRef => ({
    id: 'imob',
    billingPlanId: 'p1',
    accountType: AccountType.ANALYTIC,
    nature: AccountNature.ASSET,
    isActive: true,
    ...overrides,
});
const invalid = (fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code: 'DESTINATION_ACCOUNT_INVALID' }));
};

describe('assertDestinationAccount', () => {
    it('aceita conta analítica, ativa, do plano, de ativo ou despesa e fora do controle', () => {
        expect(() => assertDestinationAccount('p1', 'ap', ref(), new Set())).not.toThrow();
        expect(() =>
            assertDestinationAccount('p1', 'ap', ref({ nature: AccountNature.EXPENSE }), new Set()),
        ).not.toThrow();
    });

    it.each([
        ['inexistente', undefined],
        ['de outro plano', ref({ billingPlanId: 'p2' })],
        ['sintética', ref({ accountType: AccountType.SYNTHETIC })],
        ['inativa', ref({ isActive: false })],
        ['de receita', ref({ nature: AccountNature.REVENUE })],
        ['de passivo', ref({ nature: AccountNature.LIABILITY })],
        ['de patrimônio líquido', ref({ nature: AccountNature.EQUITY })],
        ['igual à conta de controle do título', ref({ id: 'ap' })],
    ])('recusa conta %s', (_label, candidate) => {
        invalid(() => assertDestinationAccount('p1', 'ap', candidate, new Set()));
    });

    it('recusa qualquer conta usada como controle de título ou de preset', () => {
        invalid(() => assertDestinationAccount('p1', 'ap', ref(), new Set(['imob'])));
    });
});
