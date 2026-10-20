import type { KontalMembershipEntry } from '@/domain/auth/kontal-memberships-claim.js';

/** Conta do Firebase Auth com as empresas do Kontal que ela acessa (claim `kontalMemberships`). */
export interface FirebaseAccount {
    uid: string;
    memberships: KontalMembershipEntry[];
}

export interface IFirebaseAccounts {
    findByEmail(email: string): Promise<FirebaseAccount | null>;
    create(input: { email: string; name?: string }): Promise<FirebaseAccount>;
    /** Grava a claim `kontalMemberships`, preservando as demais claims da conta. */
    setMemberships(uid: string, memberships: KontalMembershipEntry[]): Promise<void>;
}
