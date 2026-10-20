import { firebaseAuth } from '@/infrastructure/auth/firebase.config.js';
import { withoutUndefined } from '@/utils/without-undefined.js';

interface Identity {
    uid: string;
    email?: string;
    name?: string;
    claims?: Record<string, unknown>;
}

export const identities = {
    admin: {
        uid: 'uid-admin',
        email: 'admin@kontal.test',
        name: 'Admin',
        claims: { platformRole: 'INTERNAL_ADMIN' },
    },
    billing: {
        uid: 'uid-billing',
        email: 'billing@kontal.test',
        claims: { platformRole: 'INTERNAL_BILLING' },
    },
    support: {
        uid: 'uid-support',
        email: 'support@kontal.test',
        claims: { platformRole: 'INTERNAL_SUPPORT' },
    },
    customer: { uid: 'uid-customer', email: 'cliente@presencia.test' },
    member: { uid: 'uid-member', email: 'membro@presencia.test', name: 'Membro' },
    noemail: { uid: 'uid-noemail' },
} satisfies Record<string, Identity>;

export type IdentityKey = keyof typeof identities;

const AUTH_URL = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const FIRESTORE_URL = `http://${process.env.FIRESTORE_EMULATOR_HOST}`;
const PASSWORD = 'senha-123456';
const tokens = new Map<IdentityKey, string>();

/** Apaga contas e documentos dos emulators e esquece os tokens emitidos. */
export async function clearEmulators(): Promise<void> {
    const project = process.env.FIREBASE_PROJECT_ID;
    await Promise.all([
        fetch(`${AUTH_URL}/emulator/v1/projects/${project}/accounts`, { method: 'DELETE' }),
        fetch(`${FIRESTORE_URL}/emulator/v1/projects/${project}/databases/(default)/documents`, {
            method: 'DELETE',
        }),
    ]);
    tokens.clear();
}

/** Cria o usuário no Auth Emulator (com claims) e devolve um ID token válido para ele. */
export async function emulatorToken(key: IdentityKey): Promise<string> {
    const cached = tokens.get(key);
    if (cached) return cached;

    const identity: Identity = identities[key];
    const auth = firebaseAuth();
    await auth.createUser(
        withoutUndefined({
            uid: identity.uid,
            email: identity.email,
            displayName: identity.name,
            password: identity.email ? PASSWORD : undefined,
        }),
    );
    if (identity.claims) await auth.setCustomUserClaims(identity.uid, identity.claims);

    const idToken = identity.email
        ? await signIn('accounts:signInWithPassword', { email: identity.email, password: PASSWORD })
        : await signIn('accounts:signInWithCustomToken', {
              token: await auth.createCustomToken(identity.uid),
          });
    tokens.set(key, idToken);
    return idToken;
}

/**
 * Define as claims do usuário (criando-o se preciso) e devolve um ID token novo, sem cache,
 * porque o token carrega as claims do momento em que foi emitido.
 */
export async function emulatorTokenWithClaims(
    key: IdentityKey,
    claims: Record<string, unknown>,
): Promise<string> {
    const identity: Identity = identities[key];
    const auth = firebaseAuth();
    try {
        await auth.getUser(identity.uid);
    } catch {
        await auth.createUser(
            withoutUndefined({
                uid: identity.uid,
                email: identity.email,
                displayName: identity.name,
                password: PASSWORD,
            }),
        );
    }
    await auth.setCustomUserClaims(identity.uid, claims);
    return signIn('accounts:signInWithPassword', { email: identity.email, password: PASSWORD });
}

async function signIn(endpoint: string, body: object): Promise<string> {
    const res = await fetch(
        `${AUTH_URL}/identitytoolkit.googleapis.com/v1/${endpoint}?key=fake-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, returnSecureToken: true }),
        },
    );
    if (!res.ok) throw new Error(`Auth Emulator ${endpoint} falhou: ${res.status}`);
    return ((await res.json()) as { idToken: string }).idToken;
}
