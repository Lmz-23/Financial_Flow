import { describe, it, expect } from 'vitest';
import {
  calculateInterestRate,
  calculateMinPayment,
  calculateAvailableCredit,
  projectPayoff,
  monthlyToAnnualRate,
  annualToMonthlyRate,
} from '../../src/domain/services/DebtService';

// =============================================================================
// DEBT SERVICE TESTS
// =============================================================================

describe('DebtService', () => {
  // -------------------------------------------------------------------------
  // calculateInterestRate Tests
  // -------------------------------------------------------------------------

  describe('calculateInterestRate', () => {
    it('should calculate correct rate for known case: 1M, 12 cuotas de 100k', () => {
      // Principal: $1,000,000
      // Monthly payment: $100,000
      // 12 installments
      //
      // Using financial calculator or Excel:
      // RATE(12, -100000, 1000000) ≈ 2.5% monthly
      //
      // Let's verify by recalculating the payment with the rate

      const principal = 1_000_000;
      const monthlyPayment = 100_000;
      const installments = 12;

      const rate = calculateInterestRate(principal, monthlyPayment, installments);

      // Expected rate is approximately 2.5% monthly
      expect(rate).toBeGreaterThan(0.02);
      expect(rate).toBeLessThan(0.03);

      // Verify: recalculate payment with this rate
      const recalculatedPayment =
        (principal * rate * Math.pow(1 + rate, installments)) /
        (Math.pow(1 + rate, installments) - 1);

      // Should be within 1 peso of original payment
      expect(Math.abs(recalculatedPayment - monthlyPayment)).toBeLessThan(1);
    });

    it('should handle high interest rates', () => {
      // Simulating a predatory loan:
      // Principal: $500,000
      // Monthly payment: $150,000
      // 6 installments (6 months)
      // Should result in a high monthly rate

      const principal = 500_000;
      const monthlyPayment = 150_000;
      const installments = 6;

      const rate = calculateInterestRate(principal, monthlyPayment, installments);

      // Should be a significant rate (likely > 10% monthly)
      expect(rate).toBeGreaterThan(0.05);
      expect(rate).toBeLessThan(0.5); // But not absurd
    });

    it('should handle low interest rates', () => {
      // A cheap loan:
      // Principal: $10,000,000
      // Monthly payment: $900,000
      // 12 installments
      // Should result in a low monthly rate

      const principal = 10_000_000;
      const monthlyPayment = 900_000;
      const installments = 12;

      const rate = calculateInterestRate(principal, monthlyPayment, installments);

      // Should be a low rate (< 3% monthly)
      expect(rate).toBeLessThan(0.03);
      expect(rate).toBeGreaterThan(0);
    });

    it('should throw error for payment too low to cover principal', () => {
      // Principal: $1,000,000
      // Monthly payment: $50,000
      // 12 installments
      // Total payments: $600,000 < $1,000,000 principal
      // Impossible to pay off

      expect(() => {
        calculateInterestRate(1_000_000, 50_000, 12);
      }).toThrow('Payment too low');
    });

    it('should throw error for non-positive principal', () => {
      expect(() => {
        calculateInterestRate(0, 100_000, 12);
      }).toThrow('Principal must be positive');

      expect(() => {
        calculateInterestRate(-100_000, 100_000, 12);
      }).toThrow('Principal must be positive');
    });

    it('should throw error for non-positive payment', () => {
      expect(() => {
        calculateInterestRate(1_000_000, 0, 12);
      }).toThrow('Monthly payment must be positive');

      expect(() => {
        calculateInterestRate(1_000_000, -50_000, 12);
      }).toThrow('Monthly payment must be positive');
    });
  });

  // -------------------------------------------------------------------------
  // calculateMinPayment Tests
  // -------------------------------------------------------------------------

  describe('calculateMinPayment', () => {
    it('should calculate 15% minimum payment correctly', () => {
      const balance = 1_000_000;
      const percent = 15;

      const minPayment = calculateMinPayment(balance, percent);

      expect(minPayment).toBe(150_000);
    });

    it('should handle rounding', () => {
      const balance = 1_000_001;
      const percent = 15;

      const minPayment = calculateMinPayment(balance, percent);

      expect(minPayment).toBe(150_000); // Rounded down from 150000.15
    });

    it('should return 0 for zero or negative balance', () => {
      expect(calculateMinPayment(0, 15)).toBe(0);
      expect(calculateMinPayment(-100_000, 15)).toBe(0);
    });

    it('should return 0 for zero percent', () => {
      expect(calculateMinPayment(1_000_000, 0)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // calculateAvailableCredit Tests
  // -------------------------------------------------------------------------

  describe('calculateAvailableCredit', () => {
    it('should calculate available credit correctly', () => {
      const limit = 5_000_000;
      const used = 2_000_000;

      const available = calculateAvailableCredit(limit, used);

      expect(available).toBe(3_000_000);
    });

    it('should return full limit when nothing used', () => {
      const limit = 5_000_000;
      const used = 0;

      const available = calculateAvailableCredit(limit, used);

      expect(available).toBe(5_000_000);
    });

    it('should handle used exceeding limit (over-limit)', () => {
      const limit = 5_000_000;
      const used = 6_000_000;

      const available = calculateAvailableCredit(limit, used);

      expect(available).toBe(-1_000_000); // Negative = over limit
    });
  });

  // -------------------------------------------------------------------------
  // projectPayoff Tests
  // -------------------------------------------------------------------------

  describe('projectPayoff', () => {
    it('should project payoff in correct number of months', () => {
      // Principal: $1,000,000
      // Monthly payment: $100,000
      // Interest: 0% (no interest for simplicity)
      // Should pay off in exactly 10 months

      const projection = projectPayoff(1_000_000, 100_000, 0);

      expect(projection.monthsToPayoff).toBe(10);
      expect(projection.totalInterestPaid).toBe(0);
      expect(projection.totalAmountPaid).toBe(1_000_000);
      expect(projection.finalBalance).toBe(0);
      expect(projection.isIndefinite).toBe(false);
    });

    it('should handle interest correctly', () => {
      // Principal: $1,000,000
      // Monthly payment: $150,000
      // Interest: 5% monthly
      //
      // Month 1: Interest = $50,000, Principal = $100,000, Balance = $900,000
      // Month 2: Interest = $45,000, Principal = $105,000, Balance = $795,000
      // ... and so on

      const projection = projectPayoff(1_000_000, 150_000, 0.05);

      expect(projection.monthsToPayoff).toBeLessThan(15); // Should be paid off before 15 months
      expect(projection.monthsToPayoff).toBeGreaterThan(5); // But not too fast
      expect(projection.totalInterestPaid).toBeGreaterThan(0);
      expect(projection.totalAmountPaid).toBeGreaterThan(1_000_000);
      expect(projection.isIndefinite).toBe(false);
    });

    it('should detect when payment does not cover interest', () => {
      // Principal: $1,000,000
      // Monthly payment: $30_000
      // Interest: 5% monthly = $50,000 interest per month
      // Payment doesn't even cover the interest!

      const projection = projectPayoff(1_000_000, 30_000, 0.05);

      expect(projection.isIndefinite).toBe(true);
      expect(projection.monthsToPayoff).toBe(Infinity);
    });

    it('should handle zero interest rate', () => {
      const projection = projectPayoff(500_000, 50_000, 0);

      expect(projection.monthsToPayoff).toBe(10);
      expect(projection.totalInterestPaid).toBe(0);
      expect(projection.finalBalance).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rate Conversion Tests
  // -------------------------------------------------------------------------

  describe('rate conversions', () => {
    it('should convert monthly to annual rate correctly', () => {
      // 2% monthly for 12 months
      // Effective annual = (1.02)^12 - 1 ≈ 0.2682 = 26.82%
      const monthlyRate = 0.02;
      const annualRate = monthlyToAnnualRate(monthlyRate);

      expect(annualRate).toBeGreaterThan(0.26);
      expect(annualRate).toBeLessThan(0.27);
    });

    it('should convert annual to monthly rate correctly', () => {
      // 26.82% annual
      // Monthly = (1.2682)^(1/12) - 1 ≈ 0.02
      const annualRate = 0.2682;
      const monthlyRate = annualToMonthlyRate(annualRate);

      expect(monthlyRate).toBeGreaterThan(0.019);
      expect(monthlyRate).toBeLessThan(0.021);
    });

    it('should be inverse operations', () => {
      const originalMonthly = 0.025; // 2.5%
      const annual = monthlyToAnnualRate(originalMonthly);
      const backToMonthly = annualToMonthlyRate(annual);

      expect(backToMonthly).toBeCloseTo(originalMonthly, 10);
    });
  });
});
