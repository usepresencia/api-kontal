import { Module } from '@nestjs/common';

/**
 * Módulo transversal: autenticação (Firebase) e tenant/membership.
 * Camadas: domain/ (entidades Company, Membership), application/ (services),
 * infrastructure/ (guards, persistência Prisma), presentation/ (controllers, DTOs).
 */
@Module({})
export class SharedModule {}
