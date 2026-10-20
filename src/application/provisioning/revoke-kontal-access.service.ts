import { Inject, Injectable } from '@nestjs/common';
import type { IFirebaseAccounts } from '@/domain/auth/firebase-accounts.port.js';
import { revokeMembership } from '@/domain/auth/kontal-memberships-claim.js';
import type { IProvisioningRepository } from '@/domain/repositories/provisioning.repository.interface.js';
import {
    FIREBASE_ACCOUNTS,
    PROVISIONING_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface RevokeKontalAccessInput {
    /** Chave de idempotência: o mesmo evento não é processado duas vezes. */
    eventId: string;
    email: string;
    companyId: string;
}

@Injectable()
export class RevokeKontalAccessService {
    constructor(
        @Inject(FIREBASE_ACCOUNTS) private readonly accounts: IFirebaseAccounts,
        @Inject(PROVISIONING_REPOSITORY) private readonly provisioning: IProvisioningRepository,
    ) {}

    /**
     * Tira a empresa da claim `kontalMemberships` do usuário. Conta ou acesso inexistente não é
     * erro. O vínculo no banco é desativado no próximo login do usuário.
     * @returns `alreadyProcessed: true` quando o evento já tinha sido concluído
     */
    async execute(input: RevokeKontalAccessInput): Promise<{ alreadyProcessed: boolean }> {
        const email = input.email.trim().toLowerCase();
        const done = await this.provisioning.findById(input.eventId);
        if (done?.status === 'DONE') return { alreadyProcessed: true };

        const record = {
            id: input.eventId,
            action: 'REVOKE' as const,
            email,
            companyId: input.companyId,
            role: null,
        };
        try {
            const account = await this.accounts.findByEmail(email);
            if (account) {
                const memberships = revokeMembership(account.memberships, input.companyId);
                if (memberships.length !== account.memberships.length) {
                    await this.accounts.setMemberships(account.uid, memberships);
                }
            }
            await this.provisioning.save({ ...record, status: 'DONE', error: null });
        } catch (error) {
            await this.provisioning
                .save({
                    ...record,
                    status: 'FAILED',
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                })
                .catch(() => undefined);
            throw error;
        }
        return { alreadyProcessed: false };
    }
}
