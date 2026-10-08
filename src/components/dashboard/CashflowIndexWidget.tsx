import { useRouter } from 'expo-router';

import { commands } from '../../app-services';
import { describeCashflowIndex, formatCashflowIndex, type CashflowIndex } from '../../domain/rules/statement';
import { routes } from '../../navigation/routes';
import { Text, Widget } from '../ui/ds';
import { LinkButton, WidgetHeader } from './parts';

/**
 * "Indice de Flujo de Caja" (widget hero). Textos del dominio (`formatCashflowIndex`,
 * `describeCashflowIndex`): incluyen las decisiones del usuario del 2026-10-07 (libertad financiera
 * con "100%" literal y mes sin gastos).
 */
export function CashflowIndexWidget({ index }: { index: CashflowIndex }) {
  const router = useRouter();
  return (
    <Widget variant="hero">
      <WidgetHeader
        title="Índice de Flujo de Caja"
        deactivateLabel="Desactivar Índice de Flujo de Caja"
        onDeactivate={() => commands.settings.setWidget('cashflow', false)}
      />
      <Text variant="amountLg" tone="brand" style={{ fontSize: 40, lineHeight: 44 }}>
        {formatCashflowIndex(index)}
      </Text>
      <Text variant="bodySm">{describeCashflowIndex(index)}</Text>
      <LinkButton label="Ver detalle" onPress={() => router.push(routes.cashflow())} />
    </Widget>
  );
}
