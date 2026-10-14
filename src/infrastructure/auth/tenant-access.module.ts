import { Global, Module } from '@nestjs/common';
import { TenantRoleResolver } from '@/infrastructure/auth/tenant-role.resolver.js';

@Global()
@Module({
    providers: [TenantRoleResolver],
    exports: [TenantRoleResolver],
})
export class TenantAccessModule {}
