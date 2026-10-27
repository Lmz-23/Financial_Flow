import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { commands } from '../../../../src/app-services';
import { KeyboardFooter, KeyboardScreen } from '../../../../src/components/screens/KeyboardScreen';
import { ScreenHeader } from '../../../../src/components/screens/ScreenHeader';
import { AccountPicker } from '../../../../src/components/ui/ds/AccountPicker';
import { Button } from '../../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../../src/components/ui/ds/constants';
import { MoneyInput } from '../../../../src/components/ui/ds/MoneyInput';
import { SegmentedControl } from '../../../../src/components/ui/ds/SegmentedControl';
import { Text } from '../../../../src/components/ui/ds/Text';
import type { LocalDate } from '../../../../src/domain/dates';
import type { Minor } from '../../../../src/domain/money';
import { useAccounts } from '../../../../src/hooks';
import { useDebtDetail } from '../../../../src/hooks/useDebtDetail';
import { parsePayParams, type PaymentType } from '../../../../src/lib/debtForm';
import { MSG_DEBT_SETTLED } from '../../../../src/lib/debtView';
import { errorMessage } from '../../../../src/lib/screenErrors';
import { routes } from '../../../../src/navigation/routes';
import { useTheme } from '../../../../src/theme';

const TYPE_OPTIONS = [
  { value: 'INSTALLMENT', label: 'Cuota' },
  { value: 'EXTRA', label: 'Abono extra' },
] as const;

const TYPE_HINT: Record<PaymentType, string> = {
  INSTALLMENT: 'Tu cuota regular del mes. Cuenta como uno de tus pagos programados.',
  EXTRA: 'Un pago extra, además o en vez de la cuota, para reducir el saldo más rápido.',
};
const MSG_EXPENSE_NOTE = 'Esto cuenta como gasto y reduce el saldo de la cuenta que elijas — el dinero sale de verdad.';
/** Reusados de «Nueva transacción» (MSG_NO_ACCOUNTS, MSG_PICK_ACCOUNT). */
const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';
const MSG_PICK_ACCOUNT = 'Elige una cuenta.';
/** Inferido: espejo de «No encontramos esta cuenta.». */
const MSG_NOT_FOUND = 'No encontramos esta deuda.';

/** Registrar pago de deuda (Dashboard.dc.html, onPagoDeuda): cuota o abono extra; siempre es gasto real. */
export default function DebtPayScreen() {
  const { id, ...params } = useLocalSearchParams<{ id: string; type?: string; occurrence?: string }>();
  const router = useRouter();
  const debt = useDebtDetail(id);

  if (!debt || debt.archivedAt !== null) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Pago de deuda" onBack={() => router.back()} />
        <Text variant="bodySm" tone="secondary" style={{ padding: SCREEN_MARGIN }}>
          {MSG_NOT_FOUND}
        </Text>
      </View>
    );
  }

  return (
    <PayForm
      key={id}
      debtId={id}
      name={debt.name}
      installmentMinor={debt.installmentMinor}
      settled={debt.balanceMinor <= 0}
      initial={parsePayParams(params)}
    />
  );
}

function PayForm({
  debtId,
  name,
  installmentMinor,
  settled,
  initial,
}: {
  debtId: string;
  name: string;
  installmentMinor: Minor | null;
  settled: boolean;
  initial: { type: PaymentType; occurrence: LocalDate | undefined };
}) {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const { accounts } = useAccounts();
  const [type, setType] = useState<PaymentType>(initial.type);
  const [amount, setAmount] = useState<Minor | null>(initial.type === 'INSTALLMENT' ? installmentMinor : null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica el pago.
  const saved = useRef(false);
  const [done, setDone] = useState(false);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;

  function changeType(next: PaymentType) {
    setType(next);
    // Como en el diseño: volver a «Cuota» repone el monto de la cuota.
    if (next === 'INSTALLMENT') setAmount(installmentMinor);
    setError(null);
  }

  function save() {
    if (saved.current) return;
    if (!selectedAccountId) {
      setError(MSG_PICK_ACCOUNT);
      return;
    }
    try {
      commands.debts.registerPayment({
        debtId,
        accountId: selectedAccountId,
        amountMinor: amount ?? 0,
        type,
        // `occurrence` solo aplica a una cuota; el abono extra la ignora.
        ...(type === 'INSTALLMENT' && initial.occurrence ? { occurrenceDate: initial.occurrence } : {}),
      });
      saved.current = true;
      setDone(true);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  // Tras pagar, la deuda puede quedar en 0 antes de que se cierre la pantalla: no se cambia la vista.
  const showSettled = settled && !done;

  return (
    <KeyboardScreen>
      <ScreenHeader title={`Pago de ${name}`} onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        {showSettled ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_DEBT_SETTLED}
          </Text>
        ) : (
          <>
            <SegmentedControl
              options={TYPE_OPTIONS}
              value={type}
              onChange={changeType}
              accessibilityLabel="Tipo de pago"
            />
            <Text variant="label" tone="secondary">
              {TYPE_HINT[type]}
            </Text>
            <MoneyInput
              label="Monto"
              value={amount}
              onChangeValue={(v) => {
                setAmount(v);
                setError(null);
              }}
            />
            <AccountPicker
              label="¿De qué cuenta sale?"
              accounts={accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }))}
              selectedId={selectedAccountId}
              onSelect={(accId) => {
                setAccountId(accId);
                setError(null);
              }}
              emptyText={MSG_NO_ACCOUNTS}
            />
            {accounts.length === 0 ? (
              <Button label="Agregar cuenta" variant="ghost" size="md" onPress={() => router.push(routes.accountNew())} />
            ) : null}
            <View style={{ padding: 14, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised }}>
              <Text variant="label" tone="secondary">
                {MSG_EXPENSE_NOTE}
              </Text>
            </View>
          </>
        )}
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      {showSettled ? null : (
        <KeyboardFooter>
          <Button label="Registrar pago" onPress={save} disabled={done} />
        </KeyboardFooter>
      )}
    </KeyboardScreen>
  );
}
