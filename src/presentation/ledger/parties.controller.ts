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
import { CreatePartyService } from '@/application/parties/create-party.service.js';
import { DeletePartyService } from '@/application/parties/delete-party.service.js';
import { GetPartyService } from '@/application/parties/get-party.service.js';
import { ListPartiesService } from '@/application/parties/list-parties.service.js';
import { UpdatePartyService } from '@/application/parties/update-party.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toPartyResponse } from '@/presentation/ledger/party.mapper.js';
import {
    type CreatePartyBody,
    createPartySchema,
    type ListPartiesQuery,
    listPartiesQuerySchema,
    type UpdatePartyBody,
    updatePartySchema,
} from '@/presentation/ledger/party.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('parties')
@UseGuards(TenantIsolationGuard)
export class PartiesController {
    constructor(
        private readonly createParty: CreatePartyService,
        private readonly updateParty: UpdatePartyService,
        private readonly deleteParty: DeletePartyService,
        private readonly getParty: GetPartyService,
        private readonly listParties: ListPartiesService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listPartiesQuerySchema)) query: ListPartiesQuery,
    ) {
        const { page, pageSize, ...filter } = query;
        return toPageResponse(
            await this.listParties.execute(companyId, filter, { page, pageSize }),
            toPartyResponse,
        );
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(createPartySchema)) body: CreatePartyBody,
    ) {
        return toPartyResponse(await this.createParty.execute(companyId, body));
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toPartyResponse(await this.getParty.execute(companyId, id));
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(updatePartySchema)) body: UpdatePartyBody,
    ) {
        return toPartyResponse(await this.updateParty.execute(companyId, id, body));
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async remove(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<void> {
        await this.deleteParty.execute(companyId, id);
    }
}
