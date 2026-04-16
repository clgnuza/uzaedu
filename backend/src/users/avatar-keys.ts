/** Hazır profil görseli anahtarları (DB + DTO; web ile aynı liste). */
export const AVATAR_KEYS = [
  'rose',
  'ocean',
  'sunset',
  'forest',
  'slate',
  'violet',
  'amber',
  'mint',
  'laptop',
  'bulb',
  'note',
  'mind',
  'palette',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];
