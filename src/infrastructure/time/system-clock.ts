import { Injectable } from '@nestjs/common';
import type { IClock } from '@/domain/clock.js';

const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

@Injectable()
export class SystemClock implements IClock {
    today(): Date {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE }).format(
            new Date(),
        );
        return new Date(`${day}T00:00:00.000Z`);
    }
}
