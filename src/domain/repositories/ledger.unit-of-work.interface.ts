import type { AccountRef } from '@/domain/billing/account-ref.js';
import type { EntryEntity } from '@/domain/entities/entry.entity.js';
import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import type { PartyEntity } from '@/domain/entities/party.entity.js';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { AccountBalance } from '@/domain/reports/ledger-rows.js';

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
    /** Data até a qual o período da empresa está fechado (lê com `FOR KEY SHARE`); `null` se aberto. */
    closedThrough(companyId: string): Promise<Date | null>;
    /** Data do lançamento mais antigo da empresa; `null` se não há nenhum. */
    earliestDate(companyId: string): Promise<Date | null>;
    /** Trava a linha do lançamento (`FOR UPDATE`) e o devolve; `null` se não é da empresa. */
    lock(companyId: string, id: string): Promise<JournalEntryEntity | null>;
}

export interface IPresetTxRepository {
    /** Devolve o preset só se o plano dele pertence à empresa. */
    find(companyId: string, id: string): Promise<PresetEntity | null>;
}

export interface IPartyTxRepository {
    /** Devolve a contraparte só se for do tenant. */
    find(companyId: string, id: string): Promise<PartyEntity | null>;
}

export interface IAccountTxRepository {
    findRefs(companyId: string, ids: readonly string[]): Promise<AccountRef[]>;
    /** Dos ids informados, os usados como controle de título ou como conta a receber/pagar de preset. */
    controlAccountIds(companyId: string, ids: readonly string[]): Promise<Set<string>>;
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

export interface ISeriesTxRepository {
    insert(series: SeriesEntity): Promise<void>;
    /** Trava a linha da série (`FOR UPDATE`) e a devolve; `null` se não é da empresa. */
    lock(companyId: string, id: string): Promise<SeriesEntity | null>;
    save(series: SeriesEntity): Promise<void>;
    delete(id: string): Promise<void>;
    /** Títulos da série em ordem de índice. */
    titles(seriesId: string): Promise<TitleEntity[]>;
    /** Título de maior índice da série. */
    lastTitle(seriesId: string): Promise<TitleEntity | null>;
}

/** Fechamento de período de uma empresa. */
export interface PeriodClosingRow {
    id: string;
    companyId: string;
    throughDate: Date;
    closingEntryId: string | null;
    createdAt: Date;
}

export interface IPeriodTxRepository {
    /** Trava a linha da empresa (`FOR UPDATE`) e devolve a trava vigente; `null` se não existe. */
    lockCompany(companyId: string): Promise<{ closedThrough: Date | null } | null>;
    /** Fechamento de maior data da empresa. */
    latest(companyId: string): Promise<PeriodClosingRow | null>;
    insert(row: PeriodClosingRow): Promise<void>;
    delete(id: string): Promise<void>;
    setClosedThrough(companyId: string, date: Date | null): Promise<void>;
    /** Débitos e créditos das contas de resultado do plano entre as datas, sem lançamentos de apuração. */
    resultBalances(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<AccountBalance[]>;
}

/** Repositórios ligados à mesma transação do banco. */
export interface ILedgerTx {
    journal: IJournalTxRepository;
    presets: IPresetTxRepository;
    parties: IPartyTxRepository;
    accounts: IAccountTxRepository;
    titles: ITitleTxRepository;
    entries: IEntryTxRepository;
    series: ISeriesTxRepository;
    periods: IPeriodTxRepository;
}

export interface ILedgerUnitOfWork {
    /** Executa a função em uma transação: se ela falhar, nada é gravado. */
    run<T>(fn: (tx: ILedgerTx) => Promise<T>): Promise<T>;
}
