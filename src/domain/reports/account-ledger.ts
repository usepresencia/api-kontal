import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { Cents } from '@/domain/money.js';
import type { AccountLabel } from '@/domain/repositories/journal-read.repository.interface.js';
import { type Sided, sided } from '@/domain/reports/sided.js';

/** Débitos e créditos antes do período (`opening*`) e no período. */
export interface LedgerTotals {
    openingDebit: Cents;
    openingCredit: Cents;
    debit: Cents;
    credit: Cents;
}

/** Lançamento no razão da conta: valores nas contas, saldo acumulado do período e contrapartidas. */
export interface LedgerItemRow {
    journalEntryId: string;
    number: number;
    date: Date;
    description: string;
    referenceType: JournalRefType;
    debit: Cents;
    credit: Cents;
    running: Cents;
    counterparts: AccountLabel[];
}

export interface LedgerDayRow {
    date: Date;
    debit: Cents;
    credit: Cents;
}

export type LedgerItem = Omit<LedgerItemRow, 'running'> & { balance: Sided };

export interface LedgerDay {
    date: Date;
    debits: Cents;
    credits: Cents;
    balance: Sided;
}

/** Saldos anterior e final com lado, e o saldo anterior bruto (débito − crédito). */
export function ledgerBalances(totals: LedgerTotals): {
    opening: Sided;
    closing: Sided;
    openingRaw: Cents;
} {
    const openingRaw = totals.openingDebit - totals.openingCredit;
    return {
        opening: sided(openingRaw),
        closing: sided(openingRaw + totals.debit - totals.credit),
        openingRaw,
    };
}

/** Itens com o saldo após cada lançamento (saldo anterior + acumulado do período). */
export function ledgerItems(openingRaw: Cents, rows: readonly LedgerItemRow[]): LedgerItem[] {
    return rows.map(({ running, ...row }) => ({ ...row, balance: sided(openingRaw + running) }));
}

/** Dias com o saldo ao fim de cada dia. */
export function ledgerDays(openingRaw: Cents, rows: readonly LedgerDayRow[]): LedgerDay[] {
    let balance = openingRaw;
    return rows.map(row => {
        balance += row.debit - row.credit;
        return { date: row.date, debits: row.debit, credits: row.credit, balance: sided(balance) };
    });
}
