import type { Prisma } from '@prisma/client';
import { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';

export type CompanyWithAddress = Prisma.CompanyGetPayload<{ include: { address: true } }>;

/** Converte a linha do banco (com endereço) na entidade de domínio. */
export function toCompanyProfile(row: CompanyWithAddress): CompanyProfileEntity {
    if (!row.address) throw new Error(`Empresa ${row.id} sem endereço cadastrado`);
    return CompanyProfileEntity.fromPersistence({
        id: row.id,
        name: row.name,
        socialReason: row.socialReason,
        cnpj: row.cnpj,
        openingDate: row.openingDate,
        cnae: row.cnae,
        taxRegime: row.taxRegime,
        email: row.email,
        phone: row.phone,
        logoUrl: row.logoUrl,
        isActive: row.isActive,
        createdAt: row.createdAt,
        address: row.address,
    });
}

/** Colunas da empresa que a entidade controla. */
export function toCompanyData(profile: CompanyProfileEntity) {
    return {
        name: profile.name,
        socialReason: profile.socialReason,
        cnpj: profile.cnpj,
        openingDate: profile.openingDate,
        cnae: profile.cnae,
        taxRegime: profile.taxRegime,
        email: profile.email,
        phone: profile.phone,
        logoUrl: profile.logoUrl,
        isActive: profile.isActive,
    };
}

/** Colunas do endereço da empresa. */
export function toAddressData(profile: CompanyProfileEntity) {
    const { zipCode, street, number, complement, neighborhood, city, state } = profile.address;
    return { zipCode, street, number, complement, neighborhood, city, state };
}
