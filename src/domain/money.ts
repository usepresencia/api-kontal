import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/** Valor monetário em centavos inteiros. */
export type Cents = number;

/** Maior valor suportado pelo banco (`Decimal(12,2)`), em centavos. */
export const MAX_CENTS = 999_999_999_999;

/** Texto monetário aceito: até 10 dígitos inteiros e até 2 casas decimais, sem sinal. */
export const MONEY_PATTERN = /^(\d{1,10})(?:\.(\d{1,2}))?$/;

/**
 * Converte "1234.50" em centavos.
 * @throws DomainError VALIDATION_ERROR se o texto não for um valor válido
 */
export function parseMoney(raw: string, label = 'Valor'): Cents {
    const match = MONEY_PATTERN.exec(raw);
    if (!match) {
        throw new DomainError(
            ErrorCode.VALIDATION_ERROR,
            `${label} inválido: use até 2 casas decimais`,
        );
    }
    return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Converte centavos em texto com 2 casas ("1234.50"). */
export function formatMoney(cents: Cents): string {
    if (!Number.isSafeInteger(cents) || cents < 0) {
        throw new DomainError(ErrorCode.INTERNAL_ERROR, `Valor em centavos inválido: ${cents}`);
    }
    return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** Converte centavos (inclusive negativos) em texto com 2 casas ("-1234.50"). */
export function formatSignedMoney(cents: Cents): string {
    if (!Number.isSafeInteger(cents)) {
        throw new DomainError(ErrorCode.INTERNAL_ERROR, `Valor em centavos inválido: ${cents}`);
    }
    return cents < 0 ? `-${formatMoney(-cents)}` : formatMoney(cents);
}
