import { Injectable } from '@nestjs/common';
import { PlatformAccessEntity } from '@/domain/entities/platform-access.entity.js';
import type { IPlatformAccessRepository } from '@/domain/repositories/platform-access.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { isUniqueConstraintError } from '@/utils/prisma.utils.js';

@Injectable()
export class PlatformAccessPrismaRepository implements IPlatformAccessRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByUserId(userId: string): Promise<PlatformAccessEntity | null> {
        const row = await this.prisma.platformAccess.findUnique({ where: { userId } });
        return row ? PlatformAccessEntity.fromPersistence(row) : null;
    }

    async createIfAbsent(access: PlatformAccessEntity): Promise<boolean> {
        try {
            await this.prisma.platformAccess.create({
                data: { userId: access.userId, role: access.role },
            });
            return true;
        } catch (err) {
            if (!isUniqueConstraintError(err)) throw err;
            return false;
        }
    }
}
