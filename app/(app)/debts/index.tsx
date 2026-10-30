import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { commands, getDomain } from '../../../src/app-services';
import { DebtsDesktop } from '../../../src/components/debt/desktop/DebtsDesktop';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { MIN_TOUCH, SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Input } from '../../../src/components/ui/ds/Input';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { Pill } from '../../../src/components/ui/ds/Pill';
import { ProgressBar } from '../../../src/components/ui/ds/ProgressBar';
import { Text } from '../../../src/components/ui/ds/Text';
import { Widget } from '../../../src/components/ui/ds/Widget';
import type { Minor } from '../../../src/domain/money';
import type { DebtView } from '../../../src/domain/services/DebtService';
import { useDebts } from '../../../src/hooks';
import { useIsDesktop } from '../../../src/hooks/useLayoutSize';
import { MSG_BALANCE_REQUIRED } from '../../../src/lib/debtForm';
import { debtDueLabel, debtProgress, debtProjection, debtRateLabel, debtsCountLabel } from '../../../src/lib/debtView';
import { errorMessage } from '../../../src/lib/screenErrors';
import { routes } from '../../../src/navigation/routes';
import { fontFamilyFor, useTheme } from '../../../src/theme';

/** Inferidos: espejo de los textos aprobados de cuentas (accounts/[id].tsx), cambiando «cuenta» por «deuda». */
const MSG_DELETE_CONFIRM = '¿Eliminar esta deuda? Esta acción no se puede deshacer.';
const MSG_ARCHIVE_CONFIRM = 'Esta deuda tiene pagos, así que la archivaremos en lugar de borrarla. Tu historial se conserva.';
/** Reusado del widget del Dashboard. */
const MSG_EMPTY = 'Aún no has agregado ninguna.';

/** Pago de cuota desde la lista: sin ocurrencia, el dominio usa la próxima fecha (ruta de §6 fila 6). */
const payHref = (debtId: string) => `/debts/${debtId}/pay?type=INSTALLMENT` as Href;

/** Deudas: en escritorio (web ≥ 600 px) tabla con panel de detalle; en el celular, la lista expandible. */
export default function DebtsScreen() {
  const desktop = useIsDesktop();
  return desktop ? <DebtsDesktop /> : <DebtsMobile />;
}

/** Deudas (Dashboard.dc.html, onDeudas): total, lista expandible con tasa, progreso y proyección. */
function DebtsMobile() {
  const { space } = useTheme();
  const router = useRouter();
  const { debts, totalMinor } = useDebts();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Deudas" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] }}
      >
        <View style={{ gap: 2 }}>
          <Amount value={totalMinor} variant="amountLg" />
          <Text variant="bodySm" tone="secondary">
            {debtsCountLabel(debts.length)}
          </Text>
        </View>

        {debts.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_EMPTY}
          </Text>
        ) : (
          <View style={{ gap: space[3] }}>
            {debts.map((debt) => (
              <DebtCard
                key={debt.id}
                debt={debt}
                expanded={expandedId === debt.id}
                onToggle={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
                onPay={() => router.push(payHref(debt.id))}
              />
            ))}
          </View>
        )}

        <Button label="Agregar deuda" variant="ghost" onPress={() => router.push(routes.debtNew())} />
      </ScrollView>
    </View>
  );
}

