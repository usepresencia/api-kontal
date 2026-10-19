import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AccessibleCompaniesService } from '@/application/auth/accessible-companies.service.js';
import { SessionService } from '@/application/auth/session.service.js';
import { FirebaseAuthStrategy } from '@/infrastructure/auth/firebase-auth.strategy.js';
import { FirebaseInitService } from '@/infrastructure/auth/firebase-init.service.js';
import { FirebaseTokenVerifier } from '@/infrastructure/auth/firebase-token.verifier.js';
import { PlatformRoleResolver } from '@/infrastructure/auth/platform-role.resolver.js';
import { SessionUserAssembler } from '@/infrastructure/auth/session-user.assembler.js';
import { UserProvisioner } from '@/infrastructure/auth/user-provisioner.js';
import { AuthController } from '@/presentation/auth/auth.controller.js';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'firebase' })],
    controllers: [AuthController],
    providers: [
        SessionService,
        AccessibleCompaniesService,
        FirebaseInitService,
        FirebaseTokenVerifier,
        UserProvisioner,
        PlatformRoleResolver,
        SessionUserAssembler,
        FirebaseAuthStrategy,
    ],
})
export class AuthModule {}
