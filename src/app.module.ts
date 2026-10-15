import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { parseEnv } from '@/config/parse-env.js';
import { FirebaseAuthGuard } from '@/infrastructure/auth/firebase-auth.guard.js';
import { PlatformStaffGuard } from '@/infrastructure/auth/platform-staff.guard.js';
import { TenantAccessModule } from '@/infrastructure/auth/tenant-access.module.js';
import { ErrorLogModule } from '@/infrastructure/logging/error-log.module.js';
import { PersistenceModule } from '@/infrastructure/persistence/persistence.module.js';
import { PrismaModule } from '@/infrastructure/persistence/prisma.module.js';
import { AuthModule } from '@/presentation/auth/auth.module.js';
import { BillingModule } from '@/presentation/billing/billing.module.js';
import { CompaniesModule } from '@/presentation/companies/companies.module.js';
import { HealthModule } from '@/presentation/health/health.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: config => parseEnv(config) }),
        PrismaModule,
        PersistenceModule,
        ErrorLogModule,
        TenantAccessModule,
        AuthModule,
        CompaniesModule,
        BillingModule,
        HealthModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: FirebaseAuthGuard },
        { provide: APP_GUARD, useClass: PlatformStaffGuard },
    ],
})
export class AppModule {}
