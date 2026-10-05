/**
 * Primitivas del Design System (tema dinámico vía useTheme; ninguna importa `colors` estático).
 *
 * Viven en `ui/ds/` porque `ui/` aún contiene las primitivas ANTIGUAS (Button, Input,
 * ProgressBar, Card, Modal, …) que usan las pantallas existentes con APIs distintas. Cuando las
 * pantallas se rehagan (F6) se borran las antiguas y esta carpeta sube un nivel.
 */
export { Text } from './Text';
export type { TextProps } from './Text';
export { Amount } from './Amount';
export type { AmountProps } from './Amount';
export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';
export { Widget } from './Widget';
export type { WidgetProps } from './Widget';
export { InviteCard } from './InviteCard';
export type { InviteCardProps } from './InviteCard';
export { Input } from './Input';
export type { InputProps } from './Input';
export { MoneyInput } from './MoneyInput';
export type { MoneyInputProps } from './MoneyInput';
export { Pill } from './Pill';
export type { PillProps } from './Pill';
export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentedOption } from './SegmentedControl';
export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';
export { Sheet } from './Sheet';
export type { SheetProps } from './Sheet';
export { ListRow } from './ListRow';
export type { ListRowProps } from './ListRow';
export { AccountPicker } from './AccountPicker';
export type { AccountPickerProps, AccountOption } from './AccountPicker';
export { SCREEN_MARGIN } from './constants';
export type { TextTone } from './tone';
