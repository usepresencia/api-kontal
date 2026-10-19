import type { Cents } from '@/domain/money.js';
import type { JournalView } from '@/domain/repositories/journal-read.repository.interface.js';

/** Totais de débito e crédito de um dia do livro diário. */
export interface DayTotals {
    date: Date;
    debits: Cents;
    credits: Cents;
}

export interface DailyJournalDay extends DayTotals {
    entries: JournalView[];
}

/** Coloca cada lançamento no seu dia, mantendo a ordem dos dias e dos lançamentos recebidos. */
export function assembleDays(
    days: readonly DayTotals[],
    entries: readonly JournalView[],
): DailyJournalDay[] {
    const byDate = new Map<number, JournalView[]>();
    for (const view of entries) {
        const key = view.entry.date.getTime();
        byDate.set(key, [...(byDate.get(key) ?? []), view]);
    }
    return days.map(day => ({ ...day, entries: byDate.get(day.date.getTime()) ?? [] }));
}
