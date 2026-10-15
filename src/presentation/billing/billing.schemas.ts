import { z } from 'zod';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { pageQuerySchema } from '@/presentation/common/page-query.schema.js';

const name = z.string().trim().min(1).max(255);

/** Corpo de criação e de edição do plano de contas. */
export const billingPlanBodySchema = z.object({
    name,
    description: z.string().trim().max(255).optional(),
});

export type BillingPlanBody = z.infer<typeof billingPlanBodySchema>;

export const createBillingAccountSchema = z.object({
    billingPlanId: z.uuid(),
    parentId: z.uuid().nullish(),
    name,
    accountType: z.enum(AccountType),
    nature: z.enum(AccountNature).optional(),
    isActive: z.boolean().optional(),
});

export type CreateBillingAccountBody = z.infer<typeof createBillingAccountSchema>;

/** Só nome, status e tipo mudam; ao menos um campo é obrigatório. */
export const updateBillingAccountSchema = z
    .object({
        name: name.optional(),
        isActive: z.boolean().optional(),
        accountType: z.enum(AccountType).optional(),
    })
    .refine(body => Object.keys(body).length > 0, {
        message: 'Informe ao menos um campo para alterar',
    });

export type UpdateBillingAccountBody = z.infer<typeof updateBillingAccountSchema>;

export const listBillingAccountsQuerySchema = pageQuerySchema.extend({
    planId: z.uuid().optional(),
});

export type ListBillingAccountsQuery = z.infer<typeof listBillingAccountsQuerySchema>;
