// Iconos del onboarding: los mismos trazos SVG de Step1-Step4 (.dc.html), con react-native-svg.
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export function ChevronLeftIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" accessibilityElementsHidden>
      <Path d="M12.5 15L7.5 10L12.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PlusIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" accessibilityElementsHidden>
      <Path d="M9 3V15M3 9H15" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function BigCheckIcon({ color, size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" accessibilityElementsHidden>
      <Path d="M5 14L11 20L23 7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
