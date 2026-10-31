import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commands, getDomain } from '../../../src/app-services';
import { GoalsDesktop } from '../../../src/components/goals/desktop/GoalsDesktop';
import { RemoveGoalSheet } from '../../../src/components/goals/RemoveGoalSheet';
import { DashedAddButton } from '../../../src/components/dashboard/parts';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { Button } from '../../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Input } from '../../../src/components/ui/ds/Input';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { ProgressBar } from '../../../src/components/ui/ds/ProgressBar';
import { Text } from '../../../src/components/ui/ds/Text';
import { Widget } from '../../../src/components/ui/ds/Widget';
import { formatCOP } from '../../../src/domain/money';
import { RefundAccountRequiredError } from '../../../src/domain/services/errors';
import type { GoalView, RefundPreview } from '../../../src/domain/services/GoalService';
import { useGoals } from '../../../src/hooks';
import { useIsDesktop } from '../../../src/hooks/useLayoutSize';
import { goalPercent, goalProgressLabel, isGoalComplete } from '../../../src/lib/goalFormat';
import { errorMessage } from '../../../src/lib/screenErrors';
import { routes } from '../../../src/navigation/routes';
import { fontFamilyFor, useTheme } from '../../../src/theme';
import { confirmAction } from '../../../src/lib/confirmAction';

/** Textos del diseño (Dashboard.dc.html, onMetas). */
const MSG_EMPTY = 'Aún no tienes ninguna meta.';
const MSG_COMPLETE =
  '¡Meta cumplida! Ese dinero ya salió de tus cuentas cuando lo apartaste — esto solo registra que ya lo usaste.';
/** Inferidos (no están en el diseño ni en docs). */
const MSG_DELETE_CONFIRM = '¿Eliminar esta meta? Lo que apartaste vuelve a tus cuentas. Esta acción no se puede deshacer.';
const MSG_CLOSE_CONFIRM = '¿Cerrar esta meta? Ya no podrás agregarle dinero. Esta acción no se puede deshacer.';
const MSG_TARGET_REQUIRED = 'Escribe el monto objetivo.';
const MSG_SAVED_REQUIRED = 'Escribe el monto ahorrado.';

/** Metas de ahorro: en escritorio (web ≥ 600 px) cuadrícula de tarjetas; en el celular, la lista. */
export default function GoalsScreen() {
  const desktop = useIsDesktop();
  return desktop ? <GoalsDesktop /> : <GoalsMobile />;
}

/** Metas de ahorro (Dashboard.dc.html, onMetas): progreso y ETA, agregar dinero, cerrar, editar y eliminar. */
function GoalsMobile() {
  const { space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goals = useGoals();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ goal: GoalView; preview: RefundPreview } | null>(null);

  function remove(goal: GoalView) {
    let preview: RefundPreview;
    try {
      preview = getDomain().goals.refundPreview(goal.id);
    } catch (e) {
      setError(errorMessage(e));
      return;
    }
    setError(null);
    if (preview.requiresDestinationMinor > 0) {
      setRemoving({ goal, preview });
      return;
    }
    confirmAction({
      title: 'Eliminar meta',
      message: MSG_DELETE_CONFIRM,
      confirmLabel: 'Eliminar',
      onConfirm: () => {
        try {
          commands.goals.remove(goal.id);
        } catch (e) {
          // Un aporte de cuenta archivada apareció entre la vista previa y el borrado: pide destino.
          if (e instanceof RefundAccountRequiredError) {
            openRemoval(goal);
          } else {
            setError(errorMessage(e));
          }
        }
      },
    });
  }

  function openRemoval(goal: GoalView) {
    try {
      setRemoving({ goal, preview: getDomain().goals.refundPreview(goal.id) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Metas de ahorro" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[4], paddingBottom: space[6] + insets.bottom }}
      >
        {goals.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_EMPTY}
          </Text>
        ) : null}
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onAddMoney={() => router.push(routes.goalContribute(goal.id))}
            onRemove={() => remove(goal)}
            onError={setError}
          />
        ))}
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <DashedAddButton label="Crear meta" onPress={() => router.push(routes.goalNew())} />
      </ScrollView>
      <RemoveGoalSheet
        target={removing}
        onClose={() => setRemoving(null)}
        onRefresh={(goal) => openRemoval(goal)}
      />
    </View>
  );
}

