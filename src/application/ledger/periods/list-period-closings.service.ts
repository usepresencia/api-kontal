import { Inject, Injectable } from '@nestjs/common';
import type {
    IPeriodClosingReadRepository,
    PeriodClosingList,
} from '@/domain/repositories/period-closing-read.repository.interface.js';
import { PERIOD_CLOSING_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListPeriodClosingsService {
    constructor(
        @Inject(PERIOD_CLOSING_READ_REPOSITORY)
        private readonly reads: IPeriodClosingReadRepository,
    ) {}

    execute(companyId: string): Promise<PeriodClosingList> {
        return this.reads.list(companyId);
    }
}
