import { formatMoney } from '@/domain/money.js';
import type { JournalView } from '@/domain/repositories/journal-read.repository.interface.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

/** Resposta da API para um lançamento: débitos antes dos créditos, contas com código e nome. */
export function toJournalResponse({ entry, number, accounts, reversedBy }: JournalView) {
    const lines = entry.lines
        .map(line => ({
            accountId: line.accountId,
            accountCode: accounts[line.accountId].code,
            accountName: accounts[line.accountId].name,
            debit: formatMoney(line.debit),
            credit: formatMoney(line.credit),
            memo: line.memo,
            isCredit: line.credit > 0,
        }))
        .sort((a, b) =>
            a.isCredit === b.isCredit
                ? a.accountCode.localeCompare(b.accountCode)
                : Number(a.isCredit) - Number(b.isCredit),
        )
        .map(({ isCredit: _isCredit, ...line }) => line);
    return {
        id: entry.id,
        number,
        date: toIsoDate(entry.date),
        description: entry.description,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        totalDebits: formatMoney(entry.totalDebits),
        totalCredits: formatMoney(entry.totalCredits),
        createdAt: entry.createdAt.toISOString(),
        reversedBy,
        lines,
    };
}
