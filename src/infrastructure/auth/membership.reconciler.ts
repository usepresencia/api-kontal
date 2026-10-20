import { Inject, Injectable } from '@nestjs/common';
import type { IMembershipRepository } from '@/domain/repositories/membership.repository.interface.js';
import { parseKontalMembershipsClaim } from '@/infrastructure/auth/kontal-memberships-claim.schema.js';
import { MEMBERSHIP_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class MembershipReconciler {
    constructor(
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: IMembershipRepository,
    ) {}

    /** Alinha as memberships do usuário à claim `kontalMemberships` do Firebase (a fonte da verdade). */
    reconcile(userId: string, claim: unknown): Promise<void> {
        return this.memberships.reconcile(userId, parseKontalMembershipsClaim(claim));
    }
}
