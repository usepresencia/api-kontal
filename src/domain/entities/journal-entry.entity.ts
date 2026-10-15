import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { Cents } from '@/domain/money.js';

export interface JournalLine {
    accountId: string;
    debit: Cents;
    credit: Cents;
    memo: string;
}

export interface JournalEntryRow {
    id: string;
    companyId: string;
    date: Date;
    description: string;
    referenceType: JournalRefType;
    referenceId: string;
    totalDebits: Cents;
    totalCredits: Cents;
    lines: JournalLine[];
    createdAt: Date;
}

function invalid(message: string): never {
    throw new DomainError(ErrorCode.JOURNAL_INVALID, `Lançamento inválido: ${message}`);
}

function totals(lines: readonly JournalLine[]): { debits: Cents; credits: Cents } {
    if (lines.length < 2) invalid('são necessárias ao menos duas linhas');
    let debits = 0;
    let credits = 0;
    for (const line of lines) {
        const values = [line.debit, line.credit];
        if (!values.every(value => Number.isSafeInteger(value) && value >= 0)) {
            invalid('valores devem ser centavos inteiros não negativos');
        }
        if (line.debit > 0 === line.credit > 0) {
            invalid('cada linha deve ter apenas débito ou apenas crédito');
        }
        debits += line.debit;
        credits += line.credit;
    }
    if (debits !== credits) invalid('débitos e créditos devem ser iguais');
    return { debits, credits };
}

/** Lançamento contábil de partida dobrada (imutável). */
export class JournalEntryEntity {
    private constructor(
        readonly id: string,
        readonly companyId: string,
        readonly date: Date,
        readonly description: string,
        readonly referenceType: JournalRefType,
        readonly referenceId: string,
        readonly lines: readonly JournalLine[],
        readonly totalDebits: Cents,
        readonly totalCredits: Cents,
        readonly createdAt: Date,
    ) {}

    /**
     * Valida e cria o lançamento.
     * @throws DomainError JOURNAL_INVALID se não for balanceado ou tiver linha inválida
     */
    static create(params: {
        id: string;
        companyId: string;
        date: Date;
        description: string;
        referenceType: JournalRefType;
        referenceId: string;
        lines: readonly JournalLine[];
        createdAt?: Date;
    }): JournalEntryEntity {
        const { debits, credits } = totals(params.lines);
        return new JournalEntryEntity(
            params.id,
            params.companyId,
            params.date,
            params.description,
            params.referenceType,
            params.referenceId,
            params.lines,
            debits,
            credits,
            params.createdAt ?? new Date(),
        );
    }

    static fromPersistence(row: JournalEntryRow): JournalEntryEntity {
        return new JournalEntryEntity(
            row.id,
            row.companyId,
            row.date,
            row.description,
            row.referenceType,
            row.referenceId,
            row.lines,
            row.totalDebits,
            row.totalCredits,
            row.createdAt,
        );
    }
}
