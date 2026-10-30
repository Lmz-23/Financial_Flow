import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { commands, getDomain } from '../../../app-services';
import { formatCOP } from '../../../domain/money';
import { RefundAccountRequiredError } from '../../../domain/services/errors';
import type { GoalView, RefundPreview } from '../../../domain/services/GoalService';
import { useGoals } from '../../../hooks';
import { useLayoutSize } from '../../../hooks/useLayoutSize';
import { confirmAction } from '../../../lib/confirmAction';
import { goalPercent, goalProgressLabel, isGoalComplete } from '../../../lib/goalFormat';
import { errorMessage } from '../../../lib/screenErrors';
import { routes } from '../../../navigation/routes';
import { useTheme } from '../../../theme';
import { DesktopPage } from '../../desktop/DesktopPage';
import { Tag } from '../../desktop/DetailPanel';
import { Amount } from '../../ui/ds/Amount';
import { Button } from '../../ui/ds/Button';
import { Input } from '../../ui/ds/Input';
import { MoneyInput } from '../../ui/ds/MoneyInput';
import { ProgressBar } from '../../ui/ds/ProgressBar';
import { Text } from '../../ui/ds/Text';
import { Widget } from '../../ui/ds/Widget';
import { RemoveGoalSheet } from '../RemoveGoalSheet';

const MSG_EMPTY = 'Aún no tienes ninguna meta.';
const MSG_COMPLETE =
  '¡Meta cumplida! Ese dinero ya salió de tus cuentas cuando lo apartaste — esto solo registra que ya lo usaste.';
const MSG_DELETE_CONFIRM = '¿Eliminar esta meta? Lo que apartaste vuelve a tus cuentas. Esta acción no se puede deshacer.';
const MSG_CLOSE_CONFIRM = '¿Cerrar esta meta? Ya no podrás agregarle dinero. Esta acción no se puede deshacer.';
const MSG_TARGET_REQUIRED = 'Escribe el monto objetivo.';
const MSG_SAVED_REQUIRED = 'Escribe el monto ahorrado.';

/** Metas en escritorio (Design/escritorio, 2i): total ahorrado y tarjetas en cuadrícula de 3 (ancho) o 2 columnas. */
export function GoalsDesktop() {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const size = useLayoutSize();
  const goals = useGoals();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ goal: GoalView; preview: RefundPreview } | null>(null);
  const columns = size === 'wide' ? 3 : 2;
  const savedTotal = goals.reduce((sum, g) => sum + g.savedMinor, 0);

  function openRemoval(goal: GoalView) {
    try {
      setRemoving({ goal, preview: getDomain().goals.refundPreview(goal.id) });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

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
      destructive: true,
      onConfirm: () => {
        try {
          commands.goals.remove(goal.id);
        } catch (e) {
          // Un aporte de cuenta archivada apareció entre la vista previa y el borrado: pide destino.
          if (e instanceof RefundAccountRequiredError) openRemoval(goal);
          else setError(errorMessage(e));
        }
      },
    });
  }

  // Las tarjetas y la tarjeta punteada «+ Crear meta» van en filas de `columns` celdas iguales.
  const cells = [
    ...goals.map((goal) => (
      <GoalCard
        key={goal.id}
        goal={goal}
        onAddMoney={() => router.push(routes.goalContribute(goal.id))}
        onRemove={() => remove(goal)}
        onError={setError}
      />
    )),
    <Pressable
      key="new"
      accessibilityRole="button"
      accessibilityLabel="Crear meta"
      onPress={() => router.push(routes.goalNew())}
      style={{
        flex: 1,
        minHeight: 200,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderSubtle,
      }}
    >
      <Text variant="body" tone="brand">
        + Crear meta
      </Text>
    </Pressable>,
  ];
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));

  return (
    <>
      <DesktopPage
        eyebrow="Ahorrado en metas"
        heading={<Amount value={savedTotal} variant="amountLg" tone="goal" />}
        actions={<Button label="+ Crear meta" size="md" fullWidth={false} onPress={() => router.push(routes.goalNew())} />}
      >
        {goals.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            {MSG_EMPTY}
          </Text>
        ) : null}
        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View style={{ gap: space[5] }}>
          {rows.map((row, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: space[5], alignItems: 'stretch' }}>
              {row}
              {Array.from({ length: columns - row.length }, (_, k) => (
                <View key={`pad-${k}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>
      </DesktopPage>
      <RemoveGoalSheet target={removing} onClose={() => setRemoving(null)} onRefresh={(goal) => openRemoval(goal)} />
    </>
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

  /** Cerrar es irreversible: se confirma para evitar un clic accidental. */
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
      <Widget gap={space[3]} style={{ flex: 1 }}>
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
    <Widget gap={space[3]} style={{ flex: 1, padding: space[5] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.signalGoal }} />
        <Text variant="h3" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
          {goal.name}
        </Text>
        {complete ? <Tag label="Cumplida" tone="growth" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space[2] }}>
        <Amount value={goal.savedMinor} variant="amountMd" tone="goal" />
        <Text variant="bodySm" tone="secondary">
          {`de ${formatCOP(goal.targetMinor)}`}
        </Text>
      </View>
      <ProgressBar
        tone="goal"
        height={8}
        progress={goalPercent(goal.savedMinor, goal.targetMinor)}
        accessibilityLabel={`Progreso de ${goal.name}`}
      />
      <Text variant="bodySm" tone={complete ? 'growth' : 'secondary'}>
        {goalProgressLabel(goal)}
      </Text>
      {complete ? (
        <Text variant="label" tone="secondary">
          {MSG_COMPLETE}
        </Text>
      ) : null}
      <View style={{ flex: 1 }} />
      {complete ? (
        <Button label="Cerrar meta" size="md" onPress={close} />
      ) : (
        <Button label="Agregar dinero" size="md" onPress={onAddMoney} />
      )}
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label="Editar" size="md" variant="ghost" fullWidth={false} style={{ flex: 1 }} onPress={startEdit} />
        <Button label="Eliminar" size="md" variant="danger" fullWidth={false} style={{ flex: 1 }} onPress={onRemove} />
      </View>
    </Widget>
  );
}
