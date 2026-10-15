import { Inject, Injectable } from '@nestjs/common';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import type { Page } from '@/domain/pagination.js';
import { assembleDays, type DailyJournalDay } from '@/domain/reports/daily-journal.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type { IDailyJournalRepository } from '@/domain/repositories/daily-journal.repository.interface.js';
import {
    BILLING_PLAN_REPOSITORY,
    DAILY_JOURNAL_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface GetDailyJournalInput {
    start: Date;
    end: Date;
    billingPlanId?: string;
    page: number;
    pageSize: number;
}

export interface DailyJournalResult {
    billingPlanId: string;
    start: Date;
    end: Date;
    days: Page<DailyJournalDay>;
}

@Injectable()
export class GetDailyJournalService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(DAILY_JOURNAL_REPOSITORY) private readonly journal: IDailyJournalRepository,
    ) {}

    /**
     * Livro diário de um plano da empresa: uma página de dias com os lançamentos de cada dia.
     * @throws DomainError DATE_RANGE_INVALID, BILLING_PLAN_REQUIRED, BILLING_PLAN_NOT_FOUND
     */
    async execute(companyId: string, input: GetDailyJournalInput): Promise<DailyJournalResult> {
        assertDateRange(input.start, input.end);
        const planId = await resolveReportPlan(this.plans, companyId, input.billingPlanId);
        const days = await this.journal.days(companyId, planId, input.start, input.end, {
            page: input.page,
            pageSize: input.pageSize,
        });
        const entries = await this.journal.entriesOn(
            companyId,
            planId,
            days.items.map(day => day.date),
        );
        return {
            billingPlanId: planId,
            start: input.start,
            end: input.end,
            days: { ...days, items: assembleDays(days.items, entries) },
        };
    }
}
