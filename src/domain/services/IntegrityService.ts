import { accountRepository } from '../../database/repositories/accountRepository';
import { debtRepository } from '../../database/repositories/debtRepository';
import { goalRepository } from '../../database/repositories/goalRepository';
import { reportRepository } from '../../database/repositories/reportRepository';
import type { DomainContext } from './shared';

export type InvariantCode = 'I1' | 'I2' | 'I3' | 'I4' | 'I5' | 'I6';

export interface IntegrityViolation {
  invariant: InvariantCode;
  message: string;
}

export interface IntegrityReport {
  ok: boolean;
  violations: IntegrityViolation[];
}

/**
 * Comprueba las invariantes I1-I6 de la arquitectura (§3.3). Solo lectura; nunca bloquea al usuario:
 * devuelve el informe y quien llama decide (desarrollo y tests).
 */
export function createIntegrityService(ctx: DomainContext) {
  return {
    check(): IntegrityReport {
      const db = ctx.db;
      const userId = ctx.userId;
      const violations: IntegrityViolation[] = [];
      const add = (invariant: InvariantCode, message: string): void => {
        violations.push({ invariant, message });
      };

      // I1. Conservacion global (los aportes se cancelan entre ambos lados).
      const available = accountRepository.availableByAccount(db, userId);
      const saved = goalRepository.savedByGoal(db, userId);
      const goals = goalRepository.list(db, userId);
      let left = 0;
      for (const v of available.values()) left += v;
      for (const g of goals) {
        left += g.status === 'SPENT' ? (g.spentAmountMinor ?? 0) : (saved.get(g.id) ?? 0);
      }
      const right = reportRepository.ledgerTotal(db, userId);
      if (left !== right) add('I1', `Conservacion global rota: patrimonio derivado ${left} != libro ${right}`);

      // I2. Deudas: saldo >= 0 y 0 <= capital aplicado <= monto.
      for (const [debtId, balance] of debtRepository.balancesByDebt(db, userId)) {
        if (balance < 0) add('I2', `La deuda ${debtId} tiene saldo negativo (${balance})`);
      }
      for (const p of reportRepository.paymentsOutOfRange(db, userId)) {
        add('I2', `El pago ${p.id} tiene capital aplicado fuera de [0, ${p.amountMinor}] (${p.principalMinor})`);
      }

      // I3. Metas gastadas: spentAmountMinor == saved derivado.
      for (const g of goals) {
        if (g.status !== 'SPENT') continue;
        const derived = saved.get(g.id) ?? 0;
        if (g.spentAmountMinor !== derived) {
          add('I3', `La meta ${g.id} gastada guarda ${g.spentAmountMinor} pero su ahorro derivado es ${derived}`);
        }
      }

      // I4. Recurrentes: una transaccion por ocurrencia; cuotas de deuda nunca por el camino generico.
      for (const d of reportRepository.duplicatedOccurrences(db, userId)) {
        add('I4', `El recurrente ${d.recurringItemId} tiene ${d.n} transacciones para ${d.occurrenceDate}`);
      }
      for (const id of reportRepository.genericTxOnDebtRecurring(db, userId)) {
        add('I4', `La transaccion ${id} confirma por el camino generico la cuota de una deuda`);
      }

      // I5. Clasificacion.
      for (const id of reportRepository.misclassifiedTransactions(db, userId)) {
        add('I5', `La transaccion ${id} esta mal clasificada`);
      }

      // I6. Widgets: solo NULL, 0 o 1.
      for (const key of reportRepository.invalidWidgetFlags(db, userId)) {
        add('I6', `El flag de widget ${key} tiene un valor invalido`);
      }

      return { ok: violations.length === 0, violations };
    },
  };
}

export type IntegrityService = ReturnType<typeof createIntegrityService>;
