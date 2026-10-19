import { z } from 'zod';
import { isValidCnpj } from '@/domain/companies/cnpj.js';
import { isValidStateCode } from '@/domain/companies/state-code.js';
import { isValidZipCode } from '@/domain/companies/zip-code.js';

const text = (max = 255) => z.string().trim().min(1).max(max);

export const addressSchema = z.object({
    zipCode: z.string().refine(isValidZipCode, 'CEP inválido'),
    street: text(),
    number: text(50),
    complement: z.string().trim().max(255).nullish(),
    neighborhood: text(),
    city: text(),
    state: z.string().refine(isValidStateCode, 'UF inválida'),
});

/** Corpo de criação e de edição da empresa (a normalização é feita pelo domínio). */
export const companyBodySchema = z.object({
    name: text(),
    socialReason: text(),
    cnpj: z.string().refine(isValidCnpj, 'CNPJ inválido'),
    openingDate: z.iso.date().transform(value => new Date(`${value}T00:00:00.000Z`)),
    cnae: text(),
    taxRegime: text(),
    email: z.email().max(255),
    phone: text(20),
    address: addressSchema,
});

export type CompanyBody = z.infer<typeof companyBodySchema>;

export const saveLogoSchema = z.object({ url: z.url().max(2048) });

export type SaveLogoBody = z.infer<typeof saveLogoSchema>;
