import type { DailyJournalResult } from '@/application/reports/get-daily-journal.service.js';
import { formatMoney } from '@/domain/money.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toJournalResponse } from '@/presentation/ledger/journal.mapper.js';

/** Resposta do livro diário: página de dias com os totais e os lançamentos de cada dia. */
export function toDailyJournalResponse({ billingPlanId, start, end, days }: DailyJournalResult) {
    return {
        billingPlanId,
        start: toIsoDate(start),
        end: toIsoDate(end),
        ...toPageResponse(days, day => ({
            date: toIsoDate(day.date),
            totalDebits: formatMoney(day.debits),
            totalCredits: formatMoney(day.credits),
            entries: day.entries.map(toJournalResponse),
        })),
    };
}
