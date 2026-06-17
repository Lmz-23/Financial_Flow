// =============================================================================
// DEBT SERVICE
// =============================================================================
//
// Financial calculations for debts and credit cards.
// All calculations use integer pesos (no decimals) to avoid floating point issues.
// =============================================================================

/**
 * Calculates the effective monthly interest rate using Newton-Raphson method.
 *
 * Uses the present value of annuity formula:
 *   PV = PMT * (1 - (1 + r)^-n) / r
 *
 * Where:
 *   PV = Principal (amount borrowed)
 *   PMT = Monthly payment
 *   r = Monthly interest rate (what we're solving for)
 *   n = Number of installments
 *
 * Newton-Raphson iteration:
 *   r_new = r - (f(r) / f'(r))
 *   f(r) = PMT * (1 - (1 + r)^-n) / r - PV
 *   f'(r) = PMT * ((n * (1 + r)^(-n-1) / r) - (1 - (1 + r)^-n) / r^2)
 *
 * @param principal - Loan amount in pesos
 * @param monthlyPayment - Fixed monthly payment in pesos
 * @param totalInstallments - Number of monthly payments
 * @returns Monthly interest rate as decimal (e.g., 0.025 = 2.5%)
 * @throws Error if payment is too low to ever pay off the loan
 */
export function calculateInterestRate(
  principal: number,
  monthlyPayment: number,
  totalInstallments: number
): number {
  // Validation
  if (principal <= 0) {
    throw new Error('Principal must be positive');
  }
  if (monthlyPayment <= 0) {
    throw new Error('Monthly payment must be positive');
  }
  if (totalInstallments <= 0) {
    throw new Error('Number of installments must be positive');
  }

  // If payment is too low to ever cover interest, throw
  const minPaymentToCoverInterest = principal * 0.5; // Arbitrary high rate assumption
  if (monthlyPayment * totalInstallments <= principal) {
    throw new Error(
      'Payment too low to ever pay off this loan. Total payments would be less than principal.'
    );
  }

  // Newton-Raphson implementation
  let r = 0.01; // Initial guess: 1% monthly
  const tolerance = 0.0000001; // Precision to 0.00001%
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const rPlus1 = 1 + r;
    const rPlus1PowerN = Math.pow(rPlus1, -totalInstallments);
    const rPlus1PowerNMinus1 = Math.pow(rPlus1, -(totalInstallments - 1));

    // f(r) = PMT * (1 - (1+r)^-n) / r - PV
    const f = monthlyPayment * (1 - rPlus1PowerN) / r - principal;

    // f'(r) = PMT * (n * (1+r)^(-n-1) / r) - PMT * (1 - (1+r)^-n) / r^2
    const fPrime =
      monthlyPayment * (totalInstallments * rPlus1PowerNMinus1 / r) -
      monthlyPayment * ((1 - rPlus1PowerN) / (r * r));

    if (Math.abs(fPrime) < 1e-15) {
      // Derivative too small, try bisection instead
      return bisectionMethod(principal, monthlyPayment, totalInstallments);
    }

    const newR = r - f / fPrime;

    // Check convergence
    if (Math.abs(newR - r) < tolerance) {
      return newR;
    }

    r = newR;

    // Sanity check: if rate goes negative or unreasonably high, bail out
    if (r < 0 || r > 1) {
      return bisectionMethod(principal, monthlyPayment, totalInstallments);
    }
  }

  // If Newton-Raphson didn't converge, try bisection
  return bisectionMethod(principal, monthlyPayment, totalInstallments);
}

/**
 * Bisection method as fallback/verification for interest rate calculation.
 */
