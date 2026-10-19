import type { PeriodClosingRow } from '@/domain/repositories/ledger.unit-of-work.interface.js';

export interface PeriodClosingList {
    closedThrough: Date | null;
    items: PeriodClosingRow[];
}

export interface IPeriodClosingReadRepository {
    /** Trava vigente e fechamentos da empresa, do mais recente ao mais antigo. */
    list(companyId: string): Promise<PeriodClosingList>;
}
