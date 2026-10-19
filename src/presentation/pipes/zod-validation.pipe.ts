import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/** Valida o valor com um schema Zod; em falha, responde 400 com os erros por campo. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
    constructor(private readonly schema: z.ZodType) {}

    transform(value: unknown, _metadata: ArgumentMetadata): unknown {
        const result = this.schema.safeParse(value);
        if (result.success) return result.data;
        throw new BadRequestException({
            message: 'Validation failed',
            errors: z.flattenError(result.error).fieldErrors,
        });
    }
}
