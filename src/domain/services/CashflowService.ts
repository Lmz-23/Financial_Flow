import { database } from '../../database';
import {
  transactions,
  recurringItems,
  accounts,
  debtCards,
  debtLoans,
} from '../../database/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { AccountRepository } from '../../database/repositories/accountRepository';

// =============================================================================
// CASHFLOW SERVICE
// =============================================================================
//
// Implements Kiyosaki's Cashflow quadrant concepts:
// - EARNED income: salary, freelance, business (requires active work)
// - PASSIVE income: dividends, rent, interest, royalties (money works for you)
// - LIFE EXPENSES: daily living costs
// - DEBT PAYMENTS: loan installments, credit card payments
//
// The goal is to increase PASSIVE income to cover all expenses,
// reaching "financial freedom" when passiveIncome >= totalExpenses.
// =============================================================================

export interface IncomeStatement {
  month: number;
  year: number;
  earnedIncome: number;
  passiveIncome: number;
  totalIncome: number;
  lifeExpenses: number;
  debtPayments: number;
  totalExpenses: number;
  netCashflow: number;
}

export interface BalanceSheet {
  assets: {
    accountId: string;
    name: string;
    balance: number;
    type: string;
  }[];
  totalAssets: number;
  liabilities: {
    debtId: string;
    name: string;
    type: 'CARD' | 'LOAN';
    currentBalance: number;
    institution: string;
  }[];
  totalLiabilities: number;
  netWorth: number;
}

export interface CashflowIndex {
  month: number;
  year: number;
  passiveIncome: number;
  totalExpenses: number;
  coveragePercent: number;
  isFinancialFreedom: boolean;
}

// =============================================================================
// INCOME STATEMENT
// =============================================================================

/**
 * Calculates the income statement (Estado de Resultados) for a month.
 *
 * Classifies income by source:
 * - EARNED: from recurring items with incomeSource='EARNED' or manual transactions
 * - PASSIVE: from recurring items with incomeSource='PASSIVE'
 *
 * Classifies expenses:
 * - LIFE_EXPENSES: regular expense transactions (not debt payments)
 * - DEBT_PAYMENTS: tracked separately (see getDebtPayments)
 */
export async function getIncomeStatement(
  userId: string,
  month: number,
  year: number
): Promise<IncomeStatement> {
  const { start, end } = getMonthDateRange(month, year);

  // Get all confirmed transactions for the month
  const monthTransactions = await database.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      eq(transactions.status, 'CONFIRMED'),
      gte(transactions.date, start),
      lte(transactions.date, end)
    ),
    orderBy: [desc(transactions.date)],
  });

  // Calculate earned income (EARNED from recurring items or manual)
  let earnedIncome = 0;
  let passiveIncome = 0;
  let lifeExpenses = 0;
  let debtPayments = 0;

  for (const tx of monthTransactions) {
    if (tx.type === 'INCOME') {
      // Check if this income has a recurring item and what its source is
      if (tx.recurringItemId) {
        const recurringItem = await database.query.recurringItems.findFirst({
          where: eq(recurringItems.id, tx.recurringItemId),
        });

        if (recurringItem?.incomeSource === 'PASSIVE') {
          passiveIncome += tx.amount;
        } else {
          // Either EARNED or no incomeSource specified = EARNED by default
          earnedIncome += tx.amount;
        }
      } else {
        // Manual income (no recurring item) = EARNED by default
        earnedIncome += tx.amount;
      }
    } else if (tx.type === 'EXPENSE') {
      // Check if this expense is related to a debt payment
      // For now, we track debt payments separately
      // In a more complete implementation, we'd mark transactions as debt payments
      // For this version, we sum up the actual debt payments separately
      lifeExpenses += Math.abs(tx.amount);
    }
  }

  // Get actual debt payments made this month
  debtPayments = await getDebtPayments(userId, start, end);

  const totalIncome = earnedIncome + passiveIncome;
  const totalExpenses = lifeExpenses + debtPayments;
  const netCashflow = totalIncome - totalExpenses;

  return {
    month,
    year,
    earnedIncome,
    passiveIncome,
    totalIncome,
    lifeExpenses,
    debtPayments,
    totalExpenses,
    netCashflow,
  };
}

/**
 * Gets total debt payments made in a date range.
 * This includes:
 * - Credit card payments (from transactions to debt card accounts)
 * - Loan payments (from transactions reducing debt_loans balance)
 */
