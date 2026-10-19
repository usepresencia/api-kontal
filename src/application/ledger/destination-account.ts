import { DomainError } from '@/domain/errors/domain-error.js';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { assertDestinationAccount } from '@/domain/ledger/account-compatibility.policy.js';
import { TitleType } from '@/domain/ledger/title-type.js';
import type { ILedgerTx } from '@/domain/repositories/ledger.unit-of-work.interface.js';

/**
 * Valida a conta de destino de um título a pagar (compra de ativo) e a devolve;
 * sem destino devolve `undefined`.
 * @throws DomainError DESTINATION_ACCOUNT_INVALID
 */
export async function resolveDestination(
    tx: ILedgerTx,
    companyId: string,
    preset: PresetEntity,
    type: TitleType,
    destinationAccountId: string | undefined,
): Promise<string | undefined> {
    if (destinationAccountId === undefined) return undefined;
    if (type !== TitleType.EXPENSE) {
        throw new DomainError(
            ErrorCode.DESTINATION_ACCOUNT_INVALID,
            'A conta de destino só vale para títulos a pagar',
        );
    }
    const [ref] = await tx.accounts.findRefs(companyId, [destinationAccountId]);
    const controlIds = await tx.accounts.controlAccountIds(companyId, [destinationAccountId]);
    assertDestinationAccount(
        preset.billingPlanId,
        preset.accounts.payable as string,
        ref,
        controlIds,
    );
    return destinationAccountId;
}
