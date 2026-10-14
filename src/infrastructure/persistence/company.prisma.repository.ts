import { Injectable } from '@nestjs/common';
import { CompanyEntity } from '@/domain/entities/company.entity.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

@Injectable()
export class CompanyPrismaRepository implements ICompanyRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findById(id: string): Promise<CompanyEntity | null> {
        const row = await this.prisma.company.findUnique({ where: { id } });
        return row ? CompanyEntity.fromPersistence(row) : null;
    }

    async findAllActive(): Promise<CompanyEntity[]> {
        const rows = await this.prisma.company.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        });
        return rows.map(row => CompanyEntity.fromPersistence(row));
    }
}
