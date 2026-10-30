import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commands, getDomain } from '../../app-services';
import type { AccountView } from '../../domain/services/AccountService';
import type { Activity } from '../../hooks/useActivity';
import { activityRow } from '../../lib/activityView';
import { confirmAction } from '../../lib/confirmAction';
import { accountTypeLabel } from '../../lib/onboardingDraft';
import { errorMessage } from '../../lib/screenErrors';
import { useTheme } from '../../theme';
import { DetailPanel, Tag } from '../desktop/DetailPanel';
import { ActivityListRow } from '../transactions/ActivityListRow';
import { Amount } from '../ui/ds/Amount';
import { Button } from '../ui/ds/Button';
import { SCREEN_MARGIN } from '../ui/ds/constants';
import { Input } from '../ui/ds/Input';
import { MoneyInput } from '../ui/ds/MoneyInput';
import { Text } from '../ui/ds/Text';
import { Widget } from '../ui/ds/Widget';

/** Texto aprobado por el usuario para la cuenta con movimientos (se archiva en vez de borrar). */
const MSG_ARCHIVE_CONFIRM = 'Esta cuenta tiene movimientos, así que la archivaremos en lugar de borrarla. Tu historial se conserva.';
const MSG_DELETE_CONFIRM = '¿Eliminar esta cuenta? Esta acción no se puede deshacer.';
const MSG_BALANCE_REQUIRED = 'Escribe el saldo de la cuenta.';
/** Aprobados por el usuario (2026-10-26). */
const MSG_ARCHIVED = 'Cuenta archivada';
const MSG_SAVED = 'Guardado';
/** El aviso de guardado desaparece solo; no bloquea la pantalla. */
const SAVED_VISIBLE_MS = 2000;

export interface AccountDetailProps {
  account: AccountView;
  movements: Activity;
  /** Se llama tras eliminar/archivar: el celular vuelve atrás; el panel de escritorio se cierra. */
  onRemoved: () => void;
  /** 'screen': pantalla del celular (con scroll); 'panel': panel lateral de escritorio. */
  layout: 'screen' | 'panel';
  /** Solo en 'panel'. */
  onClose?: () => void;
}

/** Detalle de cuenta (Dashboard.dc.html, onCuentaDetalle): saldo, edición, movimientos y eliminar. */
export function AccountDetail({ account, movements, onRemoved, layout, onClose }: AccountDetailProps) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const id = account.id;
  const archived = account.archivedAt !== null;
  const initialName = account.name;
  const balanceMinor = account.availableMinor;
  // Borradores: undefined = sin tocar, y el campo muestra el valor vivo de la cuenta. Solo se envía
  // lo que el usuario tocó; así un saldo que cambió por fuera no se pisa con un ajuste MANUAL viejo.
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [balanceDraft, setBalanceDraft] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(0);
  const name = nameDraft ?? initialName;

  useEffect(() => {
    if (savedNotice === 0) return undefined;
    const timer = setTimeout(() => setSavedNotice(0), SAVED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [savedNotice]);
  const balance = balanceDraft === undefined ? balanceMinor : balanceDraft;

  function saveChanges() {
    if (balanceDraft === null) {
      setError(MSG_BALANCE_REQUIRED);
      return;
    }
    if (nameDraft === undefined && balanceDraft === undefined) return;
    try {
      commands.accounts.update(id, {
        ...(nameDraft !== undefined ? { name: nameDraft } : {}),
        ...(balanceDraft !== undefined ? { balanceMinor: balanceDraft } : {}),
      });
      setNameDraft(undefined);
      setBalanceDraft(undefined);
      setError(null);
      setSavedNotice((n) => n + 1);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function unarchive() {
    try {
      commands.accounts.unarchive(id);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function confirmRemoval() {
    let outcome;
    try {
      outcome = getDomain().accounts.removalOutcome(id);
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    const archiving = outcome === 'ARCHIVED';
    confirmAction({
      title: 'Eliminar cuenta',
      message: archiving ? MSG_ARCHIVE_CONFIRM : MSG_DELETE_CONFIRM,
      confirmLabel: archiving ? 'Archivar' : 'Eliminar',
      onConfirm: () => {
        try {
          commands.accounts.remove(id);
          onRemoved();
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

  const balanceBlock = (
    <View style={{ gap: 2 }}>
      <Amount value={balanceMinor} variant="amountLg" />
      <Text variant="bodySm" tone="secondary">
        Saldo actual
      </Text>
    </View>
  );

  const editBlock = archived ? (
    <Widget gap={space[4]}>
      <Text variant="h3" accessibilityRole="header">
        {MSG_ARCHIVED}
      </Text>
      {errorText}
      <Button label="Desarchivar" size="md" onPress={unarchive} />
    </Widget>
  ) : (
    <Widget gap={space[4]}>
      <Text variant="h3" accessibilityRole="header">
        Editar cuenta
      </Text>
      <Input
        label="Nombre"
        value={name}
        onChangeText={(t) => {
          setNameDraft(t);
          setError(null);
        }}
        autoCapitalize="sentences"
        returnKeyType="done"
      />
      <MoneyInput
        label="Saldo"
        value={balance}
        onChangeValue={(v) => {
          setBalanceDraft(v);
          setError(null);
        }}
      />
      {errorText}
      {savedNotice > 0 ? (
        <Text variant="bodySm" tone="growth" accessibilityLiveRegion="polite">
          {MSG_SAVED}
        </Text>
      ) : null}
      <Button label="Guardar cambios" size="md" onPress={saveChanges} />
    </Widget>
  );

  const movementsBlock = (
    <View style={{ gap: 10 }}>
      <Text variant="label" tone="secondary">
        Movimientos de esta cuenta
      </Text>
      {movements.items.length === 0 ? (
        <Text variant="bodySm" tone="secondary">
          Todavía no hay movimientos en esta cuenta.
        </Text>
      ) : (
        movements.items.map((item) => {
          const row = activityRow(item, movements.now);
          return <ActivityListRow key={row.key} row={row} />;
        })
      )}
    </View>
  );

  const deleteButton = archived ? null : <Button label="Eliminar cuenta" variant="danger" size="md" onPress={confirmRemoval} />;

  if (layout === 'panel') {
    return (
      <DetailPanel
        onClose={onClose ?? (() => undefined)}
        tags={
          <>
            <Tag label={accountTypeLabel(account.type)} />
            {archived ? <Tag label="Archivada" /> : null}
          </>
        }
        footer={deleteButton}
      >
        {balanceBlock}
        {editBlock}
        {movementsBlock}
      </DetailPanel>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5], paddingBottom: space[6] + insets.bottom }}
    >
      {balanceBlock}
      {editBlock}
      {movementsBlock}
      {deleteButton}
    </ScrollView>
  );
}
