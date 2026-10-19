import { Inject, Injectable } from '@nestjs/common';
import type { FirebaseAccount, IFirebaseAccounts } from '@/domain/auth/firebase-accounts.port.js';
import { grantMembership } from '@/domain/auth/kontal-memberships-claim.js';
import type { MembershipRole } from '@/domain/auth/membership-role.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import type { IProvisioningRepository } from '@/domain/repositories/provisioning.repository.interface.js';
import {
    FIREBASE_ACCOUNTS,
    COMPANY_REPOSITORY,
    PROVISIONING_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface GrantKontalAccessInput {
    /** Chave de idempotência: o mesmo evento não é processado duas vezes. */
    eventId: string;
    email: string;
    name?: string;
    companyId: string;
    role: MembershipRole;
}

@Injectable()
export class GrantKontalAccessService {
    constructor(
        @Inject(FIREBASE_ACCOUNTS) private readonly accounts: IFirebaseAccounts,
        @Inject(COMPANY_REPOSITORY) private readonly companies: ICompanyRepository,
        @Inject(PROVISIONING_REPOSITORY) private readonly provisioning: IProvisioningRepository,
    ) {}

    /**
     * Dá ao usuário acesso à empresa: cria a conta no Firebase se preciso e inclui a empresa na
     * claim `kontalMemberships`. O vínculo no banco nasce no login do usuário.
     * @returns `alreadyProcessed: true` quando o evento já tinha sido concluído
     * @throws DomainError COMPANY_NOT_FOUND, CLAIM_LIMIT_EXCEEDED
     */
    async execute(input: GrantKontalAccessInput): Promise<{ alreadyProcessed: boolean }> {
        const email = input.email.trim().toLowerCase();
        const done = await this.provisioning.findById(input.eventId);
        if (done?.status === 'DONE') return { alreadyProcessed: true };

        const company = await this.companies.findById(input.companyId);
        if (!company?.isActive) {
            throw new DomainError(ErrorCode.COMPANY_NOT_FOUND, 'Empresa não encontrada');
        }

        const record = {
            id: input.eventId,
            action: 'GRANT' as const,
            email,
            companyId: input.companyId,
            role: input.role,
        };
        try {
            const account = await this.findOrCreate(email, input.name);
            const memberships = grantMembership(account.memberships, {
                companyId: input.companyId,
                role: input.role,
            });
            await this.accounts.setMemberships(account.uid, memberships);
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

    private async findOrCreate(email: string, name?: string): Promise<FirebaseAccount> {
        return (await this.accounts.findByEmail(email)) ?? this.accounts.create({ email, name });
    }
}
