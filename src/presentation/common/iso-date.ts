import { z } from 'zod';

/** Data `YYYY-MM-DD` convertida em `Date` UTC à meia-noite. */
export const isoDateSchema = z.iso.date().transform(value => new Date(`${value}T00:00:00.000Z`));

/** `Date` UTC em `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
