import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import type { SessionUser } from '@/domain/auth/session-user.js';
import { extractBearerToken } from '@/infrastructure/auth/bearer-token.js';
import { MembershipReconciler } from '@/infrastructure/auth/membership.reconciler.js';
import { FirebaseTokenVerifier } from '@/infrastructure/auth/firebase-token.verifier.js';
import { PlatformRoleResolver } from '@/infrastructure/auth/platform-role.resolver.js';
import { SessionUserAssembler } from '@/infrastructure/auth/session-user.assembler.js';
import { UserProvisioner } from '@/infrastructure/auth/user-provisioner.js';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(Strategy, 'firebase') {
    constructor(
        private readonly verifier: FirebaseTokenVerifier,
        private readonly provisioner: UserProvisioner,
        private readonly platformRoles: PlatformRoleResolver,
        private readonly assembler: SessionUserAssembler,
        private readonly reconciler: MembershipReconciler,
    ) {
        super();
    }

    /** Autentica a requisição e devolve o `SessionUser` que vira `request.user`. */
    async validate(req: { headers: { authorization?: string } }): Promise<SessionUser> {
        const token = extractBearerToken(req.headers.authorization);
        const decoded = await this.verifier.verify(token);
        const user = await this.provisioner.provision(decoded);
        const platformRole = await this.platformRoles.resolve(user.id, decoded['platformRole']);
        await this.reconciler.reconcile(user.id, decoded['kontalMemberships']);
        return this.assembler.assemble(user, platformRole);
    }
}
