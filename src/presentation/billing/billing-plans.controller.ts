import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CreateBillingPlanService } from '@/application/billing/create-billing-plan.service.js';
import { DeleteBillingPlanService } from '@/application/billing/delete-billing-plan.service.js';
import { GetBillingPlanService } from '@/application/billing/get-billing-plan.service.js';
import { ListBillingPlansService } from '@/application/billing/list-billing-plans.service.js';
import { ListPlanAccountsService } from '@/application/billing/list-plan-accounts.service.js';
import { SetDefaultBillingPlanService } from '@/application/billing/set-default-billing-plan.service.js';
import { UpdateBillingPlanService } from '@/application/billing/update-billing-plan.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toAccountResponse, toPlanResponse } from '@/presentation/billing/billing.mapper.js';
import {
    type BillingPlanBody,
    billingPlanBodySchema,
} from '@/presentation/billing/billing.schemas.js';
import { type PageQuery, pageQuerySchema } from '@/presentation/common/page-query.schema.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('billing-plans')
@UseGuards(TenantIsolationGuard)
export class BillingPlansController {
    constructor(
        private readonly createPlan: CreateBillingPlanService,
        private readonly updatePlan: UpdateBillingPlanService,
        private readonly deletePlan: DeleteBillingPlanService,
        private readonly getPlan: GetBillingPlanService,
        private readonly listPlans: ListBillingPlansService,
        private readonly listPlanAccounts: ListPlanAccountsService,
        private readonly setDefaultPlan: SetDefaultBillingPlanService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
    ) {
        return toPageResponse(await this.listPlans.execute(companyId, query), toPlanResponse);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(billingPlanBodySchema)) body: BillingPlanBody,
    ) {
        return toPlanResponse(await this.createPlan.execute(companyId, body));
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toPlanResponse(await this.getPlan.execute(companyId, id));
    }

    @Get(':id/accounts')
    async accounts(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        const views = await this.listPlanAccounts.execute(companyId, id);
        return views.map(toAccountResponse);
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(billingPlanBodySchema)) body: BillingPlanBody,
    ) {
        return toPlanResponse(await this.updatePlan.execute(companyId, id, body));
    }

    @Post(':id/default')
    @HttpCode(200)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async makeDefault(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toPlanResponse(await this.setDefaultPlan.execute(companyId, id));
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async remove(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<void> {
        await this.deletePlan.execute(companyId, id);
    }
}
