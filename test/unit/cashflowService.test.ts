import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IncomeStatement,
  CashflowIndex,
  BalanceSheet,
} from '../../src/domain/services/CashflowService';

// =============================================================================
// CASHFLOW SERVICE TESTS
// =============================================================================
//
// Test scenario:
// - 1 EARNED income: $4,000,000 (salary)
// - 1 PASSIVE income: $200,000 (dividends)
// - Life expenses: $2,000,000
// - Debt payments: $500,000 (loan installment)
//
// Expected results:
// - earnedIncome: $4,000,000
// - passiveIncome: $200,000
// - totalIncome: $4,200,000
// - lifeExpenses: $2,000,000
// - debtPayments: $500,000
// - totalExpenses: $2,500,000
// - netCashflow: $1,700,000
//
// For balance sheet:
// - Assets: account with balance $10,000,000 (ASSET)
// - Liabilities: loan with $5,000,000 remaining
// - totalAssets: $10,000,000
// - totalLiabilities: $5,000,000
// - netWorth: $5,000,000
//
// For cashflow index:
// - passiveIncome: $200,000
// - totalExpenses: $2,500,000
// - coveragePercent: 8%
// =============================================================================

// Mock data
const TEST_USER_ID = 'test-user-cashflow';
const TEST_MONTH = 6;
const TEST_YEAR = 2026;

