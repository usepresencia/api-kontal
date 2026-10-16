import { Global, Module } from '@nestjs/common';
import { PeriodClosingReadPrismaRepository } from '@/infrastructure/persistence/period-closing-read.prisma.repository.js';
import { CashFlowPrismaRepository } from '@/infrastructure/persistence/cash-flow.prisma.repository.js';
import { AccountLedgerPrismaRepository } from '@/infrastructure/persistence/account-ledger.prisma.repository.js';
import { DailyJournalPrismaRepository } from '@/infrastructure/persistence/daily-journal.prisma.repository.js';
import { JournalReadPrismaRepository } from '@/infrastructure/persistence/journal-read.prisma.repository.js';
import { LedgerTotalsPrismaRepository } from '@/infrastructure/persistence/ledger-totals.prisma.repository.js';
import { ReportAccountPrismaRepository } from '@/infrastructure/persistence/report-account.prisma.repository.js';
import { BillingAccountPrismaRepository } from '@/infrastructure/persistence/billing-account.prisma.repository.js';
import { BillingPlanPrismaRepository } from '@/infrastructure/persistence/billing-plan.prisma.repository.js';
import { CompanyProfilePrismaRepository } from '@/infrastructure/persistence/company-profile.prisma.repository.js';
import { CompanyPrismaRepository } from '@/infrastructure/persistence/company.prisma.repository.js';
import { EntryReadPrismaRepository } from '@/infrastructure/persistence/entry-read.prisma.repository.js';
import { LedgerPrismaUnitOfWork } from '@/infrastructure/persistence/ledger/ledger.prisma.unit-of-work.js';
import { MembershipPrismaRepository } from '@/infrastructure/persistence/membership.prisma.repository.js';
import {
    BILLING_ACCOUNT_REPOSITORY,
    BILLING_PLAN_REPOSITORY,
    COMPANY_PROFILE_REPOSITORY,
    COMPANY_REPOSITORY,
    ENTRY_READ_REPOSITORY,
    LEDGER_UNIT_OF_WORK,
    MEMBERSHIP_REPOSITORY,
    PLATFORM_ACCESS_REPOSITORY,
    PARTY_REPOSITORY,
    PRESET_REPOSITORY,
    SERIES_READ_REPOSITORY,
    TITLE_READ_REPOSITORY,
    USER_REPOSITORY,
    REPORT_ACCOUNT_REPOSITORY,
    LEDGER_TOTALS_REPOSITORY,
    JOURNAL_READ_REPOSITORY,
    DAILY_JOURNAL_REPOSITORY,
    ACCOUNT_LEDGER_REPOSITORY,
    CASH_FLOW_REPOSITORY,
    PERIOD_CLOSING_READ_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { PartyPrismaRepository } from '@/infrastructure/persistence/party.prisma.repository.js';
import { PresetPrismaRepository } from '@/infrastructure/persistence/preset.prisma.repository.js';
import { SeriesReadPrismaRepository } from '@/infrastructure/persistence/series-read.prisma.repository.js';
import { TitleReadPrismaRepository } from '@/infrastructure/persistence/title-read.prisma.repository.js';
import { PlatformAccessPrismaRepository } from '@/infrastructure/persistence/platform-access.prisma.repository.js';
import { UserPrismaRepository } from '@/infrastructure/persistence/user.prisma.repository.js';

@Global()
@Module({
    providers: [
        { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
        { provide: COMPANY_REPOSITORY, useClass: CompanyPrismaRepository },
        { provide: COMPANY_PROFILE_REPOSITORY, useClass: CompanyProfilePrismaRepository },
        { provide: BILLING_PLAN_REPOSITORY, useClass: BillingPlanPrismaRepository },
        { provide: BILLING_ACCOUNT_REPOSITORY, useClass: BillingAccountPrismaRepository },
        { provide: PRESET_REPOSITORY, useClass: PresetPrismaRepository },
        { provide: PARTY_REPOSITORY, useClass: PartyPrismaRepository },
        { provide: LEDGER_UNIT_OF_WORK, useClass: LedgerPrismaUnitOfWork },
        { provide: TITLE_READ_REPOSITORY, useClass: TitleReadPrismaRepository },
        { provide: ENTRY_READ_REPOSITORY, useClass: EntryReadPrismaRepository },
        { provide: SERIES_READ_REPOSITORY, useClass: SeriesReadPrismaRepository },
        { provide: MEMBERSHIP_REPOSITORY, useClass: MembershipPrismaRepository },
        { provide: PLATFORM_ACCESS_REPOSITORY, useClass: PlatformAccessPrismaRepository },
        { provide: REPORT_ACCOUNT_REPOSITORY, useClass: ReportAccountPrismaRepository },
        { provide: LEDGER_TOTALS_REPOSITORY, useClass: LedgerTotalsPrismaRepository },
        { provide: JOURNAL_READ_REPOSITORY, useClass: JournalReadPrismaRepository },
        { provide: DAILY_JOURNAL_REPOSITORY, useClass: DailyJournalPrismaRepository },
        { provide: ACCOUNT_LEDGER_REPOSITORY, useClass: AccountLedgerPrismaRepository },
        { provide: CASH_FLOW_REPOSITORY, useClass: CashFlowPrismaRepository },
        { provide: PERIOD_CLOSING_READ_REPOSITORY, useClass: PeriodClosingReadPrismaRepository },
    ],
    exports: [
        USER_REPOSITORY,
        COMPANY_REPOSITORY,
        COMPANY_PROFILE_REPOSITORY,
        BILLING_PLAN_REPOSITORY,
        BILLING_ACCOUNT_REPOSITORY,
        PRESET_REPOSITORY,
        PARTY_REPOSITORY,
        LEDGER_UNIT_OF_WORK,
        TITLE_READ_REPOSITORY,
        ENTRY_READ_REPOSITORY,
        SERIES_READ_REPOSITORY,
        MEMBERSHIP_REPOSITORY,
        PLATFORM_ACCESS_REPOSITORY,
        REPORT_ACCOUNT_REPOSITORY,
        LEDGER_TOTALS_REPOSITORY,
        JOURNAL_READ_REPOSITORY,
        DAILY_JOURNAL_REPOSITORY,
        ACCOUNT_LEDGER_REPOSITORY,
        CASH_FLOW_REPOSITORY,
        PERIOD_CLOSING_READ_REPOSITORY,
    ],
})
export class PersistenceModule {}
