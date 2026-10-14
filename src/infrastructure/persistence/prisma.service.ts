import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import type { Env } from '@/config/env.schema.js';

/** Faz o Prisma emitir um evento por query SQL (usado pelos testes para contá-las). */
const QUERY_EVENTS: { log: Prisma.LogDefinition[] } = {
    log: [{ emit: 'event', level: 'query' }],
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(config: ConfigService<Env, true>) {
        const pool = new Pool({
            connectionString: config.get('DATABASE_URL', { infer: true }),
            max: config.get('PG_POOL_MAX', { infer: true }),
        });
        const isTest = config.get('NODE_ENV', { infer: true }) === 'test';
        super({ adapter: new PrismaPg(pool), ...(isTest ? QUERY_EVENTS : {}) });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
