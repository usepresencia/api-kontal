import { Inject, Injectable } from '@nestjs/common';
import { requireParty } from '@/application/parties/require-party.js';
import type {
    IPartyRepository,
    PartyView,
} from '@/domain/repositories/party.repository.interface.js';
import { PARTY_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetPartyService {
    constructor(@Inject(PARTY_REPOSITORY) private readonly parties: IPartyRepository) {}

    execute(companyId: string, id: string): Promise<PartyView> {
        return requireParty(this.parties, companyId, id);
    }
}
