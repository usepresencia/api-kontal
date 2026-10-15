import { z } from 'zod';
import { MONEY_PATTERN, parseMoney } from '@/domain/money.js';

/** Valor monetário como texto (`"1234.50"`, até 2 casas), convertido em centavos. */
export const moneySchema = z
    .string()
    .regex(MONEY_PATTERN, 'Use até 2 casas decimais, ex.: "1234.50"')
    .transform(value => parseMoney(value));
