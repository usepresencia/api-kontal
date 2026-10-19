import { Global, Module } from '@nestjs/common';
import { SystemClock } from '@/infrastructure/time/system-clock.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

@Global()
@Module({
    providers: [{ provide: CLOCK, useClass: SystemClock }],
    exports: [CLOCK],
})
export class TimeModule {}
