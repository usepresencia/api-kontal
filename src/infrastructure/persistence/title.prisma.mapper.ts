import { Prisma, type Title } from '@prisma/client';
import { TitleEntity } from '@/domain/entities/title.entity.js';
import { toCents, toDecimal } from '@/infrastructure/persistence/money.mapper.js';

export function toTitleEntity(row: Title): TitleEntity {
    return TitleEntity.fromPersistence({
        id: row.id,
        companyId: row.companyId,
        presetId: row.presetId,
        controlAccountId: row.controlAccountId,
        resultAccountId: row.resultAccountId,
        seriesId: row.seriesId,
        seriesIndex: row.seriesIndex,
        type: row.type,
        status: row.status,
        description: row.description,
        amount: toCents(row.amount),
        settledAmount: toCents(row.settledAmount),
        issueDate: row.issueDate,
        expirationDate: row.expirationDate,
        feesPercentageMonthly: Number(row.feesPercentageMonthly.toFixed(2)),
        isOpening: row.isOpening,
        openingDate: row.openingDate,
        createdAt: row.createdAt,
    });
}

const fees = (title: TitleEntity) => new Prisma.Decimal(title.feesPercentageMonthly.toFixed(2));

/** Dados de criação do título para `create`/`createMany`. */
export function toTitleCreateData(title: TitleEntity) {
    return {
        id: title.id,
        companyId: title.companyId,
        presetId: title.presetId,
        controlAccountId: title.controlAccountId,
        resultAccountId: title.resultAccountId,
        seriesId: title.seriesId,
        seriesIndex: title.seriesIndex,
        type: title.type,
        status: title.status,
        description: title.description,
        amount: toDecimal(title.amount),
        settledAmount: toDecimal(title.settledAmount),
        issueDate: title.issueDate,
        expirationDate: title.expirationDate,
        feesPercentageMonthly: fees(title),
        isOpening: title.isOpening,
        openingDate: title.openingDate,
        createdAt: title.createdAt,
    };
}

/** Colunas que mudam depois da criação do título. */
export function toTitleUpdateData(title: TitleEntity) {
    return {
        status: title.status,
        settledAmount: toDecimal(title.settledAmount),
        description: title.description,
        expirationDate: title.expirationDate,
        feesPercentageMonthly: fees(title),
    };
}
