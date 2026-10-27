import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { commands } from '../../../src/app-services';
import { PassiveIncomeHelpSheet, PassiveIncomeInfoButton } from '../../../src/components/help/PassiveIncomeHelp';
import { KeyboardFooter, KeyboardScreen } from '../../../src/components/screens/KeyboardScreen';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { AccountPicker } from '../../../src/components/ui/ds/AccountPicker';
import { Button } from '../../../src/components/ui/ds/Button';
import { MIN_TOUCH, SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Input } from '../../../src/components/ui/ds/Input';
import { MoneyInput } from '../../../src/components/ui/ds/MoneyInput';
import { Pill } from '../../../src/components/ui/ds/Pill';
import { SegmentedControl } from '../../../src/components/ui/ds/SegmentedControl';
import { Text } from '../../../src/components/ui/ds/Text';
import { useAccounts } from '../../../src/hooks';
import { useCategoryOptions } from '../../../src/hooks/useTransactions';
import { consumePassiveHelpFirstTime } from '../../../src/lib/passiveIncomeHelp';
import { errorMessage } from '../../../src/lib/screenErrors';
import { routes } from '../../../src/navigation/routes';
import { fontFamilyFor, useTheme } from '../../../src/theme';

type TxType = 'EXPENSE' | 'INCOME';

const TYPE_OPTIONS = [
  { value: 'EXPENSE', label: 'Gasto', tone: 'debt' },
  { value: 'INCOME', label: 'Ingreso', tone: 'growth' },
] as const;

const MSG_NO_ACCOUNTS = 'Primero agrega una cuenta.';
const MSG_PICK_ACCOUNT = 'Elige una cuenta.';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Params de §6 fila 13: `type` (INCOME | EXPENSE) y `passive` (1 | true; implica ingreso). */
function parseParams(params: { type?: string | string[]; passive?: string | string[] }): { type: TxType; passive: boolean } {
  const passive = ['1', 'true'].includes(firstParam(params.passive)?.toLowerCase() ?? '');
  const type = firstParam(params.type)?.toUpperCase() === 'INCOME' || passive ? 'INCOME' : 'EXPENSE';
  return { type, passive };
}

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

/** Nueva transaccion (Dashboard.dc.html, onAgregarTx). La fecha queda en «Hoy»: no se envia `date`. */
export default function NewTransactionScreen() {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const initial = parseParams(useLocalSearchParams<{ type?: string; passive?: string }>());

  const [type, setType] = useState<TxType>(initial.type);
  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  /** Categoria nueva ya confirmada: se envia como `newCategoryName` (excluyente con `categoryId`). */
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftCategory, setDraftCategory] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [passive, setPassive] = useState(initial.passive);
  const [helpOpen, setHelpOpen] = useState(false);
  const onTogglePassive = () => {
    const next = !passive;
    setPassive(next);
    if (next) {
      void consumePassiveHelpFirstTime(AsyncStorage).then((first) => {
        if (first) setHelpOpen(true);
      });
    }
  };
  const [error, setError] = useState<string | null>(null);
  // Guarda síncrona: un segundo toque antes de que se cierre la pantalla no duplica la transacción.
  const saved = useRef(false);
  const [done, setDone] = useState(false);

  const categories = useCategoryOptions(type);
  const { accounts } = useAccounts();
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const isIncome = type === 'INCOME';

  function changeType(next: TxType) {
    setType(next);
    // Las categorias son por tipo: la seleccion y la categoria nueva no se arrastran.
    setCategoryId(null);
    setNewCategory(null);
    setAdding(false);
    setDraftCategory('');
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

  function save() {
    if (saved.current) return;
    if (!selectedAccountId) {
      setError(MSG_PICK_ACCOUNT);
      return;
    }
    try {
      commands.transactions.create({
        type,
        accountId: selectedAccountId,
        amountMinor: amount ?? 0,
        ...(newCategory !== null ? { newCategoryName: newCategory } : { categoryId }),
        isPassive: isIncome && passive,
      });
      saved.current = true;
      setDone(true);
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <KeyboardScreen>
      <ScreenHeader title="Nueva transacción" icon="close" onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: SCREEN_MARGIN, gap: space[5] }}
      >
        <SegmentedControl
          options={TYPE_OPTIONS}
          value={type}
          onChange={changeType}
          accessibilityLabel="Tipo de transacción"
        />
        <MoneyInput
          variant="hero"
          tone={isIncome ? 'growth' : 'debt'}
          value={amount}
          onChangeValue={(v) => {
            setAmount(v);
            setError(null);
          }}
          accessibilityLabel="Monto"
        />

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

        <AccountPicker
          label="Cuenta"
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

        <View style={{ gap: space[2] }}>
          <Text variant="label" tone="secondary">
            Fecha
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              height: MIN_TOUCH,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.surfaceCard,
            }}
          >
            <Text variant="bodySm">Hoy</Text>
          </View>
        </View>

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
        <Button label="Guardar" onPress={save} disabled={done} />
      </KeyboardFooter>
    </KeyboardScreen>
  );
}
