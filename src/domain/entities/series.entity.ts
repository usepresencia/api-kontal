import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { requiredText } from '@/domain/required-text.js';
import { type SeriesFrequency, SeriesKind } from '@/domain/series/series-schedule.js';

export interface SeriesRow {
    id: string;
    companyId: string;
    kind: SeriesKind;
    frequency: SeriesFrequency;
    totalCount: number;
    baseDescription: string;
    firstIssueDate: Date;
    firstExpirationDate: Date;
    createdAt: Date;
}

/** Agrupa os títulos gerados por um parcelado ou por uma recorrência. */
export class SeriesEntity {
    private constructor(private readonly row: SeriesRow) {}

    get id(): string {
        return this.row.id;
    }
    get companyId(): string {
        return this.row.companyId;
    }
    get kind(): SeriesKind {
        return this.row.kind;
    }
    get frequency(): SeriesFrequency {
        return this.row.frequency;
    }
    get totalCount(): number {
        return this.row.totalCount;
    }
    get baseDescription(): string {
        return this.row.baseDescription;
    }
    get firstIssueDate(): Date {
        return this.row.firstIssueDate;
    }
    get firstExpirationDate(): Date {
        return this.row.firstExpirationDate;
    }
    get createdAt(): Date {
        return this.row.createdAt;
    }

    static create(params: Omit<SeriesRow, 'createdAt'> & { createdAt?: Date }): SeriesEntity {
        if (!Number.isInteger(params.totalCount) || params.totalCount < 1) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Quantidade da série inválida');
        }
        return new SeriesEntity({
            ...params,
            baseDescription: requiredText(params.baseDescription, 'Descrição da série'),
            createdAt: params.createdAt ?? new Date(),
        });
    }

    withTotalCount(totalCount: number): SeriesEntity {
        return new SeriesEntity({ ...this.row, totalCount });
    }

    /**
     * Garante que a série pode receber novas ocorrências.
     * @throws DomainError SERIES_NOT_EXTENDABLE se for parcelada
     */
    assertExtendable(): void {
        if (this.row.kind !== SeriesKind.RECURRING) {
            throw new DomainError(
                ErrorCode.SERIES_NOT_EXTENDABLE,
                'Somente séries recorrentes podem ser estendidas',
            );
        }
    }

    static fromPersistence(row: SeriesRow): SeriesEntity {
        return new SeriesEntity(row);
    }
}
