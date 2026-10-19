import { Injectable } from '@nestjs/common';
import type { UserRecord } from 'firebase-admin/auth';
import type { FirebaseAccount, IFirebaseAccounts } from '@/domain/auth/firebase-accounts.port.js';
import type { KontalMembershipEntry } from '@/domain/auth/kontal-memberships-claim.js';
import { firebaseAuth } from '@/infrastructure/auth/firebase.config.js';
import { parseKontalMembershipsClaim } from '@/infrastructure/auth/kontal-memberships-claim.schema.js';

const CLAIM = 'kontalMemberships';

function toAccount(record: UserRecord): FirebaseAccount {
    return {
        uid: record.uid,
        memberships: parseKontalMembershipsClaim(record.customClaims?.[CLAIM]),
    };
}

@Injectable()
export class FirebaseAccountsAdapter implements IFirebaseAccounts {
    async findByEmail(email: string): Promise<FirebaseAccount | null> {
        try {
            return toAccount(await firebaseAuth().getUserByEmail(email));
        } catch (error) {
            if ((error as { code?: string }).code === 'auth/user-not-found') return null;
            throw error;
        }
    }

    async create(input: { email: string; name?: string }): Promise<FirebaseAccount> {
        const record = await firebaseAuth().createUser({
            email: input.email,
            ...(input.name ? { displayName: input.name } : {}),
        });
        return toAccount(record);
    }

    async setMemberships(uid: string, memberships: KontalMembershipEntry[]): Promise<void> {
        const auth = firebaseAuth();
        const { customClaims } = await auth.getUser(uid);
        await auth.setCustomUserClaims(uid, { ...customClaims, [CLAIM]: memberships });
    }
}
