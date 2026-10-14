import {
    type AddressInput,
    CompanyAddress,
    type CompanyAddressRow,
} from '@/domain/companies/company-address.js';
import { isValidCnpj, normalizeCnpj } from '@/domain/companies/cnpj.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { requiredText } from '@/domain/required-text.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CompanyData {
    name: string;
    socialReason: string;
    cnpj: string;
    openingDate: Date;
    cnae: string;
    taxRegime: string;
    email: string;
    phone: string;
    address: AddressInput;
}

export interface CompanyProfileRow {
    id: string;
    name: string;
    socialReason: string;
    cnpj: string;
    openingDate: Date;
    cnae: string;
    taxRegime: string;
    email: string;
    phone: string;
    logoUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    address: CompanyAddressRow;
}

interface NormalizedData {
    name: string;
    socialReason: string;
    cnpj: string;
    openingDate: Date;
    cnae: string;
    taxRegime: string;
    email: string;
    phone: string;
    address: CompanyAddress;
}

function normalize(data: CompanyData): NormalizedData {
    if (!isValidCnpj(data.cnpj)) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'CNPJ inválido');
    }
    const email = data.email?.trim().toLowerCase();
    if (!email || !EMAIL.test(email)) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'E-mail inválido');
    }
    return {
        name: requiredText(data.name, 'Nome fantasia'),
        socialReason: requiredText(data.socialReason, 'Razão social'),
        cnpj: normalizeCnpj(data.cnpj),
        openingDate: data.openingDate,
        cnae: requiredText(data.cnae, 'CNAE'),
        taxRegime: requiredText(data.taxRegime, 'Regime tributário'),
        email,
        phone: requiredText(data.phone, 'Telefone', 20),
        address: CompanyAddress.create(data.address),
    };
}

/** Cadastro completo da empresa (tenant) com endereço e logo. */
export class CompanyProfileEntity {
    private constructor(
        readonly id: string,
        readonly name: string,
        readonly socialReason: string,
        readonly cnpj: string,
        readonly openingDate: Date,
        readonly cnae: string,
        readonly taxRegime: string,
        readonly email: string,
        readonly phone: string,
        readonly logoUrl: string | null,
        readonly isActive: boolean,
        readonly address: CompanyAddress,
        readonly createdAt: Date,
    ) {}

    static create(params: { id: string; createdAt?: Date } & CompanyData): CompanyProfileEntity {
        const data = normalize(params);
        return new CompanyProfileEntity(
            params.id,
            data.name,
            data.socialReason,
            data.cnpj,
            data.openingDate,
            data.cnae,
            data.taxRegime,
            data.email,
            data.phone,
            null,
            true,
            data.address,
            params.createdAt ?? new Date(),
        );
    }

    /** Substitui os dados cadastrais, revalidando-os; mantém id, logo, status e criação. */
    withChanges(changes: CompanyData): CompanyProfileEntity {
        const data = normalize(changes);
        return new CompanyProfileEntity(
            this.id,
            data.name,
            data.socialReason,
            data.cnpj,
            data.openingDate,
            data.cnae,
            data.taxRegime,
            data.email,
            data.phone,
            this.logoUrl,
            this.isActive,
            data.address,
            this.createdAt,
        );
    }

    withLogo(logoUrl: string | null): CompanyProfileEntity {
        return this.copy({ logoUrl });
    }

    deactivate(): CompanyProfileEntity {
        return this.copy({ isActive: false });
    }

    static fromPersistence(row: CompanyProfileRow): CompanyProfileEntity {
        return new CompanyProfileEntity(
            row.id,
            row.name,
            row.socialReason,
            row.cnpj,
            row.openingDate,
            row.cnae,
            row.taxRegime,
            row.email,
            row.phone,
            row.logoUrl,
            row.isActive,
            CompanyAddress.fromPersistence(row.address),
            row.createdAt,
        );
    }

    private copy(changes: { logoUrl?: string | null; isActive?: boolean }): CompanyProfileEntity {
        return new CompanyProfileEntity(
            this.id,
            this.name,
            this.socialReason,
            this.cnpj,
            this.openingDate,
            this.cnae,
            this.taxRegime,
            this.email,
            this.phone,
            changes.logoUrl === undefined ? this.logoUrl : changes.logoUrl,
            changes.isActive ?? this.isActive,
            this.address,
            this.createdAt,
        );
    }
}
