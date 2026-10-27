import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { commands } from '../../../../src/app-services';
import { AccountPicker } from '../../../../src/components/ui/ds/AccountPicker';
import { Amount } from '../../../../src/components/ui/ds/Amount';
import { Button } from '../../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../../src/components/ui/ds/constants';
import { Text } from '../../../../src/components/ui/ds/Text';
import { isValidLocalDate, toLocalDate, type LocalDate } from '../../../../src/domain/dates';
import { useAccounts } from '../../../../src/hooks';
import { useRecurringItem } from '../../../../src/hooks/useRecurring';
import { confirmSubtitle } from '../../../../src/lib/recurringForm';
import { errorMessage } from '../../../../src/lib/screenErrors';
import { routes } from '../../../../src/navigation/routes';
import { useTheme } from '../../../../src/theme';

// Textos de ConfirmacionPago.dc.html.
const LABEL_CONFIRM = 'Ya pagué';
const LABEL_SNOOZE = 'Todavía no, recuérdamelo luego';
const DONE_TITLE = '¡Listo!';
// INFERIDOS (el diseño no tiene selector de cuenta ni estados de error).
const LABEL_ACCOUNT = 'Cuenta';
const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';
const MSG_PICK_ACCOUNT = 'Elige una cuenta.';
const MSG_NOT_FOUND = 'No encontramos este pago.';
/** El estado «¡Listo!» se ve un momento y la hoja se cierra sola. */
const DONE_VISIBLE_MS = 1500;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Hoja «Ya pagué» (ConfirmacionPago.dc.html + selector de cuenta de D8). Solo para gastos: a los
 * ingresos no se les ofrece marcar (decisión 45), así que un enlace a un ingreso lleva a su edición.
 * Se presenta como formSheet: la declaración está en `app/(app)/_layout.tsx`.
 */
export default function ConfirmRecurringSheet() {
  const params = useLocalSearchParams<{ id: string; occurrence?: string | string[] }>();
  const { id } = params;
  const occurrenceParam = firstParam(params.occurrence);
  const row = useRecurringItem(id);

  if (row && row.type === 'INCOME') return <Redirect href={routes.recurringEdit(row.id)} />;
  // La ocurrencia es obligatoria y debe ser una fecha real; el dominio valida además que sea de la serie.
  const occurrence = occurrenceParam && isValidLocalDate(occurrenceParam) ? occurrenceParam : null;
  if (!row || occurrence === null) return <SheetMessage text={MSG_NOT_FOUND} />;

  return (
    <ConfirmContent
      id={row.id}
      name={row.name ?? ''}
      amountMinor={row.amountMinor}
      defaultAccountId={row.defaultAccountId}
      occurrence={occurrence}
    />
  );
}

function SheetMessage({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, padding: SCREEN_MARGIN }}>
      <Text variant="bodySm" tone="secondary">
        {text}
      </Text>
    </View>
  );
}

function ConfirmContent({
  id,
  name,
  amountMinor,
  defaultAccountId,
  occurrence,
}: {
  id: string;
  name: string;
  amountMinor: number | null;
  defaultAccountId: string | null;
  occurrence: LocalDate;
}) {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const { accounts } = useAccounts();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  // Guarda síncrona: un segundo toque no confirma dos veces ni mezcla «Ya pagué» con «Todavía no».
  const busy = useRef(false);
  const [today] = useState(() => toLocalDate(Date.now()));

  // Siempre pide cuenta y preselecciona la predeterminada (D8) si sigue activa.
  const selectedAccountId =
    accountId ??
    (defaultAccountId !== null && accounts.some((a) => a.id === defaultAccountId) ? defaultAccountId : null);

  useEffect(() => {
    if (!confirmed) return undefined;
    const timer = setTimeout(() => router.back(), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [confirmed, router]);

  function confirm() {
    if (busy.current) return;
    if (!selectedAccountId) {
      setError(MSG_PICK_ACCOUNT);
      return;
    }
    try {
      commands.recurring.confirmOccurrence({ recurringId: id, occurrenceDate: occurrence, accountId: selectedAccountId });
      busy.current = true;
      setConfirmed(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function snooze() {
    if (busy.current) return;
    try {
      commands.recurring.snooze(id);
      busy.current = true;
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (confirmed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], padding: SCREEN_MARGIN }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.full,
            backgroundColor: colors.signalGrowth,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
            <Path d="M4 12L9.5 17.5L20 6" stroke={colors.inkOnBrand} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
        <View style={{ alignItems: 'center', gap: space[1] }} accessibilityLiveRegion="polite">
          <Text variant="h3">{DONE_TITLE}</Text>
          <Text variant="bodySm" tone="secondary">{`Marcamos ${name} como pagado.`}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: SCREEN_MARGIN, paddingTop: space[6], gap: space[5] }}
    >
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text variant="h3" style={{ textAlign: 'center' }}>{`¿Ya pagaste ${name}?`}</Text>
        {amountMinor === null ? null : <Amount value={amountMinor} variant="amountLg" />}
        <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
          {confirmSubtitle(occurrence, today)}
        </Text>
      </View>
      <AccountPicker
        label={LABEL_ACCOUNT}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }))}
        selectedId={selectedAccountId}
        onSelect={(next) => {
          setAccountId(next);
          setError(null);
        }}
        emptyText={MSG_NO_ACCOUNTS}
      />
      {error ? (
        <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <View style={{ gap: 10 }}>
        <Button label={LABEL_CONFIRM} onPress={confirm} />
        <Button label={LABEL_SNOOZE} variant="ghost" size="md" onPress={snooze} />
      </View>
    </ScrollView>
  );
}
