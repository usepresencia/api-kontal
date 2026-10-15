import { Module } from '@nestjs/common';
import { GetAccountLedgerService } from '@/application/reports/get-account-ledger.service.js';
import { GetBalanceSheetService } from '@/application/reports/get-balance-sheet.service.js';
import { GetDailyJournalService } from '@/application/reports/get-daily-journal.service.js';
import { GetDreService } from '@/application/reports/get-dre.service.js';
import { GetTrialBalanceService } from '@/application/reports/get-trial-balance.service.js';
import { ReportsController } from '@/presentation/reports/reports.controller.js';

@Module({
    controllers: [ReportsController],
    providers: [
        GetDreService,
        GetTrialBalanceService,
        GetBalanceSheetService,
        GetDailyJournalService,
        GetAccountLedgerService,
    ],
})
export class ReportsModule {}
