import { Inject, Injectable } from '@nestjs/common';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import {
    buildCashFlow,
    type CashDay,
    type CashFlowReport,
    type CashGroupBy,
    withPayments,
} from '@/domain/reports/cash-flow.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type { ICashFlowRepository } from '@/domain/repositories/cash-flow.repository.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import {
    BILLING_PLAN_REPOSITORY,
    CASH_FLOW_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export const MAX_CASH_DAYS = 366;

export interface GetCashFlowInput {
    start: Date;
    end: Date;
    billingPlanId?: string;
    groupBy?: CashGroupBy;
}

export interface CashFlowResult {
    billingPlanId: string;
    start: Date;
    end: Date;
    groupBy: CashGroupBy | undefined;
    report: CashFlowReport;
    days: CashDay[] | null;
}

@Injectable()
export class GetCashFlowService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(REPORT_ACCOUNT_REPOSITORY) private readonly accounts: IReportAccountRepository,
        @Inject(CASH_FLOW_REPOSITORY) private readonly cash: ICashFlowRepository,
    ) {}

    /**
     * Fluxo de caixa realizado de um plano da empresa no período (inclusivo); com `groupBy=day`
     * o período vai até 366 dias e cada dia traz seus pagamentos.
     * @throws DomainError DATE_RANGE_INVALID, BILLING_PLAN_REQUIRED, BILLING_PLAN_NOT_FOUND
     */
    async execute(companyId: string, input: GetCashFlowInput): Promise<CashFlowResult> {
        assertDateRange(
            input.start,
            input.end,
            input.groupBy === 'day' ? MAX_CASH_DAYS : undefined,
        );
        const planId = await resolveReportPlan(this.plans, companyId, input.billingPlanId);
        const [accounts, rows] = await Promise.all([
            this.accounts.list(companyId, planId),
            this.cash.totals(companyId, planId, input.start, input.end, input.groupBy),
        ]);
        const report = buildCashFlow(accounts, rows, input.groupBy);
        const days =
            input.groupBy === 'day'
                ? withPayments(
                      report.buckets ?? [],
                      await this.cash.payments(companyId, planId, input.start, input.end),
                  )
                : null;
        return {
            billingPlanId: planId,
            start: input.start,
            end: input.end,
            groupBy: input.groupBy,
            report,
            days,
        };
    }
}
