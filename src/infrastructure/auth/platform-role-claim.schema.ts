import { z } from 'zod';
import { PlatformRole } from '@/domain/auth/platform-role.js';

export const platformRoleClaimSchema = z.enum(PlatformRole);
