import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import type { JournalEntryEntity, JournalLine } from '@/domain/entities/journal-entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';

export const MANUAL_LINES_MIN = 2;
export const MANUAL_LINES_MAX = 50;

const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

/**
 * Garante que a data do lançamento manual não é futura.
 * @throws DomainError MANUAL_ENTRY_DATE_INVALID
 */
export function assertManualDate(date: Date, today: Date): void {
    if (date.getTime() > today.getTime()) {
        throw new DomainError(
            ErrorCode.MANUAL_ENTRY_DATE_INVALID,
            'A data do lançamento não pode ser futura',
        );
    }
}

/**
 * Garante de 2 a 50 linhas, cada uma só com débito ou só com crédito (centavos > 0), e débitos
 * iguais aos créditos.
 * @throws DomainError MANUAL_ENTRY_UNBALANCED
 */
export function assertManualLines(lines: readonly JournalLine[]): void {
    const unbalanced = (message: string): never => {
        throw new DomainError(ErrorCode.MANUAL_ENTRY_UNBALANCED, message);
    };
    if (lines.length < MANUAL_LINES_MIN || lines.length > MANUAL_LINES_MAX) {
        unbalanced(`O lançamento precisa de ${MANUAL_LINES_MIN} a ${MANUAL_LINES_MAX} linhas`);
    }
    let debits = 0;
    let credits = 0;
    for (const line of lines) {
        const oneSided =
            (positive(line.debit) && line.credit === 0) ||
            (positive(line.credit) && line.debit === 0);
        if (!oneSided) unbalanced('Cada linha deve ter só débito ou só crédito, maior que zero');
        debits += line.debit;
        credits += line.credit;
    }
    if (debits !== credits) unbalanced('A soma dos débitos deve ser igual à soma dos créditos');
}

/**
 * Garante contas analíticas, ativas, da empresa e do mesmo plano, sem contas de controle.
 * @throws DomainError MANUAL_ENTRY_ACCOUNT_INVALID, MANUAL_ENTRY_CONTROL_ACCOUNT
 */
export function assertManualAccounts(
    accountIds: readonly string[],
    refs: readonly AccountRef[],
    controlIds: ReadonlySet<string>,
): void {
    const byId = new Map(refs.map(ref => [ref.id, ref]));
    const plans = new Set(refs.map(ref => ref.billingPlanId));
    const invalid = accountIds.some(id => {
        const ref = byId.get(id);
        return !ref || ref.accountType !== AccountType.ANALYTIC || !ref.isActive;
    });
    if (invalid || plans.size > 1) {
        throw new DomainError(
            ErrorCode.MANUAL_ENTRY_ACCOUNT_INVALID,
            'Use contas analíticas, ativas e do mesmo plano de contas da empresa',
        );
    }
    if (accountIds.some(id => controlIds.has(id))) {
        throw new DomainError(
            ErrorCode.MANUAL_ENTRY_CONTROL_ACCOUNT,
            'Contas de controle de títulos (a receber e a pagar) só mudam por títulos e baixas',
        );
    }
}

/**
 * Garante que o lançamento é manual e ainda não foi estornado.
 * @throws DomainError JOURNAL_NOT_REVERSIBLE, JOURNAL_ALREADY_REVERSED
 */
export function assertReversible(entry: JournalEntryEntity, alreadyReversed: boolean): void {
    if (entry.referenceType !== JournalRefType.MANUAL) {
        throw new DomainError(
            ErrorCode.JOURNAL_NOT_REVERSIBLE,
            'Só lançamentos manuais podem ser estornados por aqui',
        );
    }
    if (alreadyReversed) {
        throw new DomainError(
            ErrorCode.JOURNAL_ALREADY_REVERSED,
            'Este lançamento já foi estornado',
        );
    }
}
