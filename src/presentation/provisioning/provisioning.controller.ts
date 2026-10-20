import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { GrantKontalAccessService } from '@/application/provisioning/grant-kontal-access.service.js';
import { RevokeKontalAccessService } from '@/application/provisioning/revoke-kontal-access.service.js';
import { Public } from '@/infrastructure/auth/public.decorator.js';
import { ServiceKeyGuard } from '@/infrastructure/auth/service-key.guard.js';
import {
    type GrantAccessBody,
    type RevokeAccessBody,
    grantAccessSchema,
    revokeAccessSchema,
} from '@/presentation/provisioning/provisioning.schemas.js';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

/** Provisionamento de acesso chamado por outros sistemas, autenticado pela chave de serviço. */
@Controller('provisioning')
@Public()
@UseGuards(ServiceKeyGuard)
export class ProvisioningController {
    constructor(
        private readonly grant: GrantKontalAccessService,
        private readonly revoke: RevokeKontalAccessService,
    ) {}

    @Post('access')
    @HttpCode(200)
    async grantAccess(@Body(new ZodValidationPipe(grantAccessSchema)) body: GrantAccessBody) {
        return this.grant.execute(body);
    }

    @Post('access/revoke')
    @HttpCode(200)
    async revokeAccess(@Body(new ZodValidationPipe(revokeAccessSchema)) body: RevokeAccessBody) {
        return this.revoke.execute(body);
    }
}
