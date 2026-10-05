import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  colorTokens,
  kebabToCamel,
  radius,
  rawColorTokens,
  resolveColorTokens,
  space,
  typeSpecs,
  type TypeStyleName,
} from '../../../src/theme/tokens';

const designTokens = JSON.parse(
  readFileSync(resolve(__dirname, '../../../Design/design-tokens.json'), 'utf8'),
);

const px = (v: string) => Number(v.replace('px', ''));

describe('tokens: copia local vs Design/design-tokens.json', () => {
  it('kebabToCamel convierte nombres de token', () => {
    expect(kebabToCamel('surface-page')).toBe('surfacePage');
    expect(kebabToCamel('ink-on-brand')).toBe('inkOnBrand');
    expect(kebabToCamel('amount-lg')).toBe('amountLg');
    expect(kebabToCamel('h1')).toBe('h1');
  });

  it('los colores claro y oscuro coinciden con el JSON, token por token', () => {
    for (const token of designTokens.color.tokens) {
      const camel = kebabToCamel(token.name) as keyof typeof colorTokens.light;
      const resolveRef = (v: string, scheme: 'light' | 'dark') => {
        const m = /^\{(.+)\}$/.exec(v);
        if (!m) return v;
        const ref = designTokens.color.tokens.find((t: { name: string }) => t.name === m[1]);
        return ref.value[scheme];
      };
      expect(colorTokens.light[camel], token.name).toBe(resolveRef(token.value.light, 'light'));
      expect(colorTokens.dark[camel], token.name).toBe(resolveRef(token.value.dark, 'dark'));
    }
    expect(Object.keys(colorTokens.light)).toHaveLength(designTokens.color.tokens.length);
    expect(Object.keys(colorTokens.dark)).toHaveLength(designTokens.color.tokens.length);
  });

  it('tipografía: cada estilo del JSON existe con tamaño, interlineado, peso y familia', () => {
    const styles = designTokens.type.groups.flatMap(
      (g: { family: string; styles: { name: string; fontSize: string; lineHeight: string; fontWeight: number }[] }) =>
        g.styles.map((s) => ({ ...s, family: g.family })),
    );
    expect(styles).toHaveLength(Object.keys(typeSpecs).length);
    for (const s of styles) {
      const spec = typeSpecs[kebabToCamel(s.name) as TypeStyleName];
      expect(spec, s.name).toBeDefined();
      expect(spec.fontSize, s.name).toBe(px(s.fontSize));
      expect(spec.lineHeight, s.name).toBe(px(s.lineHeight));
      expect(spec.weight, s.name).toBe(s.fontWeight);
      expect(spec.family, s.name).toBe(s.family);
    }
  });

  it('espaciado space-1..7 y radios coinciden con el JSON', () => {
    for (const t of designTokens.spacing.tokens) {
      const step = Number(t.name.replace('space-', '')) as keyof typeof space;
      expect(space[step], t.name).toBe(px(t.value));
    }
    expect(Object.keys(space)).toHaveLength(designTokens.spacing.tokens.length);
    for (const t of designTokens.radius.tokens) {
      const key = t.name.replace('radius-', '') as keyof typeof radius;
      expect(radius[key], t.name).toBe(px(t.value));
    }
    expect(Object.keys(radius)).toHaveLength(designTokens.radius.tokens.length);
  });
});

describe('resolución de referencias {token}', () => {
  it('focus-ring resuelve {brand-primary} en ambos esquemas', () => {
    expect(colorTokens.light.focusRing).toBe('#0B3B36');
    expect(colorTokens.dark.focusRing).toBe('#4FC9A8');
    expect(colorTokens.light.focusRing).toBe(colorTokens.light.brandPrimary);
    expect(colorTokens.dark.focusRing).toBe(colorTokens.dark.brandPrimary);
  });

  it('ningún valor resuelto conserva llaves', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const [name, value] of Object.entries(colorTokens[scheme])) {
        expect(value, `${scheme}.${name}`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('lanza si la referencia no existe', () => {
    expect(() => resolveColorTokens([{ name: 'a', light: '{nope}', dark: '#000000' }], 'light')).toThrow(/inexistente/);
  });

  it('lanza si hay un ciclo', () => {
    expect(() =>
      resolveColorTokens(
        [
          { name: 'a', light: '{b}', dark: '#000000' },
          { name: 'b', light: '{a}', dark: '#000000' },
        ],
        'light',
      ),
    ).toThrow(/circular/);
  });

  it('resuelve cadenas de referencias', () => {
    const out = resolveColorTokens(
      [
        { name: 'base', light: '#111111', dark: '#222222' },
        { name: 'mid', light: '{base}', dark: '{base}' },
        { name: 'top', light: '{mid}', dark: '{mid}' },
      ],
      'dark',
    );
    expect(out.top).toBe('#222222');
  });

  it('rawColorTokens conserva la referencia sin resolver', () => {
    expect(rawColorTokens.find((t) => t.name === 'focus-ring')?.light).toBe('{brand-primary}');
  });
});
