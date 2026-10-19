import { Inject, Injectable } from '@nestjs/common';
import { requireParty } from '@/application/parties/require-party.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IPartyRepository } from '@/domain/repositories/party.repository.interface.js';
import { PARTY_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class DeletePartyService {
    constructor(@Inject(PARTY_REPOSITORY) private readonly parties: IPartyRepository) {}

    /**
     * Exclui a contraparte do tenant.
     * @throws DomainError PARTY_NOT_FOUND, PARTY_IN_USE se algum título usa a contraparte
     */
    async execute(companyId: string, id: string): Promise<void> {
        await requireParty(this.parties, companyId, id);
        if (await this.parties.isInUse(id)) {
            throw new DomainError(
                ErrorCode.PARTY_IN_USE,
                'Exclusão bloqueada: a contraparte tem títulos',
            );
        }
        await this.parties.delete(companyId, id);
    }
}
