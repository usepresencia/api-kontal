import { z } from 'zod';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

const optionalAccount = z.uuid().nullish();

const presetAccountsSchema = z.object({
    receivable: z.uuid(),
    payable: z.uuid(),
    revenue: optionalAccount,
    expense: optionalAccount,
    interestIncome: optionalAccount,
    discountGranted: optionalAccount,
    badDebt: optionalAccount,
    interestExpense: optionalAccount,
    discountObtained: optionalAccount,
    debtForgiveness: optionalAccount,
    openingBalance: optionalAccount,
});

/** Corpo de criação do preset (a normalização e as regras são do domínio). */
export const createPresetSchema = z.object({
    billingPlanId: z.uuid(),
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(255).optional(),
    isActive: z.boolean().optional(),
    accounts: presetAccountsSchema,
});

export type CreatePresetBody = z.infer<typeof createPresetSchema>;

/** Corpo de edição: o plano do preset não muda. */
export const updatePresetSchema = createPresetSchema.omit({ billingPlanId: true });

export type UpdatePresetBody = z.infer<typeof updatePresetSchema>;

export const listPresetsQuerySchema = pageQuerySchema.extend({
    billingPlanId: z.uuid().optional(),
    isActive: z
        .enum(['true', 'false'])
        .transform(value => value === 'true')
        .optional(),
});

export type ListPresetsQuery = z.infer<typeof listPresetsQuerySchema>;
