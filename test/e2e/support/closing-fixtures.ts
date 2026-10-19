import { businessToday } from '@test/e2e/support/dates.js';

/** Mês `YYYY-MM` a `back` meses do mês corrente (negativo = futuro). */
export function monthKey(back: number): string {
    const today = businessToday();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1))
        .toISOString()
        .slice(0, 7);
}

/** Dia `day` (1 a 28) do mês a `back` meses do corrente, como `YYYY-MM-DD`. */
export function monthDay(back: number, day: number): string {
    return `${monthKey(back)}-${String(day).padStart(2, '0')}`;
}

/** Último dia do mês `YYYY-MM`. */
export function lastDayOf(month: string): string {
    const [year, number] = month.split('-').map(Number);
    return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
}
