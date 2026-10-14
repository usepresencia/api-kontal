import { Injectable } from '@nestjs/common';
import type { CompanyProfileEntity } from '@/domain/entities/company-profile.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type { ICompanyProfileRepository } from '@/domain/repositories/company-profile.repository.interface.js';
import {
    toAddressData,
    toCompanyData,
    toCompanyProfile,
} from '@/infrastructure/persistence/company-profile.prisma.mapper.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { isUniqueConstraintError } from '@/utils/prisma.utils.js';

/** Converte a violação de unicidade em CNPJ duplicado; repassa qualquer outro erro. */
function rethrowAsCnpjConflict(err: unknown): never {
    if (isUniqueConstraintError(err)) {
        throw new DomainError(ErrorCode.CNPJ_ALREADY_REGISTERED, 'CNPJ já cadastrado');
    }
    throw err;
}

@Injectable()
export class CompanyProfilePrismaRepository implements ICompanyProfileRepository {
    constructor(private readonly prisma: PrismaService) {}

    async create(profile: CompanyProfileEntity): Promise<void> {
        try {
            await this.prisma.company.create({
                data: {
                    id: profile.id,
                    createdAt: profile.createdAt,
                    ...toCompanyData(profile),
                    address: { create: toAddressData(profile) },
                },
            });
        } catch (err) {
            rethrowAsCnpjConflict(err);
        }
    }

    async findById(id: string): Promise<CompanyProfileEntity | null> {
        const row = await this.prisma.company.findUnique({
            where: { id },
            include: { address: true },
            relationLoadStrategy: 'join',
        });
        return row ? toCompanyProfile(row) : null;
    }

    async update(profile: CompanyProfileEntity): Promise<void> {
        try {
            await this.prisma.company.update({
                where: { id: profile.id },
                data: { ...toCompanyData(profile), address: { update: toAddressData(profile) } },
            });
        } catch (err) {
            rethrowAsCnpjConflict(err);
        }
    }

    async list(page: PageRequest): Promise<Page<CompanyProfileEntity>> {
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.company.findMany({
                orderBy: { name: 'asc' },
                skip: pageOffset(page),
                take: page.pageSize,
                include: { address: true },
                relationLoadStrategy: 'join',
            }),
            this.prisma.company.count(),
        ]);
        return {
            items: rows.map(toCompanyProfile),
            page: page.page,
            pageSize: page.pageSize,
            total,
        };
    }
}
