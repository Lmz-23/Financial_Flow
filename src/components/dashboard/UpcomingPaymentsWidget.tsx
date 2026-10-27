import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { UpcomingItem } from '../../domain/services/RecurringService';
import { shortDateLabel } from '../../lib/dateLabels';
import { upcomingNoticeText } from '../../lib/upcomingNotice';
import { routes, upcomingConfirmRoute } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { Amount, Pill, Text, Widget } from '../ui/ds';
import { MIN_TOUCH } from '../ui/ds/constants';
import { CheckIcon } from './icons';
import { WidgetHeader } from './parts';

/** Hojas de confirmacion de pago aun sin pantalla (F5b-3 / F5b-5). Quitar la constante al crearlas. */
const COMING_SOON_CONFIRM = true;

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const router = useRouter();
  const { colors, radius, space } = useTheme();
  const isIncome = item.type === 'INCOME';
  const paid = item.status === 'PAID';
  const overdue = item.status === 'OVERDUE';
  const doneWord = isIncome ? 'Recibido' : 'Pagado';
  const verb = isIncome ? 'recibido' : 'pagado';
  const dueText = shortDateLabel(item.nextDueDate);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: MIN_TOUCH }}>
      <Pressable
        // Desmarcar un pago (D14) necesita la fecha de la ocurrencia confirmada, que `upcoming()` no
        // expone; hasta entonces un pendiente solo se marca (abre la hoja) y un pagado no es pulsable.
        // Mientras las hojas de confirmacion (recurringConfirm / debtInstallmentPay) no existan, el circulo queda apagado (F5b).
        disabled={paid || COMING_SOON_CONFIRM}
        onPress={() => router.push(upcomingConfirmRoute(item))}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: paid, disabled: paid || COMING_SOON_CONFIRM }}
        accessibilityLabel={
          paid
            ? `${item.name} ${verb}`
            : COMING_SOON_CONFIRM
              ? `Marcar ${item.name} como ${verb}, Próximamente`
              : `Marcar ${item.name} como ${verb}`
        }
        hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.full,
          borderWidth: 1.5,
          borderColor: paid ? colors.signalGrowth : colors.borderSubtle,
          backgroundColor: paid ? colors.signalGrowth : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: COMING_SOON_CONFIRM && !paid ? 0.4 : 1,
        }}
      >
        {paid ? <CheckIcon color={colors.inkOnBrand} /> : null}
      </Pressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
        <Text
          variant="body"
          numberOfLines={1}
          style={{ flexShrink: 1, textDecorationLine: paid ? 'line-through' : 'none' }}
          tone={paid ? 'secondary' : 'primary'}
        >
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          {paid ? (
            <Text variant="label" tone="growth">
              {doneWord}
            </Text>
          ) : (
            <Pill
              label={overdue ? 'Vencido' : dueText}
              tone={overdue ? 'debt' : 'primary'}
              accessibilityLabel={overdue ? `Vencido, ${dueText}` : `Vence ${dueText}`}
            />
          )}
          {item.amountMinor === null ? (
            <Text variant="amountSm" tone="secondary">
              Sin definir
            </Text>
          ) : (
            <Amount
              value={item.amountMinor}
              variant="amountSm"
              tone={isIncome || paid ? 'growth' : 'neutral'}
              showSign={isIncome}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/** "Proximos pagos": pagos e ingresos recurrentes con fecha; el circulo abre la hoja de confirmacion. */
export function UpcomingPaymentsWidget({ items }: { items: UpcomingItem[] }) {
  const router = useRouter();
  const notice = upcomingNoticeText(items);
  return (
    <Widget gap={14}>
      <WidgetHeader
        title="Próximos pagos"
        addLabel="Agregar pago o ingreso recurrente"
        addComingSoon
        onAdd={() => router.push(routes.recurringNew())}
      />
      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <UpcomingRow key={item.recurringId} item={item} />
        ))}
      </View>
      {notice === null ? null : <Text variant="label">{notice}</Text>}
    </Widget>
  );
}
