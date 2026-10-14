import { Injectable } from '@nestjs/common';
import { UserEntity } from '@/domain/entities/user.entity.js';
import type { IUserRepository } from '@/domain/repositories/user.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { isUniqueConstraintError } from '@/utils/prisma.utils.js';

@Injectable()
export class UserPrismaRepository implements IUserRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findOrCreate(candidate: UserEntity): Promise<UserEntity> {
        const existing = await this.findByFirebaseUid(candidate.firebaseUid);
        if (existing) return existing;
        try {
            const row = await this.prisma.user.create({
                data: {
                    id: candidate.id,
                    firebaseUid: candidate.firebaseUid,
                    email: candidate.email,
                    name: candidate.name,
                    avatarUrl: candidate.avatarUrl,
                    phone: candidate.phone,
                    createdAt: candidate.createdAt,
                },
            });
            return UserEntity.fromPersistence(row);
        } catch (err) {
            if (!isUniqueConstraintError(err)) throw err;
            const raced = await this.findByFirebaseUid(candidate.firebaseUid);
            if (!raced) throw err;
            return raced;
        }
    }

    private async findByFirebaseUid(firebaseUid: string): Promise<UserEntity | null> {
        const row = await this.prisma.user.findUnique({ where: { firebaseUid } });
        return row ? UserEntity.fromPersistence(row) : null;
    }
}
