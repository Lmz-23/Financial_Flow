import { accountRepository } from '../../database/repositories/accountRepository';
import { debtRepository } from '../../database/repositories/debtRepository';
import { goalRepository } from '../../database/repositories/goalRepository';
import { reportRepository } from '../../database/repositories/reportRepository';
import { monthBounds, monthBoundsOf } from '../dates';
import { computeMonthStatement, netWorth, type MonthStatement } from '../rules/statement';
import { ValidationError } from './errors';
import type { DomainContext } from './shared';

/**
 * Reportes (reemplaza a CashflowService). Solo lectura: no devuelve `{ result, effects }`.
 * Mes calendario en hora local del dispositivo, intervalo [inicio, inicio del mes siguiente).
 */
export function createReportService(ctx: DomainContext) {
  function statementBetween(start: number, end: number): MonthStatement {
    return computeMonthStatement(reportRepository.monthAggregates(ctx.db, ctx.userId, start, end));
  }

  return {
    /** Desglose del mes (month 1-12): ingresoActivo/Pasivo, gastoVida/Deuda/Metas, total, neto e Indice. */
    monthStatement(year: number, month: number): MonthStatement {
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new ValidationError('Mes invalido');
      }
      const { start, end } = monthBounds(year, month);
      return statementBetween(start, end);
    },

    /** Desglose del mes calendario que contiene el instante (por defecto, el reloj del dominio). */
    monthStatementOf(epochMs: number = ctx.now()): MonthStatement {
      const { start, end } = monthBoundsOf(epochMs);
      return statementBetween(start, end);
    },

    /** Patrimonio neto (§3.1): Σ disponible + Σ saved de metas activas − Σ saldo de deudas no archivadas. */
    netWorth(): number {
      const db = ctx.db;
      const available = accountRepository.availableByAccount(db, ctx.userId);
      const saved = goalRepository.savedByGoal(db, ctx.userId);
      const balances = debtRepository.balancesByDebt(db, ctx.userId);
      return netWorth({
        accountAvailable: accountRepository.listActive(db, ctx.userId).map((a) => available.get(a.id) ?? 0),
        goalsSaved: goalRepository.list(db, ctx.userId, 'ACTIVE').map((g) => saved.get(g.id) ?? 0),
        debtBalances: debtRepository.list(db, ctx.userId).map((d) => balances.get(d.id) ?? 0),
      });
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