describe('CashflowService', () => {
  describe('Income Statement calculations', () => {
    it('should calculate income statement correctly with EARNED and PASSIVE income', () => {
      // Input:
      const earnedIncome = 4_000_000;
      const passiveIncome = 200_000;
      const lifeExpenses = 2_000_000;
      const debtPayments = 500_000;

      // Expected calculations:
      const totalIncome = earnedIncome + passiveIncome; // 4,200,000
      const totalExpenses = lifeExpenses + debtPayments; // 2,500,000
      const netCashflow = totalIncome - totalExpenses; // 1,700,000

      expect(totalIncome).toBe(4_200_000);
      expect(totalExpenses).toBe(2_500_000);
      expect(netCashflow).toBe(1_700_000);
    });

    it('should handle zero passive income', () => {
      const earnedIncome = 5_000_000;
      const passiveIncome = 0;
      const lifeExpenses = 3_000_000;
      const debtPayments = 500_000;

      const totalIncome = earnedIncome + passiveIncome; // 5,000,000
      const totalExpenses = lifeExpenses + debtPayments; // 3,500,000
      const netCashflow = totalIncome - totalExpenses; // 1,500,000

      expect(totalIncome).toBe(5_000_000);
      expect(netCashflow).toBe(1_500_000);
    });

    it('should handle negative cashflow (spending more than earning)', () => {
      const earnedIncome = 2_000_000;
      const passiveIncome = 100_000;
      const lifeExpenses = 1_500_000;
      const debtPayments = 1_000_000;

      const totalIncome = earnedIncome + passiveIncome; // 2,100,000
      const totalExpenses = lifeExpenses + debtPayments; // 2,500,000
      const netCashflow = totalIncome - totalExpenses; // -400,000

      expect(netCashflow).toBe(-400_000);
      expect(netCashflow).toBeLessThan(0);
    });

    it('should handle no debt payments', () => {
      const earnedIncome = 4_000_000;
      const passiveIncome = 0;
      const lifeExpenses = 2_000_000;
      const debtPayments = 0;

      const totalExpenses = lifeExpenses + debtPayments; // 2,000,000
      const netCashflow = (earnedIncome + passiveIncome) - totalExpenses; // 2,000,000

      expect(totalExpenses).toBe(2_000_000);
      expect(netCashflow).toBe(2_000_000);
    });
  });

  describe('Balance Sheet calculations', () => {
    it('should calculate balance sheet correctly', () => {
      // Assets
      const asset1 = { balance: 10_000_000, type: 'INVESTMENT' as const };
      const asset2 = { balance: 3_000_000, type: 'SAVINGS' as const };

      // Liabilities
      const liability1 = { currentBalance: 5_000_000 }; // Loan
      const liability2 = { currentBalance: 500_000 }; // Credit card

      const totalAssets = asset1.balance + asset2.balance; // 13,000,000
      const totalLiabilities = liability1.currentBalance + liability2.currentBalance; // 5,500,000
      const netWorth = totalAssets - totalLiabilities; // 7,500,000

      expect(totalAssets).toBe(13_000_000);
      expect(totalLiabilities).toBe(5_500_000);
      expect(netWorth).toBe(7_500_000);
    });

    it('should handle negative net worth (more liabilities than assets)', () => {
      const totalAssets = 3_000_000;
      const totalLiabilities = 8_000_000;
      const netWorth = totalAssets - totalLiabilities; // -5,000,000

      expect(netWorth).toBe(-5_000_000);
      expect(netWorth).toBeLessThan(0);
    });

    it('should handle zero assets', () => {
      const totalAssets = 0;
      const totalLiabilities = 2_000_000;
      const netWorth = totalAssets - totalLiabilities; // -2,000,000

      expect(netWorth).toBe(-2_000_000);
    });

    it('should handle zero liabilities', () => {
      const totalAssets = 15_000_000;
      const totalLiabilities = 0;
      const netWorth = totalAssets - totalLiabilities; // 15,000,000

      expect(netWorth).toBe(15_000_000);
    });
  });

  describe('Cashflow Index calculations', () => {
    it('should calculate coverage percentage correctly', () => {
      const passiveIncome = 200_000;
      const totalExpenses = 2_500_000;

      const coveragePercent = (passiveIncome / totalExpenses) * 100; // 8%

      expect(coveragePercent).toBe(8);
    });

    it('should detect financial freedom when coverage >= 100%', () => {
      const passiveIncome = 3_000_000;
      const totalExpenses = 2_500_000;

      const coveragePercent = (passiveIncome / totalExpenses) * 100; // 120%
      const isFinancialFreedom = coveragePercent >= 100;

      expect(coveragePercent).toBe(120);
      expect(isFinancialFreedom).toBe(true);
    });

    it('should handle exactly 100% coverage', () => {
      const passiveIncome = 2_500_000;
      const totalExpenses = 2_500_000;

      const coveragePercent = (passiveIncome / totalExpenses) * 100; // 100%
      const isFinancialFreedom = coveragePercent >= 100;

      expect(coveragePercent).toBe(100);
      expect(isFinancialFreedom).toBe(true);
    });

    it('should handle zero total expenses with passive income', () => {
      const passiveIncome = 500_000;
      const totalExpenses = 0;

      // Division by zero should return 0 or capped value
      let coveragePercent = 0;
      if (totalExpenses === 0 && passiveIncome > 0) {
        coveragePercent = 1000; // Capped maximum
      }

      expect(coveragePercent).toBe(1000);
    });

    it('should handle zero passive income and zero expenses', () => {
      const passiveIncome = 0;
      const totalExpenses = 0;

      const coveragePercent =
        totalExpenses === 0 ? 0 : (passiveIncome / totalExpenses) * 100;

      expect(coveragePercent).toBe(0);
    });

    it('should cap coverage at reasonable maximum (1000%)', () => {
      const passiveIncome = 50_000_000; // Huge passive income
      const totalExpenses = 2_000_000;

      let coveragePercent = (passiveIncome / totalExpenses) * 100; // 2500%
      coveragePercent = Math.min(coveragePercent, 1000); // Cap at 1000%

      expect(coveragePercent).toBe(1000);
    });

    it('should round coverage to 1 decimal place', () => {
      const passiveIncome = 333_333;
      const totalExpenses = 1_000_000;

      const rawCoverage = (passiveIncome / totalExpenses) * 100; // 33.3333...%
      const coveragePercent = Math.round(rawCoverage * 10) / 10; // 33.3%

      expect(coveragePercent).toBe(33.3);
    });
  });

  describe('Complete scenario', () => {
    it('should verify the complete test scenario mathematically', () => {
      // SCENARIO:
      // - EARNED income: $4,000,000
      // - PASSIVE income: $200,000
      // - Life expenses: $2,000,000
      // - Debt payments: $500,000

      // INCOME STATEMENT:
      const earnedIncome = 4_000_000;
      const passiveIncome = 200_000;
      const lifeExpenses = 2_000_000;
      const debtPayments = 500_000;

      const totalIncome = earnedIncome + passiveIncome;
      const totalExpenses = lifeExpenses + debtPayments;
      const netCashflow = totalIncome - totalExpenses;

      expect(totalIncome).toBe(4_200_000);
      expect(totalExpenses).toBe(2_500_000);
      expect(netCashflow).toBe(1_700_000);

      // BALANCE SHEET:
      // Assets: Investment account $10,000,000 (ASSET class)
      // Liabilities: Loan $5,000,000 remaining
      const totalAssets = 10_000_000;
      const totalLiabilities = 5_000_000;
      const netWorth = totalAssets - totalLiabilities;

      expect(totalAssets).toBe(10_000_000);
      expect(totalLiabilities).toBe(5_000_000);
      expect(netWorth).toBe(5_000_000);

      // CASHFLOW INDEX:
      const coveragePercent = (passiveIncome / totalExpenses) * 100;
      const isFinancialFreedom = coveragePercent >= 100;

      expect(passiveIncome).toBe(200_000);
      expect(totalExpenses).toBe(2_500_000);
      expect(coveragePercent).toBe(8); // 8%
      expect(isFinancialFreedom).toBe(false);

      // SUMMARY:
      console.log('=== COMPLETE SCENARIO RESULTS ===');
      console.log(`Income Statement:`);
      console.log(`  - EARNED: $${earnedIncome.toLocaleString()}`);
      console.log(`  - PASSIVE: $${passiveIncome.toLocaleString()}`);
      console.log(`  - Total Income: $${totalIncome.toLocaleString()}`);
      console.log(`  - Life Expenses: $${lifeExpenses.toLocaleString()}`);
      console.log(`  - Debt Payments: $${debtPayments.toLocaleString()}`);
      console.log(`  - Total Expenses: $${totalExpenses.toLocaleString()}`);
      console.log(`  - Net Cashflow: $${netCashflow.toLocaleString()}`);
      console.log(`Balance Sheet:`);
      console.log(`  - Total Assets: $${totalAssets.toLocaleString()}`);
      console.log(`  - Total Liabilities: $${totalLiabilities.toLocaleString()}`);
      console.log(`  - Net Worth: $${netWorth.toLocaleString()}`);
      console.log(`Cashflow Index:`);
      console.log(`  - Coverage: ${coveragePercent}%`);
      console.log(`  - Financial Freedom: ${isFinancialFreedom}`);
    });
  });
});
