/** Dia de negócio (São Paulo) como `Date` UTC à meia-noite, igual ao `SystemClock`. */
export function businessToday(): Date {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
        new Date(),
    );
    return new Date(`${day}T00:00:00.000Z`);
}

/** Data `YYYY-MM-DD` a `offsetDays` dias do dia de negócio. */
export function isoDay(offsetDays = 0): string {
    const date = businessToday();
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}
