import type { ReportAccount } from '@/domain/reports/report-account.js';

export interface IReportAccountRepository {
    /** Todas as contas do plano da empresa, em ordem natural de código. */
    list(companyId: string, planId: string): Promise<ReportAccount[]>;
}
