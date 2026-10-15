import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { ChargeAccounts } from '@/domain/ledger/posting.policy.js';

/** Contas de encargos, perda e perdão do preset. */
export function chargeAccounts(preset: PresetEntity): ChargeAccounts {
    const {
        interestIncome,
        discountGranted,
        badDebt,
        interestExpense,
        discountObtained,
        debtForgiveness,
    } = preset.accounts;
    return {
        interestIncome,
        discountGranted,
        badDebt,
        interestExpense,
        discountObtained,
        debtForgiveness,
    };
}
