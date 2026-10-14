import { Global, Module } from '@nestjs/common';
import { CompanyPrismaRepository } from '@/infrastructure/persistence/company.prisma.repository.js';
import { MembershipPrismaRepository } from '@/infrastructure/persistence/membership.prisma.repository.js';
import {
    COMPANY_REPOSITORY,
    MEMBERSHIP_REPOSITORY,
    PLATFORM_ACCESS_REPOSITORY,
    USER_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { PlatformAccessPrismaRepository } from '@/infrastructure/persistence/platform-access.prisma.repository.js';
import { UserPrismaRepository } from '@/infrastructure/persistence/user.prisma.repository.js';

@Global()
@Module({
    providers: [
        { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
        { provide: COMPANY_REPOSITORY, useClass: CompanyPrismaRepository },
        { provide: MEMBERSHIP_REPOSITORY, useClass: MembershipPrismaRepository },
        { provide: PLATFORM_ACCESS_REPOSITORY, useClass: PlatformAccessPrismaRepository },
    ],
    exports: [
        USER_REPOSITORY,
        COMPANY_REPOSITORY,
        MEMBERSHIP_REPOSITORY,
        PLATFORM_ACCESS_REPOSITORY,
    ],
})
export class PersistenceModule {}
