import { describe, it, expect } from 'vitest';
import { castleAvatarProfileSchema, castleProfileSaveSchema, defaultCastleProfile, castleAppearance } from './castleAvatar';
import { castleAvatarSchema, castleAvatarV2Schema, castleCompatibleRosterSchema } from './castlePresence';
describe('account castle appearance contract', () => {
    it('defaults to a public name without leaking contact text or changing membership gender', () => {
        expect(defaultCastleProfile(' person@example.test ').alias).toBe('同行者');
        expect(defaultCastleProfile('a'.repeat(30) + '@example.test').alias).toBe('同行者');
        expect(defaultCastleProfile('小雨').alias).toBe('小雨');
        expect(defaultCastleProfile('\u0000  ').alias).toBe('同行者');
        expect(defaultCastleProfile('😀'.repeat(30)).alias.length).toBeLessThanOrEqual(24);
        expect(defaultCastleProfile().genderPresentation).toBe('neutral');
    });
    it('strictly validates owner-only flat profile and all supported independent combinations', () => {
        for (const genderPresentation of ['male', 'female', 'neutral'])
            for (const outfit of ['casual', 'jacket', 'skirt'])
                expect(castleAvatarProfileSchema.safeParse({ ...defaultCastleProfile(), genderPresentation, outfit }).success).toBe(true);
        for (const extra of [{ userId: 'other' }, { email: 'secret' }, { userGender: 'male' }, { appearance: {} }])
            expect(castleAvatarProfileSchema.safeParse({ ...defaultCastleProfile(), ...extra }).success).toBe(false);
        expect(castleProfileSaveSchema.safeParse({ expectedRevision: 0, profile: defaultCastleProfile() }).success).toBe(true);
        expect(castleProfileSaveSchema.safeParse({ expectedRevision: -1, profile: defaultCastleProfile() }).success).toBe(false);
    });
    it('keeps the old strict five-field avatar and upgrades it only in the new client adapter', () => {
        const old = { avatarId: '11111111-1111-4111-8111-111111111111', alias: '同行者', preset: 'jade', isSelf: true, motion: { sequence: 0, path: [[0, 15]], startedAt: 1, durationMs: 0 } };
        expect(Object.keys(castleAvatarSchema.parse(old))).toHaveLength(5);
        expect(castleAvatarSchema.safeParse({ ...old, appearance: castleAppearance(defaultCastleProfile()) }).success).toBe(false);
        expect(castleAvatarV2Schema.parse({ ...old, appearance: castleAppearance(defaultCastleProfile()) }).appearance.outfit).toBe('casual');
        const upgraded = castleCompatibleRosterSchema.parse({ instanceEpoch: old.avatarId, serverNow: 1, ttlMs: 25000, avatars: [old] });
        expect(upgraded.avatars[0].appearance.outfitColor).toBe('jade');
    });
});
