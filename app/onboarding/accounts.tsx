import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AccountForm } from '../../src/components/onboarding/AccountForm';
import { PlusIcon } from '../../src/components/onboarding/icons';
import { OnboardingScaffold } from '../../src/components/onboarding/OnboardingScaffold';
import { Button } from '../../src/components/ui/ds/Button';
import { MIN_TOUCH } from '../../src/components/ui/ds/constants';
import { Pill } from '../../src/components/ui/ds/Pill';
import { Text } from '../../src/components/ui/ds/Text';
import { formatCOP } from '../../src/domain/money';
import { useIsDesktop } from '../../src/hooks/useLayoutSize';
import {
  accountTypeLabel,
  MSG_NO_ACCOUNTS,
  validateAccountsStep,
  type AccountFormValues,
  type DraftAccount,
} from '../../src/lib/onboardingDraft';
import { routes } from '../../src/navigation/routes';
import { useOnboardingDraft } from '../../src/store/useOnboardingDraft';
import { useTheme } from '../../src/theme';

/** Botón principal en escritorio: ~220 px, no a todo el ancho. */
const DESKTOP_BUTTON = { width: 220 } as const;

type FormState = { mode: 'new'; initial: AccountFormValues } | { mode: 'edit'; account: DraftAccount };

/** Chips de acceso rápido (Step1): abren el formulario con nombre y tipo prellenados (A4). */
const QUICK_ACCESS: readonly AccountFormValues[] = [
  { name: 'Cuenta de ahorros', type: 'SAVINGS', openingMinor: null },
  { name: 'Cuenta corriente', type: 'CHECKING', openingMinor: null },
  { name: 'Billetera digital', type: 'DIGITAL_WALLET', openingMinor: null },
];

const BLANK_ACCOUNT: AccountFormValues = { name: '', type: 'CASH', openingMinor: null };

function accountSubtitle(account: DraftAccount): string {
  return account.type === 'CASH' ? 'Cuenta en mano' : accountTypeLabel(account.type);
}

/** Paso 1 del onboarding: ¿Dónde tienes tu dinero? */
export default function OnboardingAccountsScreen() {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const desktop = useIsDesktop();
  const accounts = useOnboardingDraft((s) => s.accounts);
  const addAccount = useOnboardingDraft((s) => s.addAccount);
  const updateAccount = useOnboardingDraft((s) => s.updateAccount);
  const [form, setForm] = useState<FormState | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const closeForm = useCallback(() => setForm(null), []);

  if (form) {
    const editing = form.mode === 'edit' ? form.account : null;
    return (
      <AccountForm
        title={editing ? editing.name : 'Agregar cuenta'}
        initial={
          editing
            ? { name: editing.name, type: editing.type, openingMinor: editing.openingMinor }
            : form.mode === 'new'
              ? form.initial
              : BLANK_ACCOUNT
        }
        onCancel={closeForm}
        onSubmit={(values) => {
          const result = editing ? updateAccount(editing.key, values) : addAccount(values);
          if (!result.ok) return result.error;
          setStepError(null);
          setForm(null);
          return null;
        }}
      />
    );
  }

  function next() {
    if (validateAccountsStep(accounts)) {
      setStepError(MSG_NO_ACCOUNTS);
      return;
    }
    router.push(routes.onboardingFlow());
  }

  return (
    <OnboardingScaffold step={1} footer={<Button label="Continuar" onPress={next} fullWidth={!desktop} style={desktop ? DESKTOP_BUTTON : undefined} />}>
      <View style={{ gap: space[2] }}>
        <Text variant="h1" accessibilityRole="header">
          ¿Dónde tienes tu dinero?
        </Text>
        <Text variant="bodySm" tone="secondary">
          Agrega al menos una cuenta o tu efectivo para empezar a ver tu panorama.
        </Text>
      </View>

      <View style={{ gap: space[3] }}>
        {accounts.map((account) => (
          <Pressable
            key={account.key}
            onPress={() => setForm({ mode: 'edit', account })}
            accessibilityRole="button"
            accessibilityLabel={`${account.name}. ${accountSubtitle(account)}. ${formatCOP(account.openingMinor)}`}
            style={({ pressed }) => ({
              minHeight: MIN_TOUCH,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space[3],
              padding: space[4],
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: colors.surfaceCard,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body">
                {account.name}
              </Text>
              <Text variant="label" tone="secondary">
                {accountSubtitle(account)}
              </Text>
            </View>
            <Text variant="amountMd">{formatCOP(account.openingMinor)}</Text>
          </Pressable>
        ))}

        {stepError ? (
          <Text variant="bodySm" tone="debt" accessibilityLiveRegion="polite" accessibilityRole="alert">
            {stepError}
          </Text>
        ) : null}

        <Pressable
          onPress={() => setForm({ mode: 'new', initial: BLANK_ACCOUNT })}
          accessibilityRole="button"
          accessibilityLabel="Agregar otra cuenta"
          style={({ pressed }) => ({
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[2],
            borderRadius: radius.sm,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.borderSubtle,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <PlusIcon color={colors.inkSecondary} />
          <Text variant="body" tone="secondary">
            Agregar otra cuenta
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <Text variant="label" tone="secondary">
          Accesos rápidos
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {QUICK_ACCESS.map((chip) => (
            <Pill key={chip.type} label={chip.name} onPress={() => setForm({ mode: 'new', initial: chip })} />
          ))}
        </View>
      </View>
    </OnboardingScaffold>
  );
}
