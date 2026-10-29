import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { commands } from '../../app-services';
import type { AccountTransferView } from '../../database/repositories/accountTransferRepository';
import type { TransactionView } from '../../database/repositories/transactionRepository';
import { localDateToEpochMs, toLocalDate, type LocalDate } from '../../domain/dates';
import { formatCOP } from '../../domain/money';
import { InsufficientFundsError } from '../../domain/services/errors';
import { useAccounts } from '../../hooks';
import { useCategoryOptions } from '../../hooks/useTransactions';
import { consumePassiveHelpFirstTime } from '../../lib/passiveIncomeHelp';
import { fullDateLabel } from '../../lib/dateLabels';
import { errorMessage, MSG_RECURRING_DATE_LOCKED } from '../../lib/screenErrors';
import {
  availableLabel,
  destinationOptions,
  fromAvailable,
  insufficientFundsMessage,
  validateTransferForm,
} from '../../lib/transferForm';
import { routes } from '../../navigation/routes';
import { fontFamilyFor, useTheme } from '../../theme';
import { PassiveIncomeHelpSheet, PassiveIncomeInfoButton } from '../help/PassiveIncomeHelp';
import { KeyboardFooter, KeyboardScreen } from '../screens/KeyboardScreen';
import { ScreenHeader } from '../screens/ScreenHeader';
import { AccountPicker } from '../ui/ds/AccountPicker';
import { Button } from '../ui/ds/Button';
import { MIN_TOUCH, SCREEN_MARGIN } from '../ui/ds/constants';
import { DatePickerField } from '../ui/ds/DatePickerField';
import { Input } from '../ui/ds/Input';
import { MoneyInput } from '../ui/ds/MoneyInput';
import { Pill } from '../ui/ds/Pill';
import { SegmentedControl } from '../ui/ds/SegmentedControl';
import { Text } from '../ui/ds/Text';

export type FormType = 'EXPENSE' | 'INCOME' | 'TRANSFER';

/** Orden y etiquetas de Gasto/Ingreso como en Nueva transaccion; Transferencia es inferida (sin tono de senal). */
const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Gasto', tone: 'debt' },
  { value: 'INCOME', label: 'Ingreso', tone: 'growth' },
  { value: 'TRANSFER', label: 'Transferencia' },
] as const;

const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';
const MSG_PICK_ACCOUNT = 'Elige una cuenta.';
const MSG_NEED_TWO_ACCOUNTS = 'Necesitas al menos dos cuentas para transferir.';

