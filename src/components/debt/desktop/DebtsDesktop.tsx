import { useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { commands, getDomain } from '../../../app-services';
import type { Minor } from '../../../domain/money';
import type { DebtView } from '../../../domain/services/DebtService';
import { toLocalDate } from '../../../domain/dates';
import { useDebts } from '../../../hooks';
import { useDebtPayments } from '../../../hooks/useDebtPayments';
import { confirmAction } from '../../../lib/confirmAction';
import { shortDateLabel } from '../../../lib/dateLabels';
import { MSG_BALANCE_REQUIRED } from '../../../lib/debtForm';
import { debtDueLabel, debtProgress, debtProjection, debtRateLabel, debtsCountLabel } from '../../../lib/debtView';
import { errorMessage } from '../../../lib/screenErrors';
import { routes } from '../../../navigation/routes';
import { useTheme } from '../../../theme';
import { DataTable, type DataColumn } from '../../desktop/DataTable';
import { DefinitionList, DetailPanel, Tag } from '../../desktop/DetailPanel';
import { DesktopPage } from '../../desktop/DesktopPage';
import { ListDetailLayout } from '../../desktop/ListDetailLayout';
import { Amount } from '../../ui/ds/Amount';
import { Button } from '../../ui/ds/Button';
import { Input } from '../../ui/ds/Input';
import { MoneyInput } from '../../ui/ds/MoneyInput';
import { ProgressBar } from '../../ui/ds/ProgressBar';
import { Text } from '../../ui/ds/Text';

const MSG_EMPTY = 'Aún no has agregado ninguna.';
const MSG_DELETE_CONFIRM = '¿Eliminar esta deuda? Esta acción no se puede deshacer.';
const MSG_ARCHIVE_CONFIRM = 'Esta deuda tiene pagos, así que la archivaremos en lugar de borrarla. Tu historial se conserva.';

/** Pago de cuota desde la lista: sin ocurrencia, el dominio usa la próxima fecha. */
const payHref = (debtId: string) => `/debts/${debtId}/pay?type=INSTALLMENT` as Href;

/** Deudas en escritorio (Design/escritorio, 2g): tabla de deudas y panel de detalle a la derecha. */
export function DebtsDesktop() {
  const { space } = useTheme();
  const router = useRouter();
  const { debts, totalMinor } = useDebts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = debts.find((d) => d.id === selectedId) ?? null;

  const columns: DataColumn<DebtView>[] = [
    {
      key: 'name',
      title: 'Deuda',
      flex: 2,
      render: (d) => (
        <View style={{ gap: 2 }}>
          <Text variant="body" numberOfLines={1}>
            {d.name}
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {`Próximo pago · ${debtDueLabel(d)}`}
          </Text>
        </View>
      ),
    },
    { key: 'balance', title: 'Saldo', width: 130, align: 'right', render: (d) => <Amount value={d.balanceMinor} variant="amountSm" /> },
    {
      key: 'rate',
      title: 'Tasa',
      flex: 1.2,
      render: (d) => (
        <Text variant="bodySm" tone="secondary">
          {debtRateLabel(d)}
        </Text>
      ),
    },
    {
      key: 'installment',
      title: 'Cuota',
      width: 120,
      align: 'right',
      render: (d) =>
        d.installmentMinor !== null && d.installmentMinor > 0 ? (
          <Amount value={d.installmentMinor} variant="amountSm" />
        ) : (
          <Text variant="bodySm" tone="secondary">
            Sin definir
          </Text>
        ),
    },
    {
      key: 'progress',
      title: 'Avance',
      flex: 1.5,
      render: (d) => {
        const p = debtProgress(d);
        return (
          <View style={{ width: '100%', gap: 4 }}>
            <ProgressBar progress={p.percent} tone="growth" height={6} accessibilityLabel={`Progreso de ${d.name}`} />
            <Text variant="label" tone="secondary" numberOfLines={1}>
              {p.label}
            </Text>
          </View>
        );
      },
    },
  ];

  const list = (
    <DesktopPage
      eyebrow="Saldo pendiente total"
      heading={
        <View style={{ gap: 2 }}>
          <Amount value={totalMinor} variant="amountLg" tone="debt" />
          <Text variant="bodySm" tone="secondary">
            {debtsCountLabel(debts.length)}
          </Text>
        </View>
      }
      actions={<Button label="+ Agregar deuda" size="md" fullWidth={false} onPress={() => router.push(routes.debtNew())} />}
    >
      <DataTable
        columns={columns}
        rows={debts}
        rowKey={(d) => d.id}
        rowHeight={64}
        selectedKey={selectedId}
        onRowPress={(d) => setSelectedId(d.id === selectedId ? null : d.id)}
        empty={MSG_EMPTY}
        accessibilityLabelFor={(d) => d.name}
      />
      <View style={{ height: space[2] }} />
    </DesktopPage>
  );

  return (
    <ListDetailLayout
      list={list}
      detail={
        selected ? (
          <DebtDetail
            key={selected.id}
            debt={selected}
            onClose={() => setSelectedId(null)}
            onPay={() => router.push(payHref(selected.id))}
          />
        ) : null
      }
    />
  );
}

function DebtDetail({ debt, onClose, onPay }: { debt: DebtView; onClose: () => void; onPay: () => void }) {
  const { colors, radius, space } = useTheme();
  const payments = useDebtPayments(debt.id);
  const progress = debtProgress(debt);
  const settled = debt.balanceMinor <= 0;
  // Borradores: undefined = sin tocar; solo se envía lo que el usuario tocó (igual que en el celular).
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [balanceDraft, setBalanceDraft] = useState<Minor | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

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

  function remove() {
    let hasPayments: boolean;
    try {
      hasPayments = getDomain().debts.payments(debt.id).length > 0;
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    confirmAction({
      title: 'Eliminar deuda',
      message: hasPayments ? MSG_ARCHIVE_CONFIRM : MSG_DELETE_CONFIRM,
      confirmLabel: hasPayments ? 'Archivar' : 'Eliminar',
      destructive: true,
      onConfirm: () => {
        try {
          commands.debts.remove(debt.id);
          onClose();
        } catch (e) {
          setError(errorMessage(e));
        }
      },
    });
  }

  const errorText = error ? (
    <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
      {error}
    </Text>
  ) : null;

  if (editing) {
    return (
      <DetailPanel
        onClose={onClose}
        tags={<Tag label="Editando" />}
        footer={
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
        }
      >
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
        {errorText}
      </DetailPanel>
    );
  }

  return (
    <DetailPanel
      onClose={onClose}
      tags={settled ? <Tag label="Liquidada" tone="growth" /> : <Tag label="Deuda" tone="debt" />}
      footer={
        <>
          {errorText}
          {settled ? null : <Button label="Registrar un pago" size="md" onPress={onPay} />}
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button label="Editar" variant="ghost" size="md" fullWidth={false} style={{ flex: 1 }} onPress={startEdit} />
            <Button label="Eliminar" variant="danger" size="md" fullWidth={false} style={{ flex: 1 }} onPress={remove} />
          </View>
        </>
      }
    >
      <View style={{ gap: space[2] }}>
        <Text variant="h2" accessibilityRole="header">
          {debt.name}
        </Text>
        <Amount value={debt.balanceMinor} variant="amountLg" tone={settled ? 'neutral' : 'debt'} />
        <Text variant="bodySm" tone="secondary">
          Saldo pendiente
        </Text>
      </View>

      <View style={{ gap: space[2] }}>
        <ProgressBar progress={progress.percent} tone="growth" height={8} accessibilityLabel={`Progreso de ${debt.name}`} />
        <Text variant="label" tone="secondary">
          {progress.label}
        </Text>
        <Text variant="bodySm">{debtProjection(debt)}</Text>
      </View>

      <DefinitionList
        items={[
          { label: 'Tasa de interés', value: debtRateLabel(debt) },
          {
            label: 'Cuota',
            value:
              debt.installmentMinor !== null && debt.installmentMinor > 0 ? (
                <Amount value={debt.installmentMinor} variant="amountSm" />
              ) : (
                'Sin definir'
              ),
          },
          { label: 'Próximo pago', value: debtDueLabel(debt) },
          { label: 'Pagos hechos', value: String(debt.paidCount) },
        ]}
      />

      <View style={{ gap: space[2] }}>
        <Text variant="label" tone="secondary">
          Pagos registrados
        </Text>
        {payments.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            Sin pagos registrados aún
          </Text>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, overflow: 'hidden' }}>
            {payments.map((p, i) => (
              <View
                key={p.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: space[4],
                  paddingVertical: space[3] - 2,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <Text variant="bodySm" tone="secondary">
                  {shortDateLabel(toLocalDate(p.date))}
                </Text>
                <Amount value={p.amountMinor} variant="amountSm" />
              </View>
            ))}
          </View>
        )}
      </View>
    </DetailPanel>
  );
}
