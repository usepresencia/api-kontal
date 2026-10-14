import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@/config/env.schema.js';
import { initializeFirebase } from '@/infrastructure/auth/firebase.config.js';
import { normalizePrivateKeyPem } from '@/infrastructure/auth/private-key-pem.js';

@Injectable()
export class FirebaseInitService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseInitService.name);

    constructor(private readonly config: ConfigService<Env, true>) {}

    onModuleInit(): void {
        const projectId = this.config.get('FIREBASE_PROJECT_ID', { infer: true });
        const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL', { infer: true });
        const rawPrivateKey = this.config.get('FIREBASE_PRIVATE_KEY', { infer: true });
        if (!projectId || !clientEmail || !rawPrivateKey) {
            this.logger.warn('Firebase credentials not set; auth will fail.');
            return;
        }
        initializeFirebase(
            { projectId, clientEmail, privateKey: normalizePrivateKeyPem(rawPrivateKey) },
            this.logger,
        );
    }
}
