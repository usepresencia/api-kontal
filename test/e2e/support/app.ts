import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module.js';
import { configureApp } from '@/app.setup.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import {
    type IdentityKey,
    clearEmulators,
    emulatorToken,
    emulatorTokenWithClaims,
} from '@test/e2e/support/firebase-emulator.js';
import { QueryCounter } from '@test/e2e/support/query-counter.js';
import { ProbeController } from '@test/e2e/support/probe.controller.js';

async function resetDatabase(prisma: PrismaService): Promise<void> {
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE "JournalLine", "JournalEntry", "Entry", "Title", "TitleSeries", "PresetAccount", "Party", "Preset", "BillingAccount", "BillingPlan", "PeriodClosing", "CompanyAddress", "Membership", "PlatformAccess", "Provisioning", "User", "Company" RESTART IDENTITY CASCADE',
    );
}

/** Registra os hooks do e2e (app, emulators e banco limpos) e devolve `api()` e `db()`. */
export function useTestApp() {
    let app: NestExpressApplication;
    let prisma: PrismaService;
    let counter: QueryCounter;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
            controllers: [ProbeController],
        }).compile();
        app = moduleRef.createNestApplication<NestExpressApplication>();
        configureApp(app);
        await app.init();
        prisma = app.get(PrismaService);
        counter = new QueryCounter(prisma);
    });

    afterAll(async () => {
        await app.close();
    });

    beforeEach(async () => {
        await clearEmulators();
        await resetDatabase(prisma);
    });

    return {
        api: () => request(app.getHttpServer()),
        db: () => prisma,
        queries: () => counter,
        resolve: <T>(token: symbol | (abstract new (...args: never[]) => T)) =>
            app.get<T>(token as never),
    };
}

/** Header `Authorization` com um ID token emitido pelo Auth Emulator para a identidade. */
export async function bearer(key: IdentityKey): Promise<{ Authorization: string }> {
    return { Authorization: `Bearer ${await emulatorToken(key)}` };
}

/** Header `Authorization` com um ID token novo, emitido com as claims informadas. */
export async function bearerWithClaims(
    key: IdentityKey,
    claims: Record<string, unknown>,
): Promise<{ Authorization: string }> {
    return { Authorization: `Bearer ${await emulatorTokenWithClaims(key, claims)}` };
}
