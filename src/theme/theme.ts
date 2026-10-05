/**
 * Construcción PURA del objeto de tema que devuelve `useTheme()`.
 */
import { fontFamilyFor } from './fontFamilies';
import {
  colorTokens,
  INK_SECONDARY_MIN_SIZE,
  radius,
  shadowSheetTokens,
  space,
  typeSpecs,
  type ColorTokenName,
  type ColorTokens,
  type RadiusName,
  type Scheme,
  type ShadowStyle,
  type SpaceStep,
  type TypeStyleName,
} from './tokens';

/** Estilo de texto listo para React Native: sin `fontWeight` (el peso va en la familia). */
export interface ResolvedTypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export interface Theme {
  scheme: Scheme;
  colors: ColorTokens;
  type: Readonly<Record<TypeStyleName, ResolvedTypeStyle>>;
  space: Readonly<Record<SpaceStep, number>>;
  radius: Readonly<Record<RadiusName, number>>;
  shadowSheet: ShadowStyle;
}

const resolvedType = Object.fromEntries(
  (Object.keys(typeSpecs) as TypeStyleName[]).map((name) => {
    const s = typeSpecs[name];
    const style: ResolvedTypeStyle = {
      fontFamily: fontFamilyFor(s.family, s.weight),
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
    };
    return [name, style];
  }),
) as Record<TypeStyleName, ResolvedTypeStyle>;

const themes: Readonly<Record<Scheme, Theme>> = {
  light: {
    scheme: 'light',
    colors: colorTokens.light,
    type: resolvedType,
    space,
    radius,
    shadowSheet: shadowSheetTokens.light,
  },
  dark: {
    scheme: 'dark',
    colors: colorTokens.dark,
    type: resolvedType,
    space,
    radius,
    shadowSheet: shadowSheetTokens.dark,
  },
};

/** Tema (referencia estable) para un esquema efectivo. */
export function getTheme(scheme: Scheme): Theme {
  return themes[scheme];
}

/**
 * Regla del Design System: ink-secondary solo para texto de 14 px o más (contraste más bajo).
 * Si se pide secundario para un texto más pequeño se usa ink-primary.
 */
export function inkFor(colors: ColorTokens, fontSize: number, wanted: 'primary' | 'secondary'): string {
  if (wanted === 'secondary' && fontSize >= INK_SECONDARY_MIN_SIZE) return colors.inkSecondary;
  return colors.inkPrimary;
}

export type { ColorTokenName };