function bisectionMethod(
  principal: number,
  monthlyPayment: number,
  totalInstallments: number
): number {
  let low = 0.0001; // 0.01%
  let high = 0.5; // 50% monthly (unrealistic but safe upper bound)

  const tolerance = 0.0000001;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const pv = presentValue(mid, monthlyPayment, totalInstallments);

    if (Math.abs(pv - principal) < tolerance) {
      return mid;
    }

    if (pv > principal) {
      // Need higher rate to reduce PV
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Calculates present value of an annuity.
 */
function presentValue(rate: number, payment: number, periods: number): number {
  if (rate === 0) return payment * periods;
  return payment * (1 - Math.pow(1 + rate, -periods)) / rate;
}

/**
 * Converts monthly interest rate to annual effective rate.
 *
 * @param monthlyRate - Monthly rate as decimal (e.g., 0.025 = 2.5%)
 * @returns Annual effective rate as decimal (e.g., 0.34 = 34%)
 */
export function monthlyToAnnualRate(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 12) - 1;
}

/**
 * Converts annual effective rate to monthly rate.
 *
 * @param annualRate - Annual rate as decimal (e.g., 0.34 = 34%)
 * @returns Monthly rate as decimal
 */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Calculates the minimum payment amount based on a percentage of balance.
 *
 * @param currentBalance - Current debt balance in pesos
 * @param minPaymentPercent - Minimum payment percentage (e.g., 15 for 15%)
 * @returns Minimum payment amount in pesos
 */
export function calculateMinPayment(
  currentBalance: number,
  minPaymentPercent: number
): number {
  if (currentBalance <= 0) return 0;
  if (minPaymentPercent <= 0) return 0;

  return Math.round(currentBalance * (minPaymentPercent / 100));
}

/**
 * Calculates available credit on a credit card.
 *
 * @param creditLimit - Total credit limit in pesos
 * @param usedAmount - Currently used amount in pesos
 * @returns Available credit in pesos
 */
export function calculateAvailableCredit(
  creditLimit: number,
  usedAmount: number
): number {
  return creditLimit - usedAmount;
}

/**
 * Projects how a debt will be paid off over time with fixed monthly payments.
 *
 * @param currentBalance - Current debt balance in pesos
 * @param monthlyPayment - Fixed monthly payment in pesos
 * @param interestRateMonthly - Monthly interest rate as decimal
 * @returns Projected payoff information
 */
export interface PayoffProjection {
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  isIndefinite: boolean; // True if payment doesn't cover interest
  finalBalance: number; // Should be 0 or negative if overpaid
}

export function projectPayoff(
  currentBalance: number,
  monthlyPayment: number,
  interestRateMonthly: number
): PayoffProjection {
  let balance = currentBalance;
  let totalInterest = 0;
  let months = 0;
  const maxMonths = 360; // 30 years cap

  // Validate: check if payment covers at least the interest
  const monthlyInterest = balance * interestRateMonthly;
  if (monthlyPayment <= monthlyInterest) {
    return {
      monthsToPayoff: Infinity,
      totalInterestPaid: Infinity,
      totalAmountPaid: Infinity,
      isIndefinite: true,
      finalBalance: balance,
    };
  }

  // Simulate month by month
  while (balance > 0 && months < maxMonths) {
    const interest = balance * interestRateMonthly;
    const principal = monthlyPayment - interest;

    totalInterest += interest;
    balance -= principal;
    months++;

    // If we've paid off the balance, cap it at 0
    if (balance < 0) balance = 0;
  }

  return {
    monthsToPayoff: months,
    totalInterestPaid: Math.round(totalInterest),
    totalAmountPaid: Math.round(totalInterest + currentBalance - balance),
    isIndefinite: false,
    finalBalance: Math.round(balance),
  };
}

/**
 * Calculates credit card billing information.
 */
export interface BillingInfo {
  nextPaymentDate: Date;
  minimumPayment: number;
  recommendedPayment: number;
  daysUntilDue: number;
  isOverdue: boolean;
}

export function calculateBillingInfo(
  currentBalance: number,
  paymentDayOfMonth: number,
  minPaymentPercent: number,
  currentDate: Date = new Date()
): BillingInfo {
  const today = new Date(currentDate);
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let nextPaymentMonth = currentMonth;
  let nextPaymentYear = currentYear;

  // If we're past the payment day this month, next payment is next month
  if (currentDay >= paymentDayOfMonth) {
    nextPaymentMonth++;
    if (nextPaymentMonth > 11) {
      nextPaymentMonth = 0;
      nextPaymentYear++;
    }
  }

  const nextPaymentDate = new Date(nextPaymentYear, nextPaymentMonth, paymentDayOfMonth);
  const daysUntilDue = Math.ceil(
    (nextPaymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  const minimumPayment = calculateMinPayment(currentBalance, minPaymentPercent);

  // "Recommended" is typically slightly more than minimum to pay faster
  const recommendedPayment = Math.max(
    minimumPayment,
    Math.round(currentBalance * 0.05) // 5% of balance
  );

  return {
    nextPaymentDate,
    minimumPayment,
    recommendedPayment,
    daysUntilDue: Math.max(0, daysUntilDue),
    isOverdue: daysUntilDue < 0,
  };
}
