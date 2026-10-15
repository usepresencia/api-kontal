import { Prisma } from '@prisma/client';
import { type Cents, formatMoney, parseMoney } from '@/domain/money.js';

/** Converte o `Decimal` do banco em centavos inteiros. */
export function toCents(decimal: { toFixed(fractionDigits: number): string }): Cents {
    return parseMoney(decimal.toFixed(2));
}

/** Converte centavos em `Decimal` com 2 casas, sem passar por ponto flutuante. */
export function toDecimal(cents: Cents): Prisma.Decimal {
    return new Prisma.Decimal(formatMoney(cents));
}

/** Converte texto decimal com sinal (`"-12.50"`) em centavos. */
export function signedCents(text: string): Cents {
    return text.startsWith('-') ? -parseMoney(text.slice(1)) : parseMoney(text);
}
