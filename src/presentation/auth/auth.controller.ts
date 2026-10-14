import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AccessibleCompaniesService } from '@/application/auth/accessible-companies.service.js';
import { SessionService } from '@/application/auth/session.service.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import { CurrentUser } from '@/infrastructure/auth/current-user.decorator.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly sessions: SessionService,
        private readonly accessibleCompanies: AccessibleCompaniesService,
    ) {}

    @Post('session')
    @HttpCode(200)
    createSession(@CurrentUser() user: SessionUser) {
        return this.sessions.createSession(user);
    }

    @Get('me')
    getMe(@CurrentUser() user: SessionUser) {
        return {
            id: user.userId,
            firebaseUid: user.firebaseUid,
            email: user.email,
            name: user.name,
        };
    }

    @Get('tenants')
    getTenants(@CurrentUser() user: SessionUser) {
        return this.accessibleCompanies.list(user);
    }
}
