import { Module } from '@nestjs/common';
import { CreateBillingAccountService } from '@/application/billing/create-billing-account.service.js';
import { CreateBillingPlanService } from '@/application/billing/create-billing-plan.service.js';
import { DeleteBillingAccountService } from '@/application/billing/delete-billing-account.service.js';
import { DeleteBillingPlanService } from '@/application/billing/delete-billing-plan.service.js';
import { GetBillingAccountService } from '@/application/billing/get-billing-account.service.js';
import { GetBillingPlanService } from '@/application/billing/get-billing-plan.service.js';
import { ListBillingAccountsService } from '@/application/billing/list-billing-accounts.service.js';
import { ListBillingPlansService } from '@/application/billing/list-billing-plans.service.js';
import { ListPlanAccountsService } from '@/application/billing/list-plan-accounts.service.js';
import { UpdateBillingAccountService } from '@/application/billing/update-billing-account.service.js';
import { SetDefaultBillingPlanService } from '@/application/billing/set-default-billing-plan.service.js';
import { UpdateBillingPlanService } from '@/application/billing/update-billing-plan.service.js';
import { BillingAccountsController } from '@/presentation/billing/billing-accounts.controller.js';
import { BillingPlansController } from '@/presentation/billing/billing-plans.controller.js';

@Module({
    controllers: [BillingPlansController, BillingAccountsController],
    providers: [
        CreateBillingPlanService,
        UpdateBillingPlanService,
        DeleteBillingPlanService,
        GetBillingPlanService,
        ListBillingPlansService,
        ListPlanAccountsService,
        SetDefaultBillingPlanService,
        CreateBillingAccountService,
        UpdateBillingAccountService,
        DeleteBillingAccountService,
        GetBillingAccountService,
        ListBillingAccountsService,
    ],
})
export class BillingModule {}
