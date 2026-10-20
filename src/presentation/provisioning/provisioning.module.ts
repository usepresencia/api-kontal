import { Module } from '@nestjs/common';
import { GrantKontalAccessService } from '@/application/provisioning/grant-kontal-access.service.js';
import { RevokeKontalAccessService } from '@/application/provisioning/revoke-kontal-access.service.js';
import { FirebaseAccountsAdapter } from '@/infrastructure/auth/firebase-accounts.adapter.js';
import { ServiceKeyGuard } from '@/infrastructure/auth/service-key.guard.js';
import { FIREBASE_ACCOUNTS } from '@/infrastructure/persistence/persistence.tokens.js';
import { ProvisioningController } from '@/presentation/provisioning/provisioning.controller.js';

@Module({
    controllers: [ProvisioningController],
    providers: [
        GrantKontalAccessService,
        RevokeKontalAccessService,
        ServiceKeyGuard,
        { provide: FIREBASE_ACCOUNTS, useClass: FirebaseAccountsAdapter },
    ],
})
export class ProvisioningModule {}
