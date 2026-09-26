import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { SharedModule } from './shared/shared.module.js';
import { BillingModule } from './billing/billing.module.js';
import { TitlesModule } from './titles/titles.module.js';
import { LedgerModule } from './ledger/ledger.module.js';

@Module({
    imports: [SharedModule, BillingModule, TitlesModule, LedgerModule],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
