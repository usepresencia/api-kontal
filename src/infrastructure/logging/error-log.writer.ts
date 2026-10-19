import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import { firebaseFirestore } from '@/infrastructure/auth/firebase.config.js';
import { buildErrorLogEntry } from '@/infrastructure/logging/error-log-entry.js';
import type { ApiErrorLogInput, ErrorLogSink } from '@/infrastructure/logging/error-log.types.js';
import { COMPANY_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ErrorLogWriter implements ErrorLogSink {
    private readonly logger = new Logger(ErrorLogWriter.name);

    constructor(@Inject(COMPANY_REPOSITORY) private readonly companies: ICompanyRepository) {}

    /** Grava o erro no Firestore; nunca lança. */
    async write(input: ApiErrorLogInput): Promise<void> {
        try {
            const companyName = await this.findCompanyName(input.companyId);
            await firebaseFirestore()
                .collection('logs')
                .doc(input.correlationId)
                .collection('entries')
                .add(buildErrorLogEntry(input, companyName, new Date()));
        } catch (err) {
            this.logger.warn(`Falha ao gravar log de erro ${input.correlationId}: ${String(err)}`);
        }
    }

    private async findCompanyName(companyId: string | undefined): Promise<string | undefined> {
        if (!companyId) return undefined;
        try {
            return (await this.companies.findById(companyId))?.name;
        } catch {
            return undefined;
        }
    }
}
