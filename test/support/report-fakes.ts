import type { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';

/** Conta de relatório: nível pelo código, nome = id, analítica e sem categoria por padrão. */
export function reportAccount(
    id: string,
    code: string,
    nature: AccountNature,
    overrides: Partial<ReportAccount> = {},
): ReportAccount {
    return {
        id,
        parentId: null,
        code,
        name: id,
        level: code.split('.').length,
        nature,
        accountType: AccountType.ANALYTIC,
        dreCategory: null,
        balanceCategory: null,
        ...overrides,
    };
}

export const synthetic = { accountType: AccountType.SYNTHETIC };

export function fakeReportAccounts() {
    return { list: vi.fn() } satisfies IReportAccountRepository;
}

export function fakeLedgerTotals() {
    return {
        monthlyMovements: vi.fn(),
        trialBalance: vi.fn(),
        balancesUntil: vi.fn(),
    } satisfies ILedgerTotalsRepository;
}
