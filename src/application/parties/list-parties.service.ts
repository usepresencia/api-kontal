import { Inject, Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    IPartyRepository,
    PartyFilter,
    PartyView,
} from '@/domain/repositories/party.repository.interface.js';
import { PARTY_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListPartiesService {
    constructor(@Inject(PARTY_REPOSITORY) private readonly parties: IPartyRepository) {}

    execute(companyId: string, filter: PartyFilter, page: PageRequest): Promise<Page<PartyView>> {
        return this.parties.list(companyId, filter, page);
    }
}
