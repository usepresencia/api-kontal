import type { Logger } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

export interface FirebaseCredential {
    projectId: string;
    clientEmail: string;
    privateKey: string;
}

/** Inicializa o Firebase Admin uma única vez. */
export function initializeFirebase(credential: FirebaseCredential, logger?: Logger): void {
    if (getApps().length > 0) return;
    logger?.log(`[Firebase] Initializing with project: ${credential.projectId}`);
    initializeApp({ credential: cert(credential) });
    logger?.log('[Firebase] Initialized successfully');
}

export function firebaseAuth(): Auth {
    return getAuth();
}

export function firebaseFirestore(): Firestore {
    return getFirestore();
}
