import { Module } from '@nestjs/common';
import { HealthController } from '@/presentation/health/health.controller.js';

@Module({ controllers: [HealthController] })
export class HealthModule {}