/** Que abre el formulario: uno nuevo, o la edicion de una transaccion o de una transferencia (el tipo no cambia). */
export type TransactionFormInitial =
  | { mode: 'new'; type: FormType; passive: boolean }
  | { mode: 'edit-transaction'; transaction: TransactionView }
  | { mode: 'edit-transfer'; transfer: AccountTransferView };

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 11 11" fill="none" accessibilityElementsHidden>
      <Path d="M2 5.5L4.5 8L9 3" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CategoryIcon({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 13 13" fill="none" accessibilityElementsHidden>
      <Path d="M6.5 2V11M2 6.5H11" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}


function initialType(initial: TransactionFormInitial): FormType {
  if (initial.mode === 'new') return initial.type;
  if (initial.mode === 'edit-transfer') return 'TRANSFER';
  return initial.transaction.type;
}

/**
 * Formulario de Nueva transaccion y de edicion (transacciones y transferencias). Con fecha «Hoy» al crear
 * no se envia `date` (reloj del dominio); al editar solo se envia si el usuario la cambio.
 */
export function TransactionForm({ initial }: { initial: TransactionFormInitial }) {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const editing = initial.mode !== 'new';
  const editedTx = initial.mode === 'edit-transaction' ? initial.transaction : null;
  const editedTransfer = initial.mode === 'edit-transfer' ? initial.transfer : null;

  const [type, setType] = useState<FormType>(() => initialType(initial));
  const [amount, setAmount] = useState<number | null>(() => editedTx?.amountMinor ?? editedTransfer?.amountMinor ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(editedTx?.categoryId ?? null);
  /** Categoria nueva ya confirmada: se envia como `newCategoryName` (excluyente con `categoryId`). */
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftCategory, setDraftCategory] = useState('');
  const [accountId, setAccountId] = useState<string | null>(editedTx?.accountId ?? editedTransfer?.fromAccountId ?? null);
  const [toId, setToId] = useState<string | null>(editedTransfer?.toAccountId ?? null);
  /** Nota de la transferencia o descripcion del ingreso/gasto (opcional en ambos). */
  const [note, setNote] = useState(editedTransfer?.note ?? editedTx?.description ?? '');
  const [passive, setPassive] = useState(initial.mode === 'new' ? initial.passive : (editedTx?.isPassive ?? false));
  const [today] = useState(() => toLocalDate(Date.now()));
  const [originalDate] = useState<LocalDate | null>(() => {
    const original = editedTx?.date ?? editedTransfer?.date;
    return original === undefined ? null : toLocalDate(original);
  });
  const [date, setDate] = useState<LocalDate>(originalDate ?? today);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica la operación.
  const saved = useRef(false);
  const [done, setDone] = useState(false);

  const onTogglePassive = () => {
    const next = !passive;
    setPassive(next);
    if (next) {
      void consumePassiveHelpFirstTime(AsyncStorage).then((first) => {
        if (first) setHelpOpen(true);
      });
    }
  };

  const isTransfer = type === 'TRANSFER';
  const isIncome = type === 'INCOME';
  const categories = useCategoryOptions(isTransfer ? 'EXPENSE' : type);
  const { accounts } = useAccounts();
  const options = accounts.map((a) => ({ id: a.id, name: a.name, balance: a.availableMinor }));
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const toOptions = destinationOptions(options, selectedAccountId);
  // «Hacia» se autoselecciona solo cuando hay una unica opcion; si no, el usuario elige.
  const selectedToId = toOptions.some((a) => a.id === toId) ? toId : toOptions.length === 1 ? toOptions[0].id : null;
  const fromAccount = accounts.find((a) => a.id === selectedAccountId);
  const recurringLocked = editedTx !== null && editedTx.recurringItemId !== null;
  const needsTwoAccounts = isTransfer && accounts.length < 2;

  function changeType(next: FormType) {
    setType(next);
    // Las categorias son por tipo: la seleccion y la categoria nueva no se arrastran.
    setCategoryId(null);
    setNewCategory(null);
    setAdding(false);
    setDraftCategory('');
    // La nota de una transferencia no se vuelve la descripcion de un gasto (ni al reves).
    if ((next === 'TRANSFER') !== (type === 'TRANSFER')) setNote('');
    setError(null);
  }

  function confirmNewCategory() {
    const name = draftCategory.trim();
    if (!name) return;
    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setCategoryId(existing.id);
      setNewCategory(null);
    } else {
      setCategoryId(null);
      setNewCategory(name);
    }
    setAdding(false);
    setDraftCategory('');
    setError(null);
  }

  /** Otro dia: mediodia local, lejos de los bordes del dia por cambios de huso. */
  const dateMs = () => localDateToEpochMs(date, 12);

  /** false = el formulario es invalido (el error ya se mostro); los errores del dominio se lanzan. */
  function saveTransfer(): boolean {
    const problem = validateTransferForm({ amountMinor: amount, fromAccountId: selectedAccountId, toAccountId: selectedToId });
    if (problem || !selectedAccountId || !selectedToId || amount === null) {
      setError(problem);
      return false;
    }
    if (editedTransfer) {
      commands.transfers.update(editedTransfer.id, {
        fromAccountId: selectedAccountId,
        toAccountId: selectedToId,
        amountMinor: amount,
        note: note.trim(),
        ...(date !== originalDate ? { date: dateMs() } : {}),
      });
    } else {
      commands.transfers.create({
        fromAccountId: selectedAccountId,
        toAccountId: selectedToId,
        amountMinor: amount,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(date !== today ? { date: dateMs() } : {}),
      });
    }
    return true;
  }

  function saveTransaction(): boolean {
    if (!selectedAccountId) {
      setError(MSG_PICK_ACCOUNT);
      return false;
    }
    const category = newCategory !== null ? { newCategoryName: newCategory } : { categoryId };
    if (editedTx) {
      commands.transactions.update(editedTx.id, {
        amountMinor: amount ?? 0,
        accountId: selectedAccountId,
        ...category,
        description: note.trim(),
        ...(isIncome ? { isPassive: passive } : {}),
        ...(date !== originalDate ? { date: dateMs() } : {}),
      });
    } else {
      commands.transactions.create({
        type: isIncome ? 'INCOME' : 'EXPENSE',
        accountId: selectedAccountId,
        amountMinor: amount ?? 0,
        ...category,
        ...(note.trim() ? { description: note.trim() } : {}),
        isPassive: isIncome && passive,
        ...(date !== today ? { date: dateMs() } : {}),
      });
    }
    return true;
  }

  function save() {
    if (saved.current) return;
    try {
      if (!(isTransfer ? saveTransfer() : saveTransaction())) return;
    } catch (e) {
      const named =
        e instanceof InsufficientFundsError
          ? insufficientFundsMessage(e, selectedAccountId, accounts.find((a) => a.id === e.accountId)?.name, formatCOP)
          : null;
      setError(named ?? errorMessage(e));
      return;
    }
    saved.current = true;
    setDone(true);
    router.back();
  }

  const title = editedTransfer ? 'Editar transferencia' : editedTx ? 'Editar transacción' : 'Nueva transacción';

  return (
    <KeyboardScreen>
      <ScreenHeader title={title} icon="close" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        {editing ? null : (
          <SegmentedControl
            options={TYPE_OPTIONS}
            value={type}
            onChange={changeType}
            accessibilityLabel="Tipo de transacción"
          />
        )}
        <MoneyInput
          variant="hero"
          tone={isTransfer ? 'primary' : isIncome ? 'growth' : 'debt'}
          value={amount}
          onChangeValue={(v) => {
            setAmount(v);
            setError(null);
          }}
          accessibilityLabel="Monto"
        />

        {isTransfer ? null : (
        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Categoría
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {categories.map((c) => (
              <Pill
                key={c.id}
                label={c.name}
                selected={newCategory === null && categoryId === c.id}
                onPress={() => {
                  setCategoryId(c.id);
                  setNewCategory(null);
                }}
              />
            ))}
            {newCategory !== null ? <Pill label={newCategory} selected onPress={() => setAdding(true)} /> : null}
            <Pill
              label="Nueva categoría"
              dashed
              leading={<CategoryIcon color={colors.inkSecondary} />}
              onPress={() => setAdding(true)}
            />
          </View>
          {adding ? (
            <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[1] }}>
              <Input
                containerStyle={{ flex: 1 }}
                value={draftCategory}
                onChangeText={setDraftCategory}
                placeholder="Nombre de la categoría"
                accessibilityLabel="Nombre de la categoría"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmNewCategory}
              />
              <Pressable
                onPress={confirmNewCategory}
                accessibilityRole="button"
                accessibilityLabel="Agregar categoría"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.sm,
                  backgroundColor: colors.brandPrimary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckIcon color={colors.inkOnBrand} />
              </Pressable>
            </View>
          ) : null}
        </View>
        )}

        {recurringLocked ? (
          <View style={{ gap: space[2] }}>
            <Text variant="label">Fecha</Text>
            <View
              style={{
                height: 48,
                paddingHorizontal: 14,
                justifyContent: 'center',
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Text variant="body" tone="secondary">
                {fullDateLabel(date)}
              </Text>
            </View>
            <Text variant="label" tone="secondary">
              {MSG_RECURRING_DATE_LOCKED}
            </Text>
          </View>
        ) : (
          <DatePickerField
            label="Fecha"
            value={date}
            onChange={(d) => setDate(d ?? today)}
            maximumDate={today}
          />
        )}

        {isTransfer ? (
          <>
            {needsTwoAccounts ? (
              <View style={{ gap: space[2] }}>
                <Text variant="bodySm" accessibilityLiveRegion="polite">
                  {MSG_NEED_TWO_ACCOUNTS}
                </Text>
                <Button label="Agregar cuenta" variant="ghost" size="md" onPress={() => router.push(routes.accountNew())} />
              </View>
            ) : (
              <>
                <View style={{ gap: space[2] }}>
                  <AccountPicker
                    label="Desde"
                    accounts={options}
                    selectedId={selectedAccountId}
                    onSelect={(id) => {
                      setAccountId(id);
                      setError(null);
                    }}
                  />
                  {fromAccount ? (
                    <Text variant="label" tone="secondary">
                      {availableLabel(fromAvailable(fromAccount.availableMinor, fromAccount.id, editedTransfer ?? undefined))}
                    </Text>
                  ) : null}
                </View>
                <AccountPicker
                  label="Hacia"
                  accounts={toOptions}
                  selectedId={selectedToId}
                  onSelect={(id) => {
                    setToId(id);
                    setError(null);
                  }}
                />
                <Input
                  label="Nota (opcional)"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Para qué es"
                  autoCapitalize="sentences"
                  returnKeyType="done"
                />
              </>
            )}
          </>
        ) : (
          <>
            <AccountPicker
              label="Cuenta"
              accounts={options}
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
            <Input
              label="Descripción (opcional)"
              value={note}
              onChangeText={setNote}
              placeholder={isIncome ? 'Ej.: prima de diciembre' : 'Ej.: suscripción de Amazon'}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          </>
        )}

        {isIncome ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            <Pressable
              onPress={onTogglePassive}
              accessibilityRole="switch"
              accessibilityState={{ checked: passive }}
              accessibilityLabel="Marcar como ingreso pasivo"
              accessibilityHint="Esto alimenta tu Índice de Flujo de Caja."
              style={({ pressed }) => ({
                flex: 1,
                minHeight: MIN_TOUCH,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space[3],
                paddingVertical: 14,
                paddingHorizontal: space[4],
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
                backgroundColor: colors.surfaceCard,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodySm" style={{ fontFamily: fontFamilyFor('sans', 500) }}>
                  Marcar como ingreso pasivo
                </Text>
                <Text variant="label" tone="secondary">
                  Esto alimenta tu Índice de Flujo de Caja.
                </Text>
              </View>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: radius.full,
                  borderWidth: 1.5,
                  borderColor: passive ? colors.signalGrowth : colors.borderSubtle,
                  backgroundColor: passive ? colors.signalGrowth : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {passive ? <CheckIcon color={colors.inkOnBrand} /> : null}
              </View>
            </Pressable>
            <PassiveIncomeInfoButton onPress={() => setHelpOpen(true)} />
          </View>
        ) : null}
        <PassiveIncomeHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />

        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <KeyboardFooter>
        <Button label="Guardar" onPress={save} disabled={done || needsTwoAccounts} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
