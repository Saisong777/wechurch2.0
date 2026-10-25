import { z } from 'zod';
export const castlePresetSchema = z.enum(['coral', 'sunshine', 'jade', 'blue', 'ivory', 'violet']);
export const castleAliasSchema = z.string().trim().min(1).max(24).refine(value => Array.from(value).every(character => {
    const code = character.charCodeAt(0);
    return code > 31 && (code < 127 || code > 159);
}));
export const castleAppearanceSchema = z.object({ genderPresentation: z.enum(['male', 'female', 'neutral']), skinTone: z.enum(['light', 'warm', 'tan', 'deep']), hairStyle: z.enum(['short', 'bob', 'long', 'none']), hairColor: z.enum(['black', 'brown', 'chestnut', 'silver']), outfit: z.enum(['casual', 'jacket', 'skirt']), outfitColor: castlePresetSchema }).strict();
export const castleAvatarProfileSchema = castleAppearanceSchema.extend({ version: z.literal(1), alias: castleAliasSchema }).strict();
export const castleProfileResponseSchema = z.object({ profile: castleAvatarProfileSchema, revision: z.number().int().nonnegative() }).strict();
export const castleProfileSaveSchema = z.object({ expectedRevision: z.number().int().min(0).max(2147483646), profile: castleAvatarProfileSchema }).strict();
export type CastleAppearance = z.infer<typeof castleAppearanceSchema>;
export type CastleAvatarProfile = z.infer<typeof castleAvatarProfileSchema>;
export type CastleProfileResponse = z.infer<typeof castleProfileResponseSchema>;
export type CastleProfileSave = z.infer<typeof castleProfileSaveSchema>;
export function defaultCastleProfile(displayName?: string | null): CastleAvatarProfile {
    const clean = typeof displayName === 'string' ? Array.from(Array.from(displayName).filter(character => {
        const code = character.charCodeAt(0);
        return code > 31 && (code < 127 || code > 159);
    }).join('').trim()).reduce((text, character) => (text + character).length <= 24 ? text + character : text, '') : '';
    return { version: 1, alias: clean && !displayName?.includes('@') ? clean : '同行者', genderPresentation: 'neutral', skinTone: 'warm', hairStyle: 'short', hairColor: 'brown', outfit: 'casual', outfitColor: 'jade' };
}
export function castleAppearance(profile: CastleAvatarProfile): CastleAppearance {
    const { genderPresentation, skinTone, hairStyle, hairColor, outfit, outfitColor } = profile;
    return { genderPresentation, skinTone, hairStyle, hairColor, outfit, outfitColor };
}
export const legacyCastleAppearance = (preset: z.infer<typeof castlePresetSchema>): CastleAppearance => ({ ...castleAppearance(defaultCastleProfile()), outfitColor: preset });
