export const colors = {
  // Backgrounds
  bg: '#0a0a0f',
  surface1: '#13131a',
  surface2: '#1c1c26',
  surface3: '#242430',

  // Borders
  border: '#2a2a38',
  borderLight: '#333345',

  // Text
  textPrimary: '#f0eff8',
  textMuted: '#7c7b8f',
  textHint: '#4a4a5a',

  // Accents
  accentGreen: '#2dd4a0',
  accentBlue: '#4d9cf8',
  accentRed: '#f26b6b',
  accentAmber: '#f5b942',
  accentPurple: '#a78bfa',
} as const;

export type Colors = typeof colors;
export type ColorKey = keyof Colors;
