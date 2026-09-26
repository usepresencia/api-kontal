import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './infrastructure/persistence/prisma.service.js';

/**
 * Módulo transversal: autenticação (Firebase) e tenant/membership.
 * Camadas: domain/ (entidades Company, Membership), application/ (services),
 * infrastructure/ (guards, persistência Prisma), presentation/ (controllers, DTOs).
 */
@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [PrismaService],
    exports: [PrismaService],
})
export class SharedModule {}
