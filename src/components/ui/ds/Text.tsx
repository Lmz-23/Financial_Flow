import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type TypeStyleName } from '../../../theme';
import { toneColor, type TextTone } from './tone';

export interface TextProps extends RNTextProps {
  /** Estilo tipográfico del Design System (display-lg … label). Por defecto 'body'. */
  variant?: TypeStyleName;
  /** Color semántico. Por defecto 'primary'. 'secondary' se degrada a 'primary' bajo 14 px. */
  tone?: TextTone;
}

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const { type, colors } = useTheme();
  const typeStyle = type[variant];
  return (
    <RNText
      {...rest}
      style={[typeStyle, { color: toneColor(colors, tone, typeStyle.fontSize) }, style]}
    />
  );
}
