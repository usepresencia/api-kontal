import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { Cents } from '@/domain/money.js';

export interface OpeningInput {
    isOpening?: boolean;
    openingDate?: Date;
    settledAmount?: Cents;
}

export interface Opening {
    openingDate: Date;
    settledAmount: Cents;
}

function invalid(message: string): never {
    throw new DomainError(ErrorCode.OPENING_TITLE_INVALID, message);
}

/**
 * Valida os campos de implantação e devolve a implantação, ou `null` para título comum.
 * @throws DomainError OPENING_TITLE_INVALID
 */
export function resolveOpening(
    input: OpeningInput,
    context: { amount: Cents; issueDate: Date | undefined; today: Date },
): Opening | null {
    if (!input.isOpening) {
        if (input.openingDate !== undefined || input.settledAmount !== undefined) {
            invalid('Os campos de implantação exigem isOpening');
        }
        return null;
    }
    const openingDate = input.openingDate;
    if (openingDate === undefined) invalid('A data de implantação é obrigatória');
    const date = openingDate as Date;
    if (Number.isNaN(date.getTime()) || date.getTime() > context.today.getTime()) {
        invalid('A data de implantação não pode ser futura');
    }
    if (context.issueDate !== undefined && context.issueDate.getTime() > date.getTime()) {
        invalid('A emissão não pode ser posterior à data de implantação');
    }
    const settledAmount = input.settledAmount ?? 0;
    if (settledAmount < 0 || settledAmount >= context.amount) {
        invalid('O valor já pago deve ser menor que o valor do título');
    }
    return { openingDate: date, settledAmount };
}
