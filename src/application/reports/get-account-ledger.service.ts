import { Inject, Injectable } from '@nestjs/common';
import { requireAccount } from '@/application/billing/require-account.js';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import type { Page } from '@/domain/pagination.js';
import {
    type LedgerDay,
    type LedgerItem,
    ledgerBalances,
    ledgerDays,
    ledgerItems,
} from '@/domain/reports/account-ledger.js';
import { descendantIds } from '@/domain/reports/account-tree.js';
import type { ReportAccount } from '@/domain/reports/report-account.js';
import type { Sided } from '@/domain/reports/sided.js';
import type { IAccountLedgerRepository } from '@/domain/repositories/account-ledger.repository.interface.js';
import type { IBillingAccountRepository } from '@/domain/repositories/billing-account.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import {
    ACCOUNT_LEDGER_REPOSITORY,
    BILLING_ACCOUNT_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface GetAccountLedgerInput {
    accountId: string;
    start: Date;
    end: Date;
    groupBy?: 'day';
    page: number;
    pageSize: number;
}

export interface AccountLedgerResult {
    account: ReportAccount;
    start: Date;
    end: Date;
    openingBalance: Sided;
    closingBalance: Sided;
    items: Page<LedgerItem> | null;
    days: LedgerDay[] | null;
}

@Injectable()
export class GetAccountLedgerService {
    constructor(
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
        @Inject(REPORT_ACCOUNT_REPOSITORY)
        private readonly reportAccounts: IReportAccountRepository,
        @Inject(ACCOUNT_LEDGER_REPOSITORY) private readonly ledger: IAccountLedgerRepository,
    ) {}

    /**
     * Razão de uma conta da empresa no período (sintética soma as descendentes), por lançamento
     * (paginado) ou por dia.
     * @throws DomainError DATE_RANGE_INVALID, BILLING_ACCOUNT_NOT_FOUND
     */
    async execute(companyId: string, input: GetAccountLedgerInput): Promise<AccountLedgerResult> {
        assertDateRange(input.start, input.end);
        const { account } = await requireAccount(this.accounts, companyId, input.accountId);
        const planAccounts = await this.reportAccounts.list(companyId, account.billingPlanId);
        const ids = descendantIds(planAccounts, account.id);
        const totals = await this.ledger.totals(companyId, ids, input.start, input.end);
        const balances = ledgerBalances(totals);
        const base = {
            account: planAccounts.find(item => item.id === account.id) as ReportAccount,
            start: input.start,
            end: input.end,
            openingBalance: balances.opening,
            closingBalance: balances.closing,
        };
        if (input.groupBy === 'day') {
            const rows = await this.ledger.days(companyId, ids, input.start, input.end);
            return { ...base, items: null, days: ledgerDays(balances.openingRaw, rows) };
        }
        const page = await this.ledger.items(companyId, ids, input.start, input.end, {
            page: input.page,
            pageSize: input.pageSize,
        });
        return {
            ...base,
            items: { ...page, items: ledgerItems(balances.openingRaw, page.items) },
            days: null,
        };
    }
}
