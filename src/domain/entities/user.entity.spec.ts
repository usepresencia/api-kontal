import { UserEntity } from '@/domain/entities/user.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const base = { id: 'u1', firebaseUid: 'fb1', email: ' Ana@Kontal.COM ', name: ' Ana ' };

describe('UserEntity', () => {
    it('normaliza e-mail (minúsculo, sem espaços) e nome', () => {
        const user = UserEntity.create(base);
        expect(user.email).toBe('ana@kontal.com');
        expect(user.name).toBe('Ana');
        expect(user.avatarUrl).toBeNull();
        expect(user.phone).toBeNull();
    });

    it.each([
        ['e-mail vazio', { ...base, email: '  ' }],
        ['nome vazio', { ...base, name: '' }],
        ['firebaseUid vazio', { ...base, firebaseUid: '' }],
    ])('rejeita %s com DomainError VALIDATION_ERROR', (_label, input) => {
        expect(() => UserEntity.create(input)).toThrow(DomainError);
        expect(() => UserEntity.create(input)).toThrow(
            expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        );
    });

    it('fromPersistence reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const user = UserEntity.fromPersistence({
            id: 'u1',
            firebaseUid: 'fb1',
            email: 'a@b.com',
            name: 'A',
            avatarUrl: 'http://x/y.png',
            phone: '+5511',
            createdAt,
        });
        expect(user.avatarUrl).toBe('http://x/y.png');
        expect(user.createdAt).toBe(createdAt);
    });
});