function GoalCard({
  goal,
  onAddMoney,
  onRemove,
  onError,
}: {
  goal: GoalView;
  onAddMoney: () => void;
  onRemove: () => void;
  onError: (message: string | null) => void;
}) {
  const { colors, radius, space } = useTheme();
  const [editing, setEditing] = useState(false);
  // Borradores: undefined = sin tocar (el campo muestra el valor vivo); solo se envía lo que se tocó.
  const [nameDraft, setNameDraft] = useState<string | undefined>(undefined);
  const [targetDraft, setTargetDraft] = useState<number | null | undefined>(undefined);
  const [savedDraft, setSavedDraft] = useState<number | null | undefined>(undefined);
  const [editError, setEditError] = useState<string | null>(null);
  const complete = isGoalComplete(goal);

  function startEdit() {
    setNameDraft(undefined);
    setTargetDraft(undefined);
    setSavedDraft(undefined);
    setEditError(null);
    onError(null);
    setEditing(true);
  }

  function saveEdit() {
    if (targetDraft === null) {
      setEditError(MSG_TARGET_REQUIRED);
      return;
    }
    if (savedDraft === null) {
      setEditError(MSG_SAVED_REQUIRED);
      return;
    }
    try {
      commands.goals.update(goal.id, {
        ...(nameDraft !== undefined ? { name: nameDraft } : {}),
        ...(targetDraft !== undefined ? { targetMinor: targetDraft } : {}),
        ...(savedDraft !== undefined ? { savedMinor: savedDraft } : {}),
      });
      setEditing(false);
    } catch (e) {
      setEditError(errorMessage(e));
    }
  }

  /** Cerrar es irreversible: se confirma para evitar un toque accidental. */
  function close() {
    confirmAction({
      title: 'Cerrar meta',
      message: MSG_CLOSE_CONFIRM,
      confirmLabel: 'Cerrar meta',
      onConfirm: () => {
        try {
          commands.goals.close(goal.id);
          onError(null);
        } catch (e) {
          onError(errorMessage(e));
        }
      },
    });
  }

  if (editing) {
    return (
      <Widget gap={space[3]}>
        <Input
          label="Nombre de la meta"
          value={nameDraft ?? goal.name}
          onChangeText={(t) => {
            setNameDraft(t);
            setEditError(null);
          }}
          autoCapitalize="sentences"
          returnKeyType="done"
        />
        <MoneyInput
          label="Monto objetivo"
          value={targetDraft === undefined ? goal.targetMinor : targetDraft}
          onChangeValue={(v) => {
            setTargetDraft(v);
            setEditError(null);
          }}
        />
        <MoneyInput
          label="Monto ahorrado"
          value={savedDraft === undefined ? goal.savedMinor : savedDraft}
          onChangeValue={(v) => {
            setSavedDraft(v);
            setEditError(null);
          }}
        />
        {editError ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {editError}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button label="Guardar" size="md" fullWidth={false} style={{ flex: 1 }} onPress={saveEdit} />
          <Button
            label="Cancelar"
            size="md"
            variant="ghost"
            fullWidth={false}
            style={{ flex: 1 }}
            onPress={() => setEditing(false)}
          />
        </View>
      </Widget>
    );
  }

  return (
    <Widget gap={space[3]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.signalGoal }} />
        <Text variant="h3" accessibilityRole="header" style={{ flex: 1 }}>
          {goal.name}
        </Text>
      </View>
      <ProgressBar
        tone="growth"
        height={8}
        progress={goalPercent(goal.savedMinor, goal.targetMinor)}
        accessibilityLabel={`Progreso de ${goal.name}`}
      />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Amount value={goal.savedMinor} variant="amountMd" />
        <Text variant="bodySm" tone="secondary">
          {`de ${formatCOP(goal.targetMinor)}`}
        </Text>
      </View>
      <Text variant="bodySm" tone={complete ? 'growth' : 'secondary'}>
        {goalProgressLabel(goal)}
      </Text>
      {complete ? (
        <View style={{ gap: space[2] }}>
          <Text variant="bodySm" tone="growth" style={{ fontFamily: fontFamilyFor('sans', 600) }}>
            {MSG_COMPLETE}
          </Text>
          <Button label="Cerrar meta" size="md" onPress={close} />
        </View>
      ) : (
        <Button label="Agregar dinero" size="md" onPress={onAddMoney} />
      )}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label="Editar" size="md" variant="ghost" fullWidth={false} style={{ flex: 1 }} onPress={startEdit} />
        <Button
          label="Eliminar"
          size="md"
          variant="danger"
          fullWidth={false}
          style={{ flex: 1 }}
          onPress={onRemove}
        />
      </View>
    </Widget>
  );
}
