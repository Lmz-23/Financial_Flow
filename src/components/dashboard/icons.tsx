// Iconos del Dashboard: los mismos trazos SVG del diseno (Dashboard.dc.html), con react-native-svg.
import Svg, { Circle, Path } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

export function PlusIcon({ color, size = 13 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 13 13" fill="none" accessibilityElementsHidden>
      <Path d="M6.5 2V11M2 6.5H11" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function CloseIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none" accessibilityElementsHidden>
      <Path d="M3 3L11 11M11 3L3 11" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ color, size = 11 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 11 11" fill="none" accessibilityElementsHidden>
      <Path d="M2 5.5L4.5 8L9 3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SlidersIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" accessibilityElementsHidden>
      <Path d="M3 5.5H15M3 9H15M3 12.5H15" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Circle cx={7} cy={5.5} r={1.6} fill={color} />
      <Circle cx={12} cy={9} r={1.6} fill={color} />
      <Circle cx={9} cy={12.5} r={1.6} fill={color} />
    </Svg>
  );
}

export function FabPlusIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" accessibilityElementsHidden>
      <Path d="M11 4V18M4 11H18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function SmallPlusIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" accessibilityElementsHidden>
      <Path d="M8 2.5V13.5M2.5 8H13.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
