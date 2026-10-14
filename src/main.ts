import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '@/app.module.js';
import { configureApp } from '@/app.setup.js';
import type { Env } from '@/config/env.schema.js';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    configureApp(app);
    const port = app.get<ConfigService<Env, true>>(ConfigService).get('PORT', { infer: true });
    await app.listen(port);
}

bootstrap().catch(error => {
    console.error('Failed to bootstrap Nest application', error);
    process.exit(1);
});
