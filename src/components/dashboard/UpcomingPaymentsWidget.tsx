import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { toLocalDate } from '../../domain/dates';
import type { UpcomingItem } from '../../domain/services/RecurringService';
import { shortDateLabel } from '../../lib/dateLabels';
import { upcomingThisWeek } from '../../lib/recurringWeeks';
import { upcomingNoticeText } from '../../lib/upcomingNotice';
import { routes, upcomingConfirmRoute } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { Amount, Pill, Text, Widget } from '../ui/ds';
import { MIN_TOUCH } from '../ui/ds/constants';
import { CheckIcon } from './icons';
import { LinkButton, WidgetHeader } from './parts';

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const router = useRouter();
  const { colors, radius, space } = useTheme();
  const isIncome = item.type === 'INCOME';
  const paid = item.status === 'PAID';
  const overdue = item.status === 'OVERDUE';
  const doneWord = isIncome ? 'Recibido' : 'Pagado';
  const verb = isIncome ? 'recibido' : 'pagado';
  const dueText = shortDateLabel(item.nextDueDate);
  const markable = !isIncome && !paid;
  const circleStyle = {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: paid ? colors.signalGrowth : colors.borderSubtle,
    backgroundColor: paid ? colors.signalGrowth : 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: MIN_TOUCH }}>
      {markable ? (
        <Pressable
          // Desmarcar un pago (D14) necesita la fecha de la ocurrencia confirmada, que `upcoming()` no
          // expone; hasta entonces un pendiente solo se marca (abre la hoja) y un pagado no es pulsable.
          // A los ingresos no se les ofrece marcar (decision 45): su circulo no es una accion.
          onPress={() => router.push(upcomingConfirmRoute(item))}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          accessibilityLabel={`Marcar ${item.name} como ${verb}`}
          hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
          style={circleStyle}
        />
      ) : (
        <View
          accessible={paid}
          accessibilityRole={paid ? 'checkbox' : undefined}
          accessibilityState={paid ? { checked: true, disabled: true } : undefined}
          accessibilityLabel={paid ? `${item.name} ${verb}` : undefined}
          style={{ ...circleStyle, opacity: paid ? 1 : 0.4 }}
        >
          {paid ? <CheckIcon color={colors.inkOnBrand} /> : null}
        </View>
      )}
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

/**
 * "Proximos pagos": pagos e ingresos recurrentes de la semana del mes en curso y los vencidos; el circulo
 * de un pago abre la hoja de confirmacion. El mes completo esta en "Ver todos".
 */
export function UpcomingPaymentsWidget({ items: all }: { items: UpcomingItem[] }) {
  const router = useRouter();
  const items = upcomingThisWeek(all, toLocalDate(Date.now()));
  const notice = upcomingNoticeText(items);
  return (
    <Widget gap={14}>
      <WidgetHeader
        title="Próximos pagos"
        addLabel="Agregar pago o ingreso recurrente"
        onAdd={() => router.push(routes.recurringNew())}
      />
      <View style={{ gap: 12 }}>
        {items.length === 0 ? (
          <Text variant="body" tone="secondary">
            Nada esta semana.
          </Text>
        ) : (
          items.map((item) => <UpcomingRow key={item.recurringId} item={item} />)
        )}
      </View>
      {notice === null ? null : <Text variant="label">{notice}</Text>}
      <LinkButton label="Ver todos" onPress={() => router.push(routes.recurring())} />
    </Widget>
  );
}
