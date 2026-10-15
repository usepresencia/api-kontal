import { Inject, Injectable } from '@nestjs/common';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import { type BalanceSheet, buildBalanceSheet } from '@/domain/reports/balance-sheet.js';
import {
    BILLING_PLAN_REPOSITORY,
    LEDGER_TOTALS_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface BalanceSheetResult {
    billingPlanId: string;
    date: Date;
    sheet: BalanceSheet;
}

@Injectable()
export class GetBalanceSheetService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(REPORT_ACCOUNT_REPOSITORY) private readonly accounts: IReportAccountRepository,
        @Inject(LEDGER_TOTALS_REPOSITORY) private readonly totals: ILedgerTotalsRepository,
    ) {}

    /**
     * Balanço patrimonial de um plano da empresa na data (inclusiva).
     * @throws DomainError BILLING_PLAN_REQUIRED, BILLING_PLAN_NOT_FOUND
     */
    async execute(
        companyId: string,
        input: { date: Date; billingPlanId?: string },
    ): Promise<BalanceSheetResult> {
        const planId = await resolveReportPlan(this.plans, companyId, input.billingPlanId);
        const [accounts, balances] = await Promise.all([
            this.accounts.list(companyId, planId),
            this.totals.balancesUntil(companyId, planId, input.date),
        ]);
        return {
            billingPlanId: planId,
            date: input.date,
            sheet: buildBalanceSheet(accounts, balances),
        };
    }
}
