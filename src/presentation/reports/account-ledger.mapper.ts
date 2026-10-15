import type { AccountLedgerResult } from '@/application/reports/get-account-ledger.service.js';
import { formatMoney } from '@/domain/money.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toSidedResponse } from '@/presentation/reports/trial-balance.mapper.js';

/** Resposta do razão da conta: saldos e itens por lançamento (paginados) ou por dia. */
export function toAccountLedgerResponse(result: AccountLedgerResult) {
    const { account } = result;
    const base = {
        account: {
            id: account.id,
            code: account.code,
            name: account.name,
            nature: account.nature,
            accountType: account.accountType,
        },
        start: toIsoDate(result.start),
        end: toIsoDate(result.end),
        openingBalance: toSidedResponse(result.openingBalance),
        closingBalance: toSidedResponse(result.closingBalance),
    };
    if (result.days) {
        return {
            ...base,
            days: result.days.map(day => ({
                date: toIsoDate(day.date),
                debits: formatMoney(day.debits),
                credits: formatMoney(day.credits),
                balance: toSidedResponse(day.balance),
            })),
        };
    }
    return {
        ...base,
        ...toPageResponse(result.items as NonNullable<AccountLedgerResult['items']>, item => ({
            date: toIsoDate(item.date),
            number: item.number,
            journalEntryId: item.journalEntryId,
            description: item.description,
            referenceType: item.referenceType,
            debit: formatMoney(item.debit),
            credit: formatMoney(item.credit),
            balance: toSidedResponse(item.balance),
            counterparts: item.counterparts,
        })),
    };
}
