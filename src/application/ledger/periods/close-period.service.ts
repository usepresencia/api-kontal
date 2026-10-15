import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { closingJournal } from '@/application/ledger/journal-builder.js';
import { resolveReportPlan } from '@/application/reports/resolve-report-plan.js';
import type { IClock } from '@/domain/clock.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { buildClosingLines } from '@/domain/ledger/closing-entry.js';
import {
    assertClosableMonth,
    assertRetainedAccount,
    assertRetainedInput,
    isDecember,
} from '@/domain/ledger/period-closing.policy.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type {
    ILedgerTx,
    ILedgerUnitOfWork,
    PeriodClosingRow,
} from '@/domain/repositories/ledger.unit-of-work.interface.js';
import type { IReportAccountRepository } from '@/domain/repositories/report-account.repository.interface.js';
import {
    BILLING_PLAN_REPOSITORY,
    LEDGER_UNIT_OF_WORK,
    REPORT_ACCOUNT_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

export interface ClosePeriodInput {
    month: string;
    billingPlanId?: string;
    retainedEarningsAccountId?: string;
}

@Injectable()
export class ClosePeriodService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(REPORT_ACCOUNT_REPOSITORY)
        private readonly reportAccounts: IReportAccountRepository,
    ) {}

    /**
     * Fecha o mês seguinte ao último fechado, com a empresa travada; em dezembro grava também a
     * apuração do exercício contra a conta de lucros acumulados.
     * @throws DomainError COMPANY_NOT_FOUND, PERIOD_CLOSING_INVALID,
     *   RETAINED_EARNINGS_ACCOUNT_INVALID, BILLING_PLAN_REQUIRED, BILLING_PLAN_NOT_FOUND
     */
    execute(companyId: string, input: ClosePeriodInput): Promise<PeriodClosingRow> {
        return this.uow.run(async tx => {
            const company = await tx.periods.lockCompany(companyId);
            if (!company) {
                throw new DomainError(ErrorCode.COMPANY_NOT_FOUND, 'Empresa não encontrada');
            }
            const throughDate = assertClosableMonth({
                month: input.month,
                today: this.clock.today(),
                closedThrough: company.closedThrough,
                earliestLedgerDate: await tx.journal.earliestDate(companyId),
            });
            assertRetainedInput(input.month, input.retainedEarningsAccountId);
            const closingId = randomUUID();
            const closingEntryId = isDecember(input.month)
                ? await this.closeYear(tx, companyId, closingId, throughDate, input)
                : null;
            const row: PeriodClosingRow = {
                id: closingId,
                companyId,
                throughDate,
                closingEntryId,
                createdAt: new Date(),
            };
            await tx.periods.insert(row);
            await tx.periods.setClosedThrough(companyId, throughDate);
            return row;
        });
    }

    private async closeYear(
        tx: ILedgerTx,
        companyId: string,
        closingId: string,
        throughDate: Date,
        input: ClosePeriodInput,
    ): Promise<string | null> {
        const retainedId = input.retainedEarningsAccountId as string;
        const planId = await resolveReportPlan(this.plans, companyId, input.billingPlanId);
        const [ref] = await tx.accounts.findRefs(companyId, [retainedId]);
        assertRetainedAccount(planId, ref);
        const start = new Date(Date.UTC(throughDate.getUTCFullYear(), 0, 1));
        const [accounts, balances] = await Promise.all([
            this.reportAccounts.list(companyId, planId),
            tx.periods.resultBalances(companyId, planId, start, throughDate),
        ]);
        const lines = buildClosingLines(accounts, balances, retainedId);
        if (!lines) return null;
        const entry = closingJournal({ companyId, closingId, date: throughDate, lines });
        await tx.journal.writeAll([entry]);
        return entry.id;
    }
}
