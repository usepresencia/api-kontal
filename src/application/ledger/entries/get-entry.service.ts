import { Inject, Injectable } from '@nestjs/common';
import { requireEntryView } from '@/application/ledger/require-entry.js';
import type {
    EntryView,
    IEntryReadRepository,
} from '@/domain/repositories/entry-read.repository.interface.js';
import { ENTRY_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetEntryService {
    constructor(@Inject(ENTRY_READ_REPOSITORY) private readonly entries: IEntryReadRepository) {}

    execute(companyId: string, id: string): Promise<EntryView> {
        return requireEntryView(this.entries, companyId, id);
    }
}
