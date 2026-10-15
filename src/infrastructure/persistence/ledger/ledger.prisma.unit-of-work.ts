import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
    ILedgerTx,
    ILedgerUnitOfWork,
} from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { AccountTxRepository } from '@/infrastructure/persistence/ledger/account.tx.repository.js';
import { EntryTxRepository } from '@/infrastructure/persistence/ledger/entry.tx.repository.js';
import { JournalTxRepository } from '@/infrastructure/persistence/ledger/journal.tx.repository.js';
import { PresetTxRepository } from '@/infrastructure/persistence/ledger/preset.tx.repository.js';
import { SeriesTxRepository } from '@/infrastructure/persistence/ledger/series.tx.repository.js';
import { TitleTxRepository } from '@/infrastructure/persistence/ledger/title.tx.repository.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

const TRANSACTION_TIMEOUT_MS = 20_000;
const TRANSACTION_MAX_WAIT_MS = 10_000;

/** Liga os repositórios à transação do cliente Prisma. */
export function buildLedgerTx(client: Prisma.TransactionClient): ILedgerTx {
    return {
        journal: new JournalTxRepository(client),
        presets: new PresetTxRepository(client),
        accounts: new AccountTxRepository(client),
        titles: new TitleTxRepository(client),
        entries: new EntryTxRepository(client),
        series: new SeriesTxRepository(client),
    };
}

@Injectable()
export class LedgerPrismaUnitOfWork implements ILedgerUnitOfWork {
    constructor(private readonly prisma: PrismaService) {}

    run<T>(fn: (tx: ILedgerTx) => Promise<T>): Promise<T> {
        return this.prisma.$transaction(client => fn(buildLedgerTx(client)), {
            timeout: TRANSACTION_TIMEOUT_MS,
            maxWait: TRANSACTION_MAX_WAIT_MS,
        });
    }
}
