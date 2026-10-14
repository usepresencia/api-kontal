import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '@/presentation/pipes/zod-validation.pipe.js';

const schema = z.object({ name: z.string().min(1), age: z.coerce.number() });
const metadata = { type: 'body' as const };

describe('ZodValidationPipe', () => {
    it('devolve os dados parseados (com coerção)', () => {
        expect(
            new ZodValidationPipe(schema).transform({ name: 'Ana', age: '30' }, metadata),
        ).toEqual({ name: 'Ana', age: 30 });
    });

    it('lança BadRequestException com erros por campo', () => {
        const pipe = new ZodValidationPipe(schema);
        try {
            pipe.transform({ name: '', age: 'x' }, metadata);
            expect.unreachable();
        } catch (err) {
            expect(err).toBeInstanceOf(BadRequestException);
            const body = (err as BadRequestException).getResponse() as {
                message: string;
                errors: Record<string, string[]>;
            };
            expect(body.message).toBe('Validation failed');
            expect(Object.keys(body.errors).sort()).toEqual(['age', 'name']);
        }
    });
});
