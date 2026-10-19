import { Inject, Injectable } from '@nestjs/common';
import { requireLockedTitle, requireTitleView } from '@/application/ledger/require-title.js';
import { assertLockedFieldsUnchanged } from '@/domain/entities/title.entity.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { Cents } from '@/domain/money.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import type {
    ITitleReadRepository,
    TitleView,
} from '@/domain/repositories/title-read.repository.interface.js';
import {
    LEDGER_UNIT_OF_WORK,
    TITLE_READ_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface UpdateTitleInput {
    description?: string;
    expirationDate?: Date;
    feesPercentageMonthly?: number;
    /** Campos travados: se vierem diferentes dos atuais, a edição é recusada. */
    locked?: { type?: TitleType; amount?: Cents; presetId?: string; issueDate?: Date };
}

@Injectable()
export class UpdateTitleService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(TITLE_READ_REPOSITORY) private readonly titles: ITitleReadRepository,
    ) {}

    /**
     * Altera descrição, vencimento e juros mensais.
     * @throws DomainError TITLE_FIELD_LOCKED se tentar alterar tipo, valor, preset ou emissão
     */
    async execute(companyId: string, id: string, input: UpdateTitleInput): Promise<TitleView> {
        await this.uow.run(async tx => {
            const title = await requireLockedTitle(tx, companyId, id);
            assertLockedFieldsUnchanged(title, input.locked ?? {});
            await tx.titles.save(
                title.withEdits({
                    description: input.description,
                    expirationDate: input.expirationDate,
                    feesPercentageMonthly: input.feesPercentageMonthly,
                }),
            );
        });
        return requireTitleView(this.titles, companyId, id);
    }
}
