import { Inject, Injectable } from '@nestjs/common';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import { buildDre, type DreReport } from '@/domain/reports/dre.js';
import {
    BILLING_PLAN_REPOSITORY,
    LEDGER_TOTALS_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface GetDreInput {
    start: Date;
    end: Date;
    billingPlanId?: string;
    groupBy?: 'month';
}

export interface DreResult {
    billingPlanId: string;
    start: Date;
    end: Date;
    report: DreReport;
}

@Injectable()
export class GetDreService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(REPORT_ACCOUNT_REPOSITORY) private readonly accounts: IReportAccountRepository,
        @Inject(LEDGER_TOTALS_REPOSITORY) private readonly totals: ILedgerTotalsRepository,
    ) {}

    /**
     * DRE de um plano da empresa no período (inclusivo), em regime de competência.
     * @throws DomainError DATE_RANGE_INVALID, BILLING_PLAN_REQUIRED, BILLING_PLAN_NOT_FOUND
     */
    async execute(companyId: string, input: GetDreInput): Promise<DreResult> {
        assertDateRange(input.start, input.end);
        const planId = await resolveReportPlan(this.plans, companyId, input.billingPlanId);
        const [accounts, movements] = await Promise.all([
            this.accounts.list(companyId, planId),
            this.totals.monthlyMovements(companyId, planId, input.start, input.end),
        ]);
        return {
            billingPlanId: planId,
            start: input.start,
            end: input.end,
            report: buildDre(accounts, movements, { byMonth: input.groupBy === 'month' }),
        };
    }
}
