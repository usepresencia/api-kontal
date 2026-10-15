import { Inject, Injectable } from '@nestjs/common';
import { requireTitleView } from '@/application/ledger/require-title.js';
import type {
    ITitleReadRepository,
    TitleView,
} from '@/domain/repositories/title-read.repository.interface.js';
import { TITLE_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetTitleService {
    constructor(@Inject(TITLE_READ_REPOSITORY) private readonly titles: ITitleReadRepository) {}

    execute(companyId: string, id: string): Promise<TitleView> {
        return requireTitleView(this.titles, companyId, id);
    }
}
