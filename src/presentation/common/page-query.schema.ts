import { z } from 'zod';

/** Parâmetros de paginação da query: `page` a partir de 1 e `pageSize` de 1 a 100. */
export const pageQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;
