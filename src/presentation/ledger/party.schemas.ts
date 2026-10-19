import { z } from 'zod';
import { PartyKind } from '@/domain/parties/party-kind.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

const text = z.string().trim().min(1).max(255);

const addressSchema = z.object({
    zipCode: z.string().trim().min(1).max(10),
    street: text,
    number: z.string().trim().min(1).max(50),
    complement: z
        .string()
        .trim()
        .max(255)
        .nullish()
        .transform(value => value || null),
    neighborhood: text,
    city: text,
    state: z.string().trim().length(2),
});

/** Corpo de criação da contraparte (a normalização e as regras são do domínio). */
export const createPartySchema = z.object({
    kind: z.enum(PartyKind),
    name: text,
    socialReason: text,
    document: z.string().trim().min(1).max(20),
    email: z.string().trim().max(255).default(''),
    phone: z.string().trim().max(20).default(''),
    address: addressSchema.nullish().transform(value => value ?? null),
    isActive: z.boolean().optional(),
    defaultPresetId: z
        .uuid()
        .nullish()
        .transform(value => value ?? null),
});

export type CreatePartyBody = z.infer<typeof createPartySchema>;

export const updatePartySchema = createPartySchema;

export type UpdatePartyBody = CreatePartyBody;

export const listPartiesQuerySchema = pageQuerySchema.extend({
    kind: z.enum(PartyKind).optional(),
    isActive: z
        .enum(['true', 'false'])
        .transform(value => value === 'true')
        .optional(),
    search: z.string().trim().min(1).max(100).optional(),
});

export type ListPartiesQuery = z.infer<typeof listPartiesQuerySchema>;
