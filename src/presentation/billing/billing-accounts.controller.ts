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
import { CreateBillingAccountService } from '@/application/billing/create-billing-account.service.js';
import { DeleteBillingAccountService } from '@/application/billing/delete-billing-account.service.js';
import { GetBillingAccountService } from '@/application/billing/get-billing-account.service.js';
import { ListBillingAccountsService } from '@/application/billing/list-billing-accounts.service.js';
import { UpdateBillingAccountService } from '@/application/billing/update-billing-account.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toAccountResponse } from '@/presentation/billing/billing.mapper.js';
import {
    type CreateBillingAccountBody,
    type ListBillingAccountsQuery,
    type UpdateBillingAccountBody,
    createBillingAccountSchema,
    listBillingAccountsQuerySchema,
    updateBillingAccountSchema,
} from '@/presentation/billing/billing.schemas.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('billing-accounts')
@UseGuards(TenantIsolationGuard)
export class BillingAccountsController {
    constructor(
        private readonly createAccount: CreateBillingAccountService,
        private readonly updateAccount: UpdateBillingAccountService,
        private readonly deleteAccount: DeleteBillingAccountService,
        private readonly getAccount: GetBillingAccountService,
        private readonly listAccounts: ListBillingAccountsService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listBillingAccountsQuerySchema))
        query: ListBillingAccountsQuery,
    ) {
        const { planId, page, pageSize } = query;
        return toPageResponse(
            await this.listAccounts.execute(companyId, { planId }, { page, pageSize }),
            toAccountResponse,
        );
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(createBillingAccountSchema)) body: CreateBillingAccountBody,
    ) {
        return toAccountResponse(await this.createAccount.execute(companyId, body));
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toAccountResponse(await this.getAccount.execute(companyId, id));
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(updateBillingAccountSchema)) body: UpdateBillingAccountBody,
    ) {
        return toAccountResponse(await this.updateAccount.execute(companyId, id, body));
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async remove(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<void> {
        await this.deleteAccount.execute(companyId, id);
    }
}
