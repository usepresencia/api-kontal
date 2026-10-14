import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import type { Env } from '@/config/env.schema.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(config: ConfigService<Env, true>) {
        const pool = new Pool({
            connectionString: config.get('DATABASE_URL', { infer: true }),
            max: config.get('PG_POOL_MAX', { infer: true }),
        });
        super({ adapter: new PrismaPg(pool) });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
