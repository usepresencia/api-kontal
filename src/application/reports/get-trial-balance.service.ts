import { Inject, Injectable } from '@nestjs/common';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import { buildTrialBalance, type TrialBalanceReport } from '@/domain/reports/trial-balance.js';
import {
    BILLING_PLAN_REPOSITORY,
    LEDGER_TOTALS_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface GetTrialBalanceInput {
    start: Date;
    end: Date;
    billingPlanId?: string;
    maxLevel?: number;
}

export interface TrialBalanceResult {
    billingPlanId: string;
    start: Date;
    end: Date;
    report: TrialBalanceReport;
}

@Injectable()
export class GetTrialBalanceService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(REPORT_ACCOUNT_REPOSITORY) private readonly accounts: IReportAccountRepository,
        @Inject(LEDGER_TOTALS_REPOSITORY) private readonly totals: ILedgerTotalsRepository,
    ) {}

    /**
     * Balancete de verificação de um plano da empresa no período (inclusivo).
     * @throws DomainError DATE_RANGE_INVALID, BILLING_PLAN_REQUIRED, BILLING_PLAN_NOT_FOUND
     */
    async execute(companyId: string, input: GetTrialBalanceInput): Promise<TrialBalanceResult> {
        assertDateRange(input.start, input.end);
        const planId = await resolveReportPlan(this.plans, companyId, input.billingPlanId);
        const [accounts, rows] = await Promise.all([
            this.accounts.list(companyId, planId),
            this.totals.trialBalance(companyId, planId, input.start, input.end),
        ]);
        return {
            billingPlanId: planId,
            start: input.start,
            end: input.end,
            report: buildTrialBalance(accounts, rows, { maxLevel: input.maxLevel }),
        };
    }
}
