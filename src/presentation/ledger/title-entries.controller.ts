import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CreateEntryService } from '@/application/ledger/entries/create-entry.service.js';
import { ListEntriesService } from '@/application/ledger/entries/list-entries.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { type PageQuery, pageQuerySchema } from '@/presentation/common/page-query.schema.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toEntryResponse } from '@/presentation/ledger/entry.mapper.js';
import { type CreateEntryBody, createEntrySchema } from '@/presentation/ledger/entry.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

/** Baixas de um título específico. */
@Controller('titles/:titleId/entries')
@UseGuards(TenantIsolationGuard)
export class TitleEntriesController {
    constructor(
        private readonly createEntry: CreateEntryService,
        private readonly listEntries: ListEntriesService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Param('titleId', new ParseUUIDPipe()) titleId: string,
        @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
    ) {
        return toPageResponse(
            await this.listEntries.execute(companyId, { titleId }, query),
            toEntryResponse,
        );
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Param('titleId', new ParseUUIDPipe()) titleId: string,
        @Body(new ZodValidationPipe(createEntrySchema)) body: CreateEntryBody,
    ) {
        return toEntryResponse(
            await this.createEntry.execute(companyId, titleId, {
                billingAccountId: body.billingAccountId,
                principal: body.principalAmount,
                interest: body.interestAmount,
                fine: body.fineAmount,
                discount: body.discountAmount,
                paidAt: body.paidAt,
                paymentMethod: body.paymentMethod,
                description: body.description,
            }),
        );
    }
}
