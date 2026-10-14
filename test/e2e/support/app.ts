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
} from '@test/e2e/support/firebase-emulator.js';
import { ProbeController } from '@test/e2e/support/probe.controller.js';

async function resetDatabase(prisma: PrismaService): Promise<void> {
    await prisma.membership.deleteMany();
    await prisma.platformAccess.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
}

/** Registra os hooks do e2e (app, emulators e banco limpos) e devolve `api()` e `db()`. */
export function useTestApp() {
    let app: NestExpressApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
            controllers: [ProbeController],
        }).compile();
        app = moduleRef.createNestApplication<NestExpressApplication>();
        configureApp(app);
        await app.init();
        prisma = app.get(PrismaService);
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
    };
}

/** Header `Authorization` com um ID token emitido pelo Auth Emulator para a identidade. */
export async function bearer(key: IdentityKey): Promise<{ Authorization: string }> {
    return { Authorization: `Bearer ${await emulatorToken(key)}` };
}
