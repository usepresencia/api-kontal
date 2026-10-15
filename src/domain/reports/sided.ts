import type { Cents } from '@/domain/money.js';

export type Side = 'D' | 'C';

/** Saldo em valor absoluto com o lado (devedor ou credor). */
export interface Sided {
    amount: Cents;
    side: Side;
}

/** Converte o saldo bruto (débito − crédito) em valor e lado; zero é devedor. */
export function sided(raw: Cents): Sided {
    return raw >= 0 ? { amount: raw, side: 'D' } : { amount: -raw, side: 'C' };
}
