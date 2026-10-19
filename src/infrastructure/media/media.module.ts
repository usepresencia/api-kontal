import { Module } from '@nestjs/common';
import { CloudinaryLogoStorage } from '@/infrastructure/media/cloudinary-logo.storage.js';
import { LOGO_STORAGE } from '@/infrastructure/media/media.tokens.js';

@Module({
    providers: [{ provide: LOGO_STORAGE, useClass: CloudinaryLogoStorage }],
    exports: [LOGO_STORAGE],
})
export class MediaModule {}
