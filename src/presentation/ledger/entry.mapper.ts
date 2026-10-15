import { formatMoney } from '@/domain/money.js';
import type { EntryView } from '@/domain/repositories/entry-read.repository.interface.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

/** Resposta da API para uma baixa: valores em texto e os nomes do título e da conta. */
export function toEntryResponse({ entry, titleDescription, billingAccountName }: EntryView) {
    return {
        id: entry.id,
        titleId: entry.titleId,
        titleDescription,
        kind: entry.kind,
        billingAccountId: entry.billingAccountId,
        billingAccountName,
        principalAmount: formatMoney(entry.principalAmount),
        interestAmount: formatMoney(entry.interestAmount),
        fineAmount: formatMoney(entry.fineAmount),
        discountAmount: formatMoney(entry.discountAmount),
        totalAmount: formatMoney(entry.totalAmount),
        paidAt: toIsoDate(entry.paidAt),
        paymentMethod: entry.paymentMethod,
        description: entry.description,
        createdAt: entry.createdAt.toISOString(),
    };
}
