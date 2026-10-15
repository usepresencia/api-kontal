import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import {
    PRESET_ROLE_NATURE,
    PRESET_ROLES,
    type PresetAccountIds,
    REQUIRED_PRESET_ROLES,
} from '@/domain/ledger/preset-roles.js';

/**
 * Valida as contas do preset: existem, são do plano, analíticas, ativas e da natureza do papel.
 * @throws DomainError PRESET_ACCOUNT_INVALID, PRESET_PLAN_MISMATCH
 */
export function assertPresetAccounts(
    planId: string,
    ids: PresetAccountIds,
    refs: readonly AccountRef[],
): void {
    for (const role of PRESET_ROLES) {
        const id = ids[role];
        if (!id) {
            if (REQUIRED_PRESET_ROLES.includes(role)) {
                throw new DomainError(
                    ErrorCode.PRESET_ACCOUNT_INVALID,
                    `A conta do papel "${role}" é obrigatória`,
                );
            }
            continue;
        }
        const ref = refs.find(candidate => candidate.id === id);
        if (!ref) {
            throw new DomainError(
                ErrorCode.PRESET_ACCOUNT_INVALID,
                `Conta do papel "${role}" não encontrada`,
            );
        }
        if (ref.billingPlanId !== planId) {
            throw new DomainError(
                ErrorCode.PRESET_PLAN_MISMATCH,
                'Todas as contas do preset devem pertencer ao mesmo plano de contas',
            );
        }
        if (
            ref.accountType !== AccountType.ANALYTIC ||
            !ref.isActive ||
            ref.nature !== PRESET_ROLE_NATURE[role]
        ) {
            throw new DomainError(
                ErrorCode.PRESET_ACCOUNT_INVALID,
                `A conta do papel "${role}" deve ser analítica, ativa e de natureza ${PRESET_ROLE_NATURE[role]}`,
            );
        }
    }
}

/**
 * Valida a conta financeira de uma baixa: analítica, ativa, do plano, de ativo ou passivo
 * e diferente da conta de controle.
 * @throws DomainError ENTRY_ACCOUNT_INVALID
 */
export function assertSettlementAccount(
    planId: string,
    controlAccountId: string,
    ref: AccountRef | undefined,
): void {
    const valid =
        ref !== undefined &&
        ref.billingPlanId === planId &&
        ref.accountType === AccountType.ANALYTIC &&
        ref.isActive &&
        (ref.nature === AccountNature.ASSET || ref.nature === AccountNature.LIABILITY) &&
        ref.id !== controlAccountId;
    if (!valid) {
        throw new DomainError(
            ErrorCode.ENTRY_ACCOUNT_INVALID,
            'A conta da baixa deve ser analítica, ativa, do plano do título, de ativo ou passivo e diferente da conta de controle',
        );
    }
}
