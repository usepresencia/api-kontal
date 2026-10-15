import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetCashFlowService } from '@/application/reports/get-cash-flow.service.js';
import { GetManagementDreService } from '@/application/reports/get-management-dre.service.js';
import { GetAccountLedgerService } from '@/application/reports/get-account-ledger.service.js';
import { GetBalanceSheetService } from '@/application/reports/get-balance-sheet.service.js';
import { GetDailyJournalService } from '@/application/reports/get-daily-journal.service.js';
import { GetDreService } from '@/application/reports/get-dre.service.js';
import { GetTrialBalanceService } from '@/application/reports/get-trial-balance.service.js';
import { toCashFlowResponse } from '@/presentation/reports/cash-flow.mapper.js';
import { toManagementDreResponse } from '@/presentation/reports/management-dre.mapper.js';
import { toAccountLedgerResponse } from '@/presentation/reports/account-ledger.mapper.js';
import { toDailyJournalResponse } from '@/presentation/reports/daily-journal.mapper.js';
import { toBalanceSheetResponse } from '@/presentation/reports/balance-sheet.mapper.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';
import { toDreResponse } from '@/presentation/reports/dre.mapper.js';
import {
    type AccountLedgerQuery,
    accountLedgerQuerySchema,
    type BalanceSheetQuery,
    balanceSheetQuerySchema,
    type DailyJournalQuery,
    dailyJournalQuerySchema,
    type DreQuery,
    dreQuerySchema,
    type TrialBalanceQuery,
    trialBalanceQuerySchema,
    type CashFlowQuery,
    cashFlowQuerySchema,
} from '@/presentation/reports/report.schemas.js';
import { toTrialBalanceResponse } from '@/presentation/reports/trial-balance.mapper.js';

@Controller('reports')
@UseGuards(TenantIsolationGuard)
export class ReportsController {
    constructor(
        private readonly getDre: GetDreService,
        private readonly getTrialBalance: GetTrialBalanceService,
        private readonly getBalanceSheet: GetBalanceSheetService,
        private readonly getDailyJournal: GetDailyJournalService,
        private readonly getAccountLedger: GetAccountLedgerService,
        private readonly getManagementDre: GetManagementDreService,
        private readonly getCashFlow: GetCashFlowService,
    ) {}

    @Get('dre')
    async dre(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(dreQuerySchema)) query: DreQuery,
    ) {
        return toDreResponse(await this.getDre.execute(companyId, query));
    }

    @Get('trial-balance')
    async trialBalance(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(trialBalanceQuerySchema)) query: TrialBalanceQuery,
    ) {
        return toTrialBalanceResponse(await this.getTrialBalance.execute(companyId, query));
    }

    @Get('balance-sheet')
    async balanceSheet(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(balanceSheetQuerySchema)) query: BalanceSheetQuery,
    ) {
        return toBalanceSheetResponse(await this.getBalanceSheet.execute(companyId, query));
    }

    @Get('daily-journal')
    async dailyJournal(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(dailyJournalQuerySchema)) query: DailyJournalQuery,
    ) {
        return toDailyJournalResponse(await this.getDailyJournal.execute(companyId, query));
    }

    @Get('account-ledger')
    async accountLedger(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(accountLedgerQuerySchema)) query: AccountLedgerQuery,
    ) {
        return toAccountLedgerResponse(await this.getAccountLedger.execute(companyId, query));
    }

    @Get('cash-flow')
    async cashFlow(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(cashFlowQuerySchema)) query: CashFlowQuery,
    ) {
        return toCashFlowResponse(await this.getCashFlow.execute(companyId, query));
    }

    @Get('management-dre')
    async managementDre(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(dreQuerySchema)) query: DreQuery,
    ) {
        return toManagementDreResponse(await this.getManagementDre.execute(companyId, query));
    }
}
