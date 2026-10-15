import type { JournalLine } from '@/domain/entities/journal-entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { PresetAccountIds } from '@/domain/ledger/preset-roles.js';
import { TitleType } from '@/domain/ledger/title-type.js';
import type { Cents } from '@/domain/money.js';

export interface PostingAccounts {
    type: TitleType;
    controlAccountId: string;
    resultAccountId: string;
}

export interface PaymentAmounts {
    principal: Cents;
    interest: Cents;
    fine: Cents;
    discount: Cents;
    total: Cents;
}

export type ChargeAccounts = Pick<
    PresetAccountIds,
    | 'interestIncome'
    | 'discountGranted'
    | 'badDebt'
    | 'interestExpense'
    | 'discountObtained'
    | 'debtForgiveness'
>;

const debit = (accountId: string, amount: Cents, memo: string): JournalLine => ({
    accountId,
    debit: amount,
    credit: 0,
    memo,
});

const credit = (accountId: string, amount: Cents, memo: string): JournalLine => ({
    accountId,
    debit: 0,
    credit: amount,
    memo,
});

function required(accountId: string | null, role: string): string {
    if (!accountId) {
        throw new DomainError(
            ErrorCode.SETTLEMENT_NOT_POSTABLE,
            `O preset não tem a conta "${role}" exigida por esta baixa`,
        );
    }
    return accountId;
}

/**
 * Escolhe as contas de controle e de resultado do título a partir do preset; `resultOverride`
 * (conta de destino ou de saldos iniciais) substitui a conta de receita ou de despesa.
 * @throws DomainError TITLE_NOT_POSTABLE se o preset não tem as contas do tipo
 */
export function resolveTitleAccounts(
    type: TitleType,
    preset: Pick<PresetAccountIds, 'receivable' | 'payable' | 'revenue' | 'expense'>,
    resultOverride?: string,
): { controlAccountId: string; resultAccountId: string } {
    const control = type === TitleType.INCOME ? preset.receivable : preset.payable;
    const result = resultOverride ?? (type === TitleType.INCOME ? preset.revenue : preset.expense);
    if (!control || !result) {
        throw new DomainError(
            ErrorCode.TITLE_NOT_POSTABLE,
            type === TitleType.INCOME
                ? 'O preset precisa das contas a receber e de receita para títulos de receita'
                : 'O preset precisa das contas a pagar e de despesa para títulos de despesa',
        );
    }
    return { controlAccountId: control, resultAccountId: result };
}

/** Criação do título: receita D controle / C receita; despesa D despesa / C controle. */
export function creationLines(
    accounts: PostingAccounts,
    amount: Cents,
    memo: string,
): JournalLine[] {
    return accounts.type === TitleType.INCOME
        ? [
              debit(accounts.controlAccountId, amount, memo),
              credit(accounts.resultAccountId, amount, memo),
          ]
        : [
              debit(accounts.resultAccountId, amount, memo),
              credit(accounts.controlAccountId, amount, memo),
          ];
}

/**
 * Pagamento com encargos. Receita: D conta da baixa (total) e desconto concedido / C controle
 * (principal) e juros recebidos. Despesa: D controle (principal) e juros pagos / C conta da baixa
 * (total) e desconto obtido.
 * @throws DomainError SETTLEMENT_NOT_POSTABLE se faltar a conta do encargo usado
 */
export function paymentLines(
    accounts: PostingAccounts,
    bankAccountId: string,
    amounts: PaymentAmounts,
    charges: ChargeAccounts,
    memo: string,
): JournalLine[] {
    const lines: JournalLine[] = [];
    const interestAndFine = amounts.interest + amounts.fine;
    if (accounts.type === TitleType.INCOME) {
        lines.push(debit(bankAccountId, amounts.total, memo));
        if (amounts.discount > 0) {
            lines.push(
                debit(
                    required(charges.discountGranted, 'desconto concedido'),
                    amounts.discount,
                    memo,
                ),
            );
        }
        lines.push(credit(accounts.controlAccountId, amounts.principal, memo));
        if (interestAndFine > 0) {
            lines.push(
                credit(required(charges.interestIncome, 'juros recebidos'), interestAndFine, memo),
            );
        }
        return lines;
    }
    lines.push(debit(accounts.controlAccountId, amounts.principal, memo));
    if (interestAndFine > 0) {
        lines.push(debit(required(charges.interestExpense, 'juros pagos'), interestAndFine, memo));
    }
    lines.push(credit(bankAccountId, amounts.total, memo));
    if (amounts.discount > 0) {
        lines.push(
            credit(required(charges.discountObtained, 'desconto obtido'), amounts.discount, memo),
        );
    }
    return lines;
}

/**
 * Baixa por perda do saldo em aberto. Receita: D perda com cliente / C controle.
 * Despesa: D controle / C perdão de dívida.
 * @throws DomainError SETTLEMENT_NOT_POSTABLE se faltar a conta de perda ou de perdão
 */
export function writeOffLines(
    accounts: PostingAccounts,
    principal: Cents,
    charges: ChargeAccounts,
    memo: string,
): JournalLine[] {
    return accounts.type === TitleType.INCOME
        ? [
              debit(required(charges.badDebt, 'perda com cliente'), principal, memo),
              credit(accounts.controlAccountId, principal, memo),
          ]
        : [
              debit(accounts.controlAccountId, principal, memo),
              credit(required(charges.debtForgiveness, 'perdão de dívida'), principal, memo),
          ];
}

/** Estorno: inverte débito e crédito de cada linha. */
export function reverseLines(lines: readonly JournalLine[], memo: string): JournalLine[] {
    return lines.map(line => ({
        accountId: line.accountId,
        debit: line.credit,
        credit: line.debit,
        memo: `${memo}: ${line.memo}`,
    }));
}

/** Data do estorno: a mais tardia entre a do evento e a do lançamento original. */
export function reversalDate(eventDate: Date, originalDate: Date): Date {
    return eventDate.getTime() >= originalDate.getTime() ? eventDate : originalDate;
}
