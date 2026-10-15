import type { AccountRef } from '@/domain/billing/account-ref.js';
import type { EntryEntity } from '@/domain/entities/entry.entity.js';
import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
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

export interface ITitleTxRepository {
    /** Trava a linha do título (`FOR UPDATE`) e o devolve; `null` se não é da empresa. */
    lock(companyId: string, id: string): Promise<TitleEntity | null>;
    insertAll(titles: readonly TitleEntity[]): Promise<void>;
    /** Grava o status, o abatido, a descrição, o vencimento e os juros do título. */
    save(title: TitleEntity): Promise<void>;
    deleteAll(ids: readonly string[]): Promise<void>;
    countEntries(titleId: string): Promise<number>;
    /** Dos ids informados, os que têm ao menos uma baixa. */
    idsWithEntries(ids: readonly string[]): Promise<Set<string>>;
}

export interface IEntryTxRepository {
    /** Devolve a baixa só se o título dela pertence à empresa. */
    find(companyId: string, id: string): Promise<EntryEntity | null>;
    insert(entry: EntryEntity): Promise<void>;
    save(entry: EntryEntity): Promise<void>;
    delete(id: string): Promise<void>;
    hasWriteOff(titleId: string): Promise<boolean>;
}

/** Repositórios ligados à mesma transação do banco. */
export interface ILedgerTx {
    journal: IJournalTxRepository;
    presets: IPresetTxRepository;
    accounts: IAccountTxRepository;
    titles: ITitleTxRepository;
    entries: IEntryTxRepository;
}

export interface ILedgerUnitOfWork {
    /** Executa a função em uma transação: se ela falhar, nada é gravado. */
    run<T>(fn: (tx: ILedgerTx) => Promise<T>): Promise<T>;
}
