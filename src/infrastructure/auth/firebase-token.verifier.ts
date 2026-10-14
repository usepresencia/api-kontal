import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { firebaseAuth } from '@/infrastructure/auth/firebase.config.js';

@Injectable()
export class FirebaseTokenVerifier {
    private readonly logger = new Logger(FirebaseTokenVerifier.name);

    /**
     * Verifica o ID token no Firebase.
     * @throws UnauthorizedException se o Firebase rejeitar o token (`auth/*`)
     */
    async verify(token: string): Promise<DecodedIdToken> {
        try {
            return await firebaseAuth().verifyIdToken(token);
        } catch (error) {
            if (!isFirebaseAuthError(error)) throw error;
            this.logger.warn(`[Firebase] Token inválido: ${error.message}`);
            throw new UnauthorizedException('Token Firebase inválido');
        }
    }
}

function isFirebaseAuthError(error: unknown): error is Error & { code: string } {
    return (
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        error.code.startsWith('auth/')
    );
}
