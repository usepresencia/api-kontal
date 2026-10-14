import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import type { ResolvedTenantCtx } from '@/domain/auth/tenant-context.js';
import { Roles } from '@/infrastructure/auth/roles.decorator.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { TenantContext } from '@/infrastructure/auth/tenant-context.decorator.js';
import { TenantId } from '@/infrastructure/auth/tenant-id.decorator.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';

/** Rotas de prova para exercitar o guard de empresa, os papéis, os decorators e o log de erros. */
@Controller('probe')
export class ProbeController {
    @Get('company')
    @UseGuards(TenantIsolationGuard)
    company(@TenantContext() ctx: ResolvedTenantCtx) {
        return ctx;
    }

    @Post('write')
    @UseGuards(TenantIsolationGuard, RolesGuard)
    @Roles(...WRITE_ROLES)
    write(@TenantId() companyId: string) {
        return { ok: true, companyId };
    }

    @Get('boom')
    boom(): never {
        throw new Error('falha de teste');
    }
}
