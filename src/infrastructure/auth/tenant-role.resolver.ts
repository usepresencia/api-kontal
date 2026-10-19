import { Inject, Injectable } from '@nestjs/common';
import { effectiveRoleForPlatform } from '@/domain/auth/effective-role.js';
import type { MembershipRole } from '@/domain/auth/membership-role.js';
import type { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ICompanyRepository } from '@/domain/repositories/company.repository.interface.js';
import type { IMembershipRepository } from '@/domain/repositories/membership.repository.interface.js';
import {
    COMPANY_REPOSITORY,
    MEMBERSHIP_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

@Injectable()
export class TenantRoleResolver {
    constructor(
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: IMembershipRepository,
        @Inject(COMPANY_REPOSITORY) private readonly companies: ICompanyRepository,
    ) {}

    /** Papel do usuário na empresa: mapeado da plataforma ou vindo da membership ativa. */
    resolve(user: SessionUser, companyId: string): Promise<MembershipRole> {
        return user.isPlatformUser
            ? this.fromPlatformRole(user.platformRole, companyId)
            : this.fromMembership(user.userId, companyId);
    }

    private async fromPlatformRole(role: PlatformRole, companyId: string): Promise<MembershipRole> {
        const membershipRole = effectiveRoleForPlatform(role);
        if (!(await this.companies.findById(companyId))) {
            throw new CodedHttpException(
                404,
                ErrorCode.COMPANY_NOT_FOUND,
                'Empresa não encontrada',
            );
        }
        return membershipRole;
    }

    private async fromMembership(userId: string, companyId: string): Promise<MembershipRole> {
        const membership = await this.memberships.findByUserAndCompany(userId, companyId);
        if (!membership?.isActive) {
            throw new CodedHttpException(403, ErrorCode.FORBIDDEN, 'Acesso negado a esta empresa');
        }
        return membership.role;
    }
}
