import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { LocalDate } from '../../domain/dates';
import { useAccounts } from '../../hooks';
import { errorMessage } from '../../lib/screenErrors';
import { biweeklyAdjustNotice } from '../../lib/recurringForm';
import { type RecurringFrequency } from '../../lib/onboardingDraft';
import { routes } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { KeyboardFooter, KeyboardScreen } from '../screens/KeyboardScreen';
import { ScreenHeader } from '../screens/ScreenHeader';
import { FrequencyChips } from '../onboarding/FrequencyChips';
import { AccountPicker } from '../ui/ds/AccountPicker';
import { Button } from '../ui/ds/Button';
import { SCREEN_MARGIN } from '../ui/ds/constants';
import { DatePickerField } from '../ui/ds/DatePickerField';
import { Input } from '../ui/ds/Input';
import { MoneyInput } from '../ui/ds/MoneyInput';
import { SegmentedControl } from '../ui/ds/SegmentedControl';
import { Text } from '../ui/ds/Text';

export type RecurringType = 'EXPENSE' | 'INCOME';

export interface RecurringFormValues {
  type: RecurringType;
  name: string;
  amountMinor: number | null;
  frequency: RecurringFrequency;
  date: LocalDate | null;
  /** Cuenta predeterminada (D8): obligatoria en el formulario. */
  accountId: string | null;
}

/** Tipos del diseno (Dashboard.dc.html, setRecPago / setRecIngreso). */
const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Pago', tone: 'debt' },
  { value: 'INCOME', label: 'Ingreso', tone: 'growth' },
] as const;

/** Placeholders del diseno (recNamePlaceholder). */
const NAME_PLACEHOLDER: Record<RecurringType, string> = {
  EXPENSE: 'Ej. Arriendo, internet, seguro',
  INCOME: 'Ej. Arriendo que cobras, mesada',
};

// INFERIDOS (el diseno no tiene selector de cuenta; D8 lo exige).
const LABEL_ACCOUNT = 'Cuenta predeterminada';
const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';
const MSG_PICK_ACCOUNT = 'Elige una cuenta.';

export interface RecurringFormProps {
  title: string;
  initial: RecurringFormValues;
  /** En edicion el tipo no se cambia (el dominio no lo admite): se oculta el selector. */
  typeLocked?: boolean;
  dateLabel: string;
  submitLabel: string;
  /** Guarda; lanza si falla. Devolver true cierra el formulario (bloquea un segundo toque). */
  onSubmit: (values: RecurringFormValues) => boolean | void;
  /** Aviso verde sobre el boton (p. ej. «Guardado»). */
  notice?: string | null;
  /** Contenido extra bajo los campos (p. ej. «Eliminar»). */
  children?: ReactNode;
}

/** Formulario compartido de «Nuevo recurrente» y la edicion de un recurrente (Dashboard.dc.html, onAgregarRecurrente). */
export function RecurringForm({
  title,
  initial,
  typeLocked = false,
  dateLabel,
  submitLabel,
  onSubmit,
  notice,
  children,
}: RecurringFormProps) {
  const { space } = useTheme();
  const router = useRouter();
  const { accounts } = useAccounts();
  const [type, setType] = useState<RecurringType>(initial.type);
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState<number | null>(initial.amountMinor);
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial.frequency);
  const [date, setDate] = useState<LocalDate | null>(initial.date);
  const [accountId, setAccountId] = useState<string | null>(initial.accountId);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica el recurrente.
  const locked = useRef(false);
  const [done, setDone] = useState(false);

  // Preselecciona la predeterminada (D8) si sigue activa; si no, la primera cuenta, visible y cambiable.
  const selectedAccountId =
    accountId !== null && accounts.some((a) => a.id === accountId) ? accountId : (accounts[0]?.id ?? null);
  // Aviso EN VIVO del ajuste quincenal: nunca en silencio tras guardar.
  const adjustNotice = biweeklyAdjustNotice(date, frequency);

  function save() {
    if (locked.current) return;
    if (!selectedAccountId) {
      setError(MSG_PICK_ACCOUNT);
      return;
    }
    try {
      const close = onSubmit({ type, name, amountMinor: amount, frequency, date, accountId: selectedAccountId });
      if (close === true) {
        locked.current = true;
        setDone(true);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardScreen>
      <ScreenHeader title={title} onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        {typeLocked ? null : (
          <SegmentedControl
            options={TYPE_OPTIONS}
            value={type}
            onChange={(next) => {
              setType(next);
              setError(null);
            }}
            accessibilityLabel="Tipo de recurrente"
          />
        )}
        <Input
          label="Nombre"
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
          }}
          placeholder={NAME_PLACEHOLDER[type]}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        <MoneyInput
          label="Monto"
          value={amount}
          onChangeValue={(v) => {
            setAmount(v);
            setError(null);
          }}
        />
        <View style={{ gap: space[2] }}>
          <Text variant="label">Frecuencia</Text>
          <FrequencyChips
            value={frequency}
            onChange={(f) => {
              setFrequency(f);
              setError(null);
            }}
            tone={type === 'INCOME' ? 'growth' : 'debt'}
            accessibilityLabel="Frecuencia"
          />
        </View>
        <View style={{ gap: space[2] }}>
          <DatePickerField
            label={dateLabel}
            value={date}
            onChange={(d) => {
              setDate(d);
              setError(null);
            }}
            clearable
          />
          {adjustNotice ? (
            <Text variant="bodySm" tone="secondary" accessibilityLiveRegion="polite">
              {adjustNotice}
            </Text>
          ) : null}
        </View>
        <AccountPicker
          label={LABEL_ACCOUNT}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }))}
          selectedId={selectedAccountId}
          onSelect={(id) => {
            setAccountId(id);
            setError(null);
          }}
          emptyText={MSG_NO_ACCOUNTS}
        />
        {accounts.length === 0 ? (
          <Button label="Agregar cuenta" variant="ghost" size="md" onPress={() => router.push(routes.accountNew())} />
        ) : null}
        {children}
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="bodySm" tone="growth" accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
      </ScrollView>
      <KeyboardFooter>
        <Button label={submitLabel} onPress={save} disabled={done} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
