import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';

/** Resposta da API para uma empresa (camelCase, datas em ISO). */
export function toCompanyResponse(company: CompanyProfileEntity) {
    return {
        id: company.id,
        name: company.name,
        socialReason: company.socialReason,
        cnpj: company.cnpj,
        openingDate: company.openingDate.toISOString().slice(0, 10),
        cnae: company.cnae,
        taxRegime: company.taxRegime,
        email: company.email,
        phone: company.phone,
        logoUrl: company.logoUrl,
        isActive: company.isActive,
        address: {
            zipCode: company.address.zipCode,
            street: company.address.street,
            number: company.address.number,
            complement: company.address.complement,
            neighborhood: company.address.neighborhood,
            city: company.address.city,
            state: company.address.state,
        },
        createdAt: company.createdAt.toISOString(),
    };
}
