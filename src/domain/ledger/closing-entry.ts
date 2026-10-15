import type { JournalLine } from '@/domain/entities/journal-entry.entity.js';
import type { Cents } from '@/domain/money.js';
import { isResult } from '@/domain/reports/dre.js';
import type { AccountBalance } from '@/domain/reports/ledger-rows.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

const MEMO = 'Apuração do resultado do exercício';

/**
 * Linhas da apuração: zera o saldo de cada conta de resultado e leva a diferença à conta de
 * lucros acumulados (lucro: crédito; prejuízo: débito). Sem saldo de resultado devolve `null`.
 */
export function buildClosingLines(
    accounts: readonly ReportAccount[],
    balances: readonly AccountBalance[],
    retainedAccountId: string,
): JournalLine[] | null {
    const resultIds = new Set(accounts.filter(isResult).map(account => account.id));
    const raw = new Map<string, Cents>();
    for (const balance of balances) {
        if (!resultIds.has(balance.accountId)) continue;
        raw.set(
            balance.accountId,
            (raw.get(balance.accountId) ?? 0) + balance.debit - balance.credit,
        );
    }
    const lines: JournalLine[] = [];
    let debits = 0;
    let credits = 0;
    for (const account of accounts) {
        const value = raw.get(account.id);
        if (!value) continue;
        if (value > 0) {
            lines.push({ accountId: account.id, debit: 0, credit: value, memo: MEMO });
            credits += value;
        } else {
            lines.push({ accountId: account.id, debit: -value, credit: 0, memo: MEMO });
            debits -= value;
        }
    }
    if (lines.length === 0) return null;
    const difference = debits - credits;
    if (difference > 0) {
        lines.push({ accountId: retainedAccountId, debit: 0, credit: difference, memo: MEMO });
    } else if (difference < 0) {
        lines.push({ accountId: retainedAccountId, debit: -difference, credit: 0, memo: MEMO });
    }
    return lines;
}
