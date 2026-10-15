import { Module } from '@nestjs/common';
import { GetDreService } from '@/application/reports/get-dre.service.js';
import { ReportsController } from '@/presentation/reports/reports.controller.js';

@Module({
    controllers: [ReportsController],
    providers: [GetDreService],
})
export class ReportsModule {}
