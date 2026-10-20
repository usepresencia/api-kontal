import { z } from 'zod';
import { MembershipRole } from '@/domain/auth/membership-role.js';

const eventId = z.string().trim().min(1).max(128);
const email = z.string().trim().max(254).pipe(z.email());

export const grantAccessSchema = z.object({
    eventId,
    email,
    name: z.string().trim().min(1).max(255).optional(),
    companyId: z.uuid(),
    role: z.enum(MembershipRole),
});

export type GrantAccessBody = z.infer<typeof grantAccessSchema>;

export const revokeAccessSchema = z.object({
    eventId,
    email,
    companyId: z.uuid(),
});

export type RevokeAccessBody = z.infer<typeof revokeAccessSchema>;