function Chevron({ color, up }: { color: string; up: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" accessibilityElementsHidden>
      <Path
        d={up ? 'M4 10L8 6L12 10' : 'M4 6L8 10L12 6'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TextAction({ label, tone, onPress }: { label: string; tone: 'brand' | 'debt'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}
    >
      <Text variant="bodySm" tone={tone} style={{ fontFamily: fontFamilyFor('sans', 600) }}>
        {label}
      </Text>
    </Pressable>
  );
}

function DebtCard({
  debt,
  expanded,
  onToggle,
  onPay,
}: {
  debt: DebtView;
  expanded: boolean;
  onToggle: () => void;
  onPay: () => void;
}) {
  const { colors, space } = useTheme();
  // Borradores: undefined = sin tocar, y el campo muestra el valor vivo de la deuda. Solo se envía
  // lo que el usuario tocó; así un saldo que cambió por fuera no se pisa con un ajuste MANUAL viejo.
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [balanceDraft, setBalanceDraft] = useState<Minor | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const progress = debtProgress(debt);
  const settled = debt.balanceMinor <= 0;

  function startEdit() {
    setNameDraft(undefined);
    setBalanceDraft(undefined);
    setError(null);
    setEditing(true);
  }

  function saveEdit() {
    if (balanceDraft === null) {
      setError(MSG_BALANCE_REQUIRED);
      return;
    }
    if (nameDraft !== undefined || balanceDraft !== undefined) {
      try {
        commands.debts.update(debt.id, {
          ...(nameDraft !== undefined ? { name: nameDraft } : {}),
          ...(balanceDraft !== undefined ? { balanceMinor: balanceDraft } : {}),
        });
      } catch (e) {
        setError(errorMessage(e));
        return;
      }
    }
    setEditing(false);
    setError(null);
  }

  function confirmRemoval() {
    let hasPayments: boolean;
    try {
      hasPayments = getDomain().debts.payments(debt.id).length > 0;
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    Alert.alert('Eliminar deuda', hasPayments ? MSG_ARCHIVE_CONFIRM : MSG_DELETE_CONFIRM, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: hasPayments ? 'Archivar' : 'Eliminar',
        style: 'destructive',
        onPress: () => {
          try {
            commands.debts.remove(debt.id);
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <Widget gap={space[3]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={debt.name}
        style={{ gap: 10 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
          <Text variant="body" style={{ flex: 1, fontFamily: fontFamilyFor('sans', 500) }}>
            {debt.name}
          </Text>
          <Chevron color={colors.inkSecondary} up={expanded} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Amount value={debt.balanceMinor} variant="amountMd" />
          <Pill label={debtDueLabel(debt)} />
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ gap: 10, paddingTop: space[3], borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
          {editing ? (
            <View style={{ gap: 10 }}>
              <Input
                label="Nombre"
                value={nameDraft ?? debt.name}
                onChangeText={(t) => {
                  setNameDraft(t);
                  setError(null);
                }}
                autoCapitalize="sentences"
                returnKeyType="done"
              />
              <MoneyInput
                label="Saldo"
                value={balanceDraft === undefined ? debt.balanceMinor : balanceDraft}
                onChangeValue={(v) => {
                  setBalanceDraft(v);
                  setError(null);
                }}
              />
              {error ? (
                <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space[2] }}>
                <Button label="Guardar" size="md" fullWidth={false} style={{ flex: 1 }} onPress={saveEdit} />
                <Button
                  label="Cancelar"
                  variant="ghost"
                  size="md"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => {
                    setEditing(false);
                    setError(null);
                  }}
                />
              </View>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodySm" tone="secondary">
                  Tasa de interés
                </Text>
                <Text variant="amountSm">{debtRateLabel(debt)}</Text>
              </View>
              <ProgressBar progress={progress.percent} tone="growth" height={6} accessibilityLabel={`Progreso de ${debt.name}`} />
              <Text variant="label" tone="secondary">
                {progress.label}
              </Text>
              <Text variant="bodySm">{debtProjection(debt)}</Text>
              {error ? (
                <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
                  {error}
                </Text>
              ) : null}
              {settled ? null : <Button label="Registrar un pago" size="md" onPress={onPay} />}
              <View style={{ flexDirection: 'row', gap: space[4] }}>
                <TextAction label="Editar" tone="brand" onPress={startEdit} />
                <TextAction label="Eliminar" tone="debt" onPress={confirmRemoval} />
              </View>
            </>
          )}
        </View>
      ) : null}
    </Widget>
  );
}
