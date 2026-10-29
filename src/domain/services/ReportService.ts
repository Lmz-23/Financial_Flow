import { accountRepository } from '../../database/repositories/accountRepository';
import { debtRepository } from '../../database/repositories/debtRepository';
import { goalRepository } from '../../database/repositories/goalRepository';
import { reportRepository } from '../../database/repositories/reportRepository';
import { localDateToEpochMs, monthBounds, monthBoundsOf, toLocalDate, type LocalDate } from '../dates';
import type { Minor } from '../money';
import { periodBuckets, periodRange, type DateRange, type Period } from '../rules/periods';
import { computeMonthStatement, netWorth, type MonthStatement } from '../rules/statement';
import { ValidationError } from './errors';
import type { DomainContext } from './shared';

/** Barra del grafico del detalle del flujo: una semana (mes) o un mes (trimestre, semestre, año). */
export interface FlowBucket extends DateRange {
  ingresoTotal: Minor;
  gastoTotal: Minor;
}

/**
 * Linea del desglose por categoria. `group` dice de donde sale cuando no hay categoria: un gasto o
 * ingreso sin categoria, los pagos de deuda (no llevan categoria) o las metas cumplidas.
 */
export interface CategoryLine {
  key: string;
  group: 'CATEGORY' | 'UNCATEGORIZED' | 'DEBT' | 'GOALS';
  name: string | null;
  totalMinor: Minor;
}

export interface PeriodReport {
  period: Period;
  /** Totales del periodo completo (mismas reglas que el mes, §3.2). */
  statement: MonthStatement;
  buckets: FlowBucket[];
  /** Ordenadas de mayor a menor; suman `statement.ingresoTotal`. */
  incomeByCategory: CategoryLine[];
  /** Ordenadas de mayor a menor; suman `statement.gastoTotal` (incluye pagos de deuda y metas cumplidas). */
  expenseByCategory: CategoryLine[];
}

function isValidPeriod(p: Period): boolean {
  const max = { MONTH: 12, QUARTER: 4, SEMESTER: 2, YEAR: 1 }[p.kind];
  return Number.isInteger(p.year) && p.year >= 100 && p.year <= 9999 && Number.isInteger(p.index) && p.index >= 1 && p.index <= max;
}

function byTotalDesc(a: CategoryLine, b: CategoryLine): number {
  return b.totalMinor - a.totalMinor || (a.name ?? '').localeCompare(b.name ?? '');
}

/**
 * Reportes (reemplaza a CashflowService). Solo lectura: no devuelve `{ result, effects }`.
 * Mes calendario en hora local del dispositivo, intervalo [inicio, inicio del mes siguiente).
 */
export function createReportService(ctx: DomainContext) {
  function statementBetween(start: number, end: number): MonthStatement {
    return computeMonthStatement(reportRepository.monthAggregates(ctx.db, ctx.userId, start, end));
  }

  const msOf = (date: LocalDate) => localDateToEpochMs(date);

  return {
    /** Detalle del flujo de un periodo: totales, barras del grafico y desglose por categoria. */
    periodReport(period: Period): PeriodReport {
      if (!isValidPeriod(period)) throw new ValidationError('Periodo invalido');
      const range = periodRange(period);
      const start = msOf(range.from);
      const end = msOf(range.toExclusive);
      const statement = statementBetween(start, end);
      const buckets = periodBuckets(period).map((b) => {
        const s = statementBetween(msOf(b.from), msOf(b.toExclusive));
        return { ...b, ingresoTotal: s.ingresoTotal, gastoTotal: s.gastoTotal };
      });
      const incomeByCategory: CategoryLine[] = [];
      const expenseByCategory: CategoryLine[] = [];
      let debtMinor = 0;
      for (const row of reportRepository.categoryTotals(ctx.db, ctx.userId, start, end)) {
        if (row.totalMinor <= 0) continue;
        if (row.kind === 'DEBT_PAYMENT') {
          debtMinor += row.totalMinor;
          continue;
        }
        const line: CategoryLine = {
          key: `${row.type}:${row.categoryId ?? '-'}`,
          group: row.categoryId === null ? 'UNCATEGORIZED' : 'CATEGORY',
          name: row.categoryName,
          totalMinor: row.totalMinor,
        };
        (row.type === 'INCOME' ? incomeByCategory : expenseByCategory).push(line);
      }
      if (debtMinor > 0) expenseByCategory.push({ key: 'EXPENSE:debt', group: 'DEBT', name: null, totalMinor: debtMinor });
      if (statement.gastoMetas > 0) {
        expenseByCategory.push({ key: 'EXPENSE:goals', group: 'GOALS', name: null, totalMinor: statement.gastoMetas });
      }
      return {
        period,
        statement,
        buckets,
        incomeByCategory: incomeByCategory.sort(byTotalDesc),
        expenseByCategory: expenseByCategory.sort(byTotalDesc),
      };
    },

    /** Fecha local del primer movimiento con efecto en el flujo (ingreso, gasto o meta cumplida); null si no hay. */
    firstActivityDate(): LocalDate | null {
      const ms = reportRepository.firstActivityMs(ctx.db, ctx.userId);
      return ms === null ? null : toLocalDate(ms);
    },

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
