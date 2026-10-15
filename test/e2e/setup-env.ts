import { generateKeyPairSync } from 'node:crypto';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Rode os testes e2e com `npm run test:e2e` (sobe os Firebase Emulators).');
}

// O Admin SDK exige uma chave PEM válida mesmo contra o emulator.
const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
});

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://kontal:kontal@localhost:5432/kontal?schema=public';
process.env.FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-kontal';
process.env.FIREBASE_CLIENT_EMAIL = 'test@demo-kontal.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = privateKey;
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
process.env.CLOUDINARY_API_KEY = '123456789012345';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
