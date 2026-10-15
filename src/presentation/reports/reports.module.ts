import { Module } from '@nestjs/common';
import { GetDreService } from '@/application/reports/get-dre.service.js';
import { GetTrialBalanceService } from '@/application/reports/get-trial-balance.service.js';
import { ReportsController } from '@/presentation/reports/reports.controller.js';

@Module({
    controllers: [ReportsController],
    providers: [GetDreService, GetTrialBalanceService],
})
export class ReportsModule {}
