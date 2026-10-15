import { Inject, Injectable } from '@nestjs/common';
import { entryNotFound, requireEntryView } from '@/application/ledger/require-entry.js';
import type { PaymentMethod } from '@/domain/entities/entry.entity.js';
import type {
    EntryView,
    IEntryReadRepository,
} from '@/domain/repositories/entry-read.repository.interface.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    ENTRY_READ_REPOSITORY,
    LEDGER_UNIT_OF_WORK,
} from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class UpdateEntryService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(ENTRY_READ_REPOSITORY) private readonly entries: IEntryReadRepository,
    ) {}

    /** Altera só a descrição e a forma de pagamento; valores, datas e contas são imutáveis. */
    async execute(
        companyId: string,
        id: string,
        changes: { description?: string; paymentMethod?: PaymentMethod },
    ): Promise<EntryView> {
        await this.uow.run(async tx => {
            const entry = await tx.entries.find(companyId, id);
            if (!entry) throw entryNotFound();
            await tx.entries.save(entry.withChanges(changes));
        });
        return requireEntryView(this.entries, companyId, id);
    }
}
