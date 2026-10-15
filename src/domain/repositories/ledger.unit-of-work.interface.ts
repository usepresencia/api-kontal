import type { AccountRef } from '@/domain/billing/account-ref.js';
import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';

export interface IJournalTxRepository {
    find(referenceType: JournalRefType, referenceId: string): Promise<JournalEntryEntity | null>;
    /** Lançamentos de um tipo para vários eventos, em uma consulta. */
    findAll(
        referenceType: JournalRefType,
        referenceIds: readonly string[],
    ): Promise<JournalEntryEntity[]>;
    /**
     * Grava os lançamentos e suas linhas em lote.
     * @throws DomainError CONFLICT se alguma referência já tem lançamento
     */
    writeAll(entries: readonly JournalEntryEntity[]): Promise<void>;
}

export interface IPresetTxRepository {
    /** Devolve o preset só se o plano dele pertence à empresa. */
    find(companyId: string, id: string): Promise<PresetEntity | null>;
}

export interface IAccountTxRepository {
    findRefs(companyId: string, ids: readonly string[]): Promise<AccountRef[]>;
}

/** Repositórios ligados à mesma transação do banco. */
export interface ILedgerTx {
    journal: IJournalTxRepository;
    presets: IPresetTxRepository;
    accounts: IAccountTxRepository;
}

export interface ILedgerUnitOfWork {
    /** Executa a função em uma transação: se ela falhar, nada é gravado. */
    run<T>(fn: (tx: ILedgerTx) => Promise<T>): Promise<T>;
}
