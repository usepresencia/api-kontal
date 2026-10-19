import { Controller, Get } from '@nestjs/common';
import { Public } from '@/infrastructure/auth/public.decorator.js';

@Controller('health')
export class HealthController {
    @Public()
    @Get()
    check() {
        return { status: 'ok' };
    }
}
