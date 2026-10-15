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
import { CreatePresetService } from '@/application/ledger/presets/create-preset.service.js';
import { DeletePresetService } from '@/application/ledger/presets/delete-preset.service.js';
import { GetPresetService } from '@/application/ledger/presets/get-preset.service.js';
import { ListPresetsService } from '@/application/ledger/presets/list-presets.service.js';
import { UpdatePresetService } from '@/application/ledger/presets/update-preset.service.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { toPageResponse } from '@/presentation/common/page-response.mapper.js';
import { toPresetResponse } from '@/presentation/ledger/preset.mapper.js';
import {
    type CreatePresetBody,
    createPresetSchema,
    type ListPresetsQuery,
    listPresetsQuerySchema,
    type UpdatePresetBody,
    updatePresetSchema,
} from '@/presentation/ledger/preset.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

@Controller('presets')
@UseGuards(TenantIsolationGuard)
export class PresetsController {
    constructor(
        private readonly createPreset: CreatePresetService,
        private readonly updatePreset: UpdatePresetService,
        private readonly deletePreset: DeletePresetService,
        private readonly getPreset: GetPresetService,
        private readonly listPresets: ListPresetsService,
    ) {}

    @Get()
    async list(
        @TenantId() companyId: string,
        @Query(new ZodValidationPipe(listPresetsQuerySchema)) query: ListPresetsQuery,
    ) {
        const { page, pageSize, ...filter } = query;
        return toPageResponse(
            await this.listPresets.execute(companyId, filter, { page, pageSize }),
            toPresetResponse,
        );
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async create(
        @TenantId() companyId: string,
        @Body(new ZodValidationPipe(createPresetSchema)) body: CreatePresetBody,
    ) {
        return toPresetResponse(await this.createPreset.execute(companyId, body));
    }

    @Get(':id')
    async get(@TenantId() companyId: string, @Param('id', new ParseUUIDPipe()) id: string) {
        return toPresetResponse(await this.getPreset.execute(companyId, id));
    }

    @Put(':id')
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async update(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(new ZodValidationPipe(updatePresetSchema)) body: UpdatePresetBody,
    ) {
        return toPresetResponse(await this.updatePreset.execute(companyId, id, body));
    }

    @Delete(':id')
    @HttpCode(204)
    @UseGuards(RolesGuard)
    @Roles(...WRITE_ROLES)
    async remove(
        @TenantId() companyId: string,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<void> {
        await this.deletePreset.execute(companyId, id);
    }
}
