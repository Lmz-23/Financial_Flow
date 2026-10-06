// Consultas agregadas del reporte mensual y de las invariantes (I1-I6). Solo lectura.
import { and, eq, sql } from 'drizzle-orm';
import type { MonthAggregates } from '../../domain/rules/statement';
import { balanceAdjustments, goals, recurringItems, transactions, users } from '../schema';
import type { DbOrTx } from '../types';

const num = (expr: ReturnType<typeof sql<number>>) => expr.mapWith(Number);

export interface PaymentRangeViolation {
  id: string;
  amountMinor: number;
  principalMinor: number | null;
}

export const reportRepository = {
  /**
   * Agregados del mes (§3.2) para el intervalo [startMs, endMs) en epoch ms.
   * ingresoActivo/gastoTotal/netCashflow/Indice los calcula `computeMonthStatement`.
   */
  monthAggregates(db: DbOrTx, userId: string, startMs: number, endMs: number): MonthAggregates {
    const inRange = sql`${transactions.date} >= ${startMs} AND ${transactions.date} < ${endMs}`;
    const t = db
      .select({
        ingresoTotal: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else 0 end), 0)`),
        ingresoPasivo: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'INCOME' and ${transactions.isPassive} = 1 then ${transactions.amountMinor} else 0 end), 0)`),
        gastoVida: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' and ${transactions.kind} = 'STANDARD' then ${transactions.amountMinor} else 0 end), 0)`),
        gastoDeuda: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'EXPENSE' and ${transactions.kind} = 'DEBT_PAYMENT' then ${transactions.amountMinor} else 0 end), 0)`),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inRange))
      .get();
    const g = db
      .select({ v: num(sql<number>`coalesce(sum(${goals.spentAmountMinor}), 0)`) })
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.status, 'SPENT'),
          sql`${goals.spentAt} >= ${startMs} AND ${goals.spentAt} < ${endMs}`,
        ),
      )
      .get();
    return {
      ingresoTotal: t?.ingresoTotal ?? 0,
      ingresoPasivo: t?.ingresoPasivo ?? 0,
      gastoVida: t?.gastoVida ?? 0,
      gastoDeuda: t?.gastoDeuda ?? 0,
      gastoMetas: g?.v ?? 0,
    };
  },

  /** Lado derecho de I1: Σ ajustes de cuentas + Σ ajustes de metas + Σ ingresos − Σ gastos. */
  ledgerTotal(db: DbOrTx, userId: string): number {
    const adj = db
      .select({ v: num(sql<number>`coalesce(sum(${balanceAdjustments.deltaMinor}), 0)`) })
      .from(balanceAdjustments)
      .where(and(eq(balanceAdjustments.userId, userId), sql`${balanceAdjustments.targetType} IN ('ACCOUNT', 'GOAL')`))
      .get();
    const tx = db
      .select({
        v: num(sql<number>`coalesce(sum(case when ${transactions.type} = 'INCOME' then ${transactions.amountMinor} else -${transactions.amountMinor} end), 0)`),
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .get();
    return (adj?.v ?? 0) + (tx?.v ?? 0);
  },

  /** Σ spentAmountMinor de metas SPENT. */
  spentGoalsTotal(db: DbOrTx, userId: string): number {
    const row = db
      .select({ v: num(sql<number>`coalesce(sum(${goals.spentAmountMinor}), 0)`) })
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.status, 'SPENT')))
      .get();
    return row?.v ?? 0;
  },

  /** I2: pagos con capital fuera de [0, monto]. */
  paymentsOutOfRange(db: DbOrTx, userId: string): PaymentRangeViolation[] {
    return db
      .select({
        id: transactions.id,
        amountMinor: transactions.amountMinor,
        principalMinor: transactions.debtPrincipalAppliedMinor,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.kind, 'DEBT_PAYMENT'),
          sql`(${transactions.debtPrincipalAppliedMinor} IS NULL OR ${transactions.debtPrincipalAppliedMinor} < 0 OR ${transactions.debtPrincipalAppliedMinor} > ${transactions.amountMinor})`,
        ),
      )
      .all();
  },

  /** I4: (recurrente, ocurrencia) con mas de una transaccion. */
  duplicatedOccurrences(db: DbOrTx, userId: string): { recurringItemId: string; occurrenceDate: string; n: number }[] {
    return db
      .select({
        recurringItemId: sql<string>`${transactions.recurringItemId}`,
        occurrenceDate: sql<string>`${transactions.occurrenceDate}`,
        n: num(sql<number>`count(*)`),
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), sql`${transactions.recurringItemId} IS NOT NULL`))
      .groupBy(transactions.recurringItemId, transactions.occurrenceDate)
      .having(sql`count(*) > 1`)
      .all();
  },

  /** I4: transacciones genericas ligadas a un recurrente de cuota de deuda. */
  genericTxOnDebtRecurring(db: DbOrTx, userId: string): string[] {
    return db
      .select({ id: transactions.id })
      .from(transactions)
      .innerJoin(recurringItems, eq(recurringItems.id, transactions.recurringItemId))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(recurringItems.kind, 'DEBT_INSTALLMENT'),
          eq(transactions.kind, 'STANDARD'),
        ),
      )
      .all()
      .map((r) => r.id);
  },

  /** I5: transacciones mal clasificadas (los CHECK lo impiden; se verifica por defensa). */
  misclassifiedTransactions(db: DbOrTx, userId: string): string[] {
    return db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          sql`((${transactions.isPassive} = 1 AND ${transactions.type} <> 'INCOME')
            OR (${transactions.kind} = 'DEBT_PAYMENT' AND (${transactions.type} <> 'EXPENSE' OR ${transactions.debtId} IS NULL)))`,
        ),
      )
      .all()
      .map((r) => r.id);
  },

  /** I6: flags de widget distintos de NULL/0/1. */
  invalidWidgetFlags(db: DbOrTx, userId: string): string[] {
    const row = db
      .select({
        cashflow: users.widgetCashflow,
        debts: users.widgetDebts,
        goals: users.widgetGoals,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!row) return [];
    const bad: string[] = [];
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && value !== 0 && value !== 1) bad.push(key);
    }
    return bad;
  },
};
