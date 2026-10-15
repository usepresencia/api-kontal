import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { Cents } from '@/domain/money.js';

export const SeriesKind = {
    INSTALLMENT: 'INSTALLMENT',
    RECURRING: 'RECURRING',
} as const;

export type SeriesKind = (typeof SeriesKind)[keyof typeof SeriesKind];

export const SeriesFrequency = {
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    YEARLY: 'YEARLY',
} as const;

export type SeriesFrequency = (typeof SeriesFrequency)[keyof typeof SeriesFrequency];

export const MAX_PER_GENERATION = 60;
export const MAX_PER_SERIES = 120;

export interface SeriesOccurrence {
    index: number;
    description: string;
    amount: Cents;
    issueDate: Date;
    expirationDate: Date;
}

function invalid(message: string): never {
    throw new DomainError(ErrorCode.SERIES_INVALID, message);
}

function limitExceeded(message: string): never {
    throw new DomainError(ErrorCode.SERIES_LIMIT_EXCEEDED, message);
}

/** Divide o total em parcelas; a sobra vai, 1 centavo por vez, para as primeiras. */
export function splitCents(total: Cents, count: number): Cents[] {
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Soma períodos a partir da data base; mensal e anual limitam ao último dia do mês. */
export function addPeriods(base: Date, frequency: SeriesFrequency, steps: number): Date {
    if (frequency === SeriesFrequency.WEEKLY) {
        return new Date(base.getTime() + steps * 7 * 24 * 60 * 60 * 1000);
    }
    const months = frequency === SeriesFrequency.YEARLY ? steps * 12 : steps;
    const totalMonths = base.getUTCFullYear() * 12 + base.getUTCMonth() + months;
    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    const day = Math.min(base.getUTCDate(), daysInMonth(year, month));
    return new Date(Date.UTC(year, month, day));
}

/**
 * Gera as parcelas: total dividido em centavos, mesma emissão, vencimentos periódicos.
 * @throws DomainError SERIES_INVALID, SERIES_LIMIT_EXCEEDED
 */
export function buildInstallments(params: {
    description: string;
    total: Cents;
    count: number;
    frequency: SeriesFrequency;
    issueDate: Date;
    firstDue: Date;
}): SeriesOccurrence[] {
    const { count, total } = params;
    if (!Number.isInteger(count) || count < 2) invalid('Parcelado exige ao menos 2 parcelas');
    if (count > MAX_PER_GENERATION) limitExceeded(`O máximo é ${MAX_PER_GENERATION} parcelas`);
    if (total < count) invalid('Cada parcela deve ter ao menos 1 centavo');
    return splitCents(total, count).map((amount, position) => ({
        index: position + 1,
        description: `${params.description} (${position + 1}/${count})`,
        amount,
        issueDate: params.issueDate,
        expirationDate: addPeriods(params.firstDue, params.frequency, position),
    }));
}

/**
 * Gera ocorrências recorrentes a partir da `startIndex`, ancoradas nas datas da primeira.
 * Exige `count` ou `until` (exatamente um).
 * @throws DomainError SERIES_INVALID, SERIES_LIMIT_EXCEEDED
 */
export function buildRecurrences(params: {
    description: string;
    amount: Cents;
    frequency: SeriesFrequency;
    firstIssueDate: Date;
    firstDue: Date;
    count?: number;
    until?: Date;
    startIndex: number;
}): SeriesOccurrence[] {
    const { count, until, startIndex } = params;
    if ((count === undefined) === (until === undefined)) {
        invalid('Informe o fim da recorrência por quantidade ou por data (apenas um)');
    }
    let quantity: number;
    if (count !== undefined) {
        if (!Number.isInteger(count) || count < 1) invalid('A quantidade deve ser ao menos 1');
        quantity = count;
    } else {
        quantity = 0;
        while (
            quantity <= MAX_PER_GENERATION &&
            addPeriods(params.firstDue, params.frequency, startIndex - 1 + quantity).getTime() <=
                (until as Date).getTime()
        ) {
            quantity += 1;
        }
        if (quantity === 0) invalid('A data final é anterior à primeira ocorrência');
    }
    if (quantity > MAX_PER_GENERATION)
        limitExceeded(`O máximo é ${MAX_PER_GENERATION} ocorrências por geração`);
    if (startIndex - 1 + quantity > MAX_PER_SERIES) {
        limitExceeded(`O máximo é ${MAX_PER_SERIES} ocorrências por série`);
    }
    return Array.from({ length: quantity }, (_, position) => {
        const index = startIndex + position;
        return {
            index,
            description: `${params.description} (${index})`,
            amount: params.amount,
            issueDate: addPeriods(params.firstIssueDate, params.frequency, index - 1),
            expirationDate: addPeriods(params.firstDue, params.frequency, index - 1),
        };
    });
}
