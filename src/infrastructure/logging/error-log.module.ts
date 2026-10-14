import { Global, Module } from '@nestjs/common';
import { ErrorLogWriter } from '@/infrastructure/logging/error-log.writer.js';

@Global()
@Module({
    providers: [ErrorLogWriter],
    exports: [ErrorLogWriter],
})
export class ErrorLogModule {}