async function getDebtPayments(
  userId: string,
  start: Date,
  end: Date
): Promise<number> {
  // For now, we track debt payments through the debt balance changes
  // In a complete implementation, transactions would have a debtId field
  // to mark them as debt payments

  // Get all loan payments: transactions that reduced debt_loans balance
  // Since debt_loans.currentBalance is updated when payments are made,
  // we can infer payments from balance changes
  //
  // However, this is complex. For simplicity, we track loan payments
  // through a separate mechanism. For now, return 0 and implement
  // when the debt payment flow is built.

  // TODO: Implement debt payment tracking
  // Options:
  // 1. Add a debtId field to transactions
  // 2. Query for transactions that reduced debt_loans balance
  // 3. Create a debt_payments table

  return 0; // Placeholder
}

// =============================================================================
// BALANCE SHEET
// =============================================================================

/**
 * Calculates the balance sheet (Balance General) for the user.
 *
 * Assets: Accounts with cashflowClass='ASSET'
 * Liabilities: All active debts (credit cards + loans)
 */
export async function getBalanceSheet(userId: string): Promise<BalanceSheet> {
  // Get all accounts with their balances
  const accountsWithBalances = await AccountRepository.getAllWithBalances(userId);

  // Filter ASSET accounts
  const assets = accountsWithBalances
    .filter((acc) => acc.cashflowClass === 'ASSET')
    .map((acc) => ({
      accountId: acc.id,
      name: acc.name,
      balance: acc.balance,
      type: acc.type,
    }));

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);

  // Get credit cards
  const cards = await database.query.debtCards.findMany({
    where: and(
      eq(debtCards.userId, userId),
      eq(debtCards.isActive, true)
    ),
  });

  const cardLiabilities = cards.map((card) => ({
    debtId: card.id,
    name: card.name,
    type: 'CARD' as const,
    currentBalance: card.usedAmount,
    institution: card.institution,
  }));

  // Get loans
  const loans = await database.query.debtLoans.findMany({
    where: and(
      eq(debtLoans.userId, userId),
      eq(debtLoans.isActive, true)
    ),
  });

  const loanLiabilities = loans.map((loan) => ({
    debtId: loan.id,
    name: loan.name,
    type: 'LOAN' as const,
    currentBalance: loan.currentBalance,
    institution: loan.institution,
  }));

  const liabilities = [...cardLiabilities, ...loanLiabilities];
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.currentBalance, 0);

  const netWorth = totalAssets - totalLiabilities;

  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    netWorth,
  };
}

// =============================================================================
// CASHFLOW INDEX
// =============================================================================

/**
 * Calculates the Cashflow Index (Índice de Flujo de Caja).
 *
 * This is the key metric from Kiyosaki's Cashflow:
 * - Shows how much of your expenses are covered by passive income
 * - Financial freedom = coveragePercent >= 100%
 *
 * Formula: (passiveIncome / totalExpenses) * 100
 */
export async function getCashflowIndex(
  userId: string,
  month: number,
  year: number
): Promise<CashflowIndex> {
  const incomeStatement = await getIncomeStatement(userId, month, year);

  const { passiveIncome, totalExpenses } = incomeStatement;

  // Calculate coverage percentage
  let coveragePercent = 0;
  if (totalExpenses > 0) {
    coveragePercent = (passiveIncome / totalExpenses) * 100;
    // Cap at a reasonable maximum (1000%)
    coveragePercent = Math.min(coveragePercent, 1000);
  } else if (passiveIncome > 0 && totalExpenses === 0) {
    // No expenses but have passive income = infinite coverage
    coveragePercent = 1000; // Cap at 1000%
  }

  return {
    month,
    year,
    passiveIncome,
    totalExpenses,
    coveragePercent: Math.round(coveragePercent * 10) / 10, // Round to 1 decimal
    isFinancialFreedom: coveragePercent >= 100,
  };
}

// =============================================================================
// CASHFLOW SUMMARY (for dashboard)
// =============================================================================

export interface CashflowSummary {
  incomeStatement: IncomeStatement;
  cashflowIndex: CashflowIndex;
  balanceSheet: BalanceSheet;
}

/**
 * Gets a complete cashflow summary for dashboard display.
 */
export async function getCashflowSummary(
  userId: string,
  month: number,
  year: number
): Promise<CashflowSummary> {
  const [incomeStatement, cashflowIndex, balanceSheet] = await Promise.all([
    getIncomeStatement(userId, month, year),
    getCashflowIndex(userId, month, year),
    getBalanceSheet(userId),
  ]);

  return {
    incomeStatement,
    cashflowIndex,
    balanceSheet,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getMonthDateRange(month: number, year: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month - 1 + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
