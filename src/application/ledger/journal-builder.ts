import { randomUUID } from 'node:crypto';
import { JournalEntryEntity, type JournalLine } from '@/domain/entities/journal-entry.entity.js';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import { creationLines, reversalDate, reverseLines } from '@/domain/ledger/posting.policy.js';

/** Lançamento de criação do título, na data de emissão. */
export function creationJournal(title: TitleEntity): JournalEntryEntity {
    return JournalEntryEntity.create({
        id: randomUUID(),
        companyId: title.companyId,
        date: title.issueDate,
        description: `Título: ${title.description} - criação`,
        referenceType: JournalRefType.TITLE_CREATION,
        referenceId: title.id,
        lines: creationLines(
            {
                type: title.type,
                controlAccountId: title.controlAccountId,
                resultAccountId: title.resultAccountId,
            },
            title.amount,
            title.description,
        ),
    });
}

/** Estorno de um lançamento: linhas invertidas, na data mais tardia entre o evento e o original. */
export function reversalJournal(params: {
    original: JournalEntryEntity;
    referenceType: JournalRefType;
    referenceId: string;
    eventDate: Date;
    description: string;
}): JournalEntryEntity {
    return JournalEntryEntity.create({
        id: randomUUID(),
        companyId: params.original.companyId,
        date: reversalDate(params.eventDate, params.original.date),
        description: params.description,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
        lines: reverseLines(params.original.lines, 'Estorno'),
    });
}

/** Lançamento de uma baixa (pagamento ou perda) com as linhas já montadas. */
export function settlementJournal(params: {
    title: TitleEntity;
    entryId: string;
    date: Date;
    description: string;
    lines: readonly JournalLine[];
}): JournalEntryEntity {
    return JournalEntryEntity.create({
        id: randomUUID(),
        companyId: params.title.companyId,
        date: params.date,
        description: params.description,
        referenceType: JournalRefType.SETTLEMENT,
        referenceId: params.entryId,
        lines: params.lines,
    });
}

/** Lançamento manual: referência ao próprio id. */
export function manualJournal(params: {
    companyId: string;
    date: Date;
    description: string;
    lines: readonly JournalLine[];
}): JournalEntryEntity {
    const id = randomUUID();
    return JournalEntryEntity.create({
        id,
        companyId: params.companyId,
        date: params.date,
        description: params.description,
        referenceType: JournalRefType.MANUAL,
        referenceId: id,
        lines: params.lines,
    });
}

/** Estorno de lançamento manual: linhas invertidas, na data mais tardia entre hoje e a do original. */
export function manualReversalJournal(params: {
    original: JournalEntryEntity;
    today: Date;
    description?: string;
}): JournalEntryEntity {
    return reversalJournal({
        original: params.original,
        referenceType: JournalRefType.MANUAL_REVERSAL,
        referenceId: params.original.id,
        eventDate: params.today,
        description: params.description ?? `Estorno: ${params.original.description}`,
    });
}
