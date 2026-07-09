// Centralized currency conversion utilities.
//
// Rate convention (matches `PayPeriodConfig.exchangeRate` and `payroll.ts`):
//   exchangeRate = "1 USD = exchangeRate RMB"   (e.g. ~7.2)
// All aggregates are computed in RMB. USD amounts are converted by
// multiplying by `exchangeRate`.

import type { PayrollRecord } from './types';

/** Safe fallback rate when no valid rate is available (1 USD ≈ 7.2 RMB). */
export const DEFAULT_EXCHANGE_RATE = 7.2;

/** Return a usable rate: the provided one if valid, else the fallback. */
export function effectiveRate(rate: number | undefined | null, fallback = DEFAULT_EXCHANGE_RATE): number {
  return Number.isFinite(rate as number) && (rate as number) > 0 ? (rate as number) : fallback;
}

/**
 * The USD-equivalent payable value of a record.
 *  - USD records: payableAmount (already USD)
 *  - RMB records: payableAmount / rate (RMB -> USD)
 * (HKD is treated as RMB for legacy compatibility.)
 */
export function payableInHKD(rec: PayrollRecord, rate: number): number {
  const r = effectiveRate(rate);
  if (rec.currency === 'USD') {
    return safeNum(rec.payableAmount);
  }
  // RMB
  if (Number.isFinite(rec.payableHKD as number) && (rec.payableHKD as number) > 0) {
    return rec.payableHKD as number;
  }
  return safeNum(rec.payableAmount) / r;
}

/** USD amount -> CNY using the project rate (1 USD = rate RMB). */
export function hkdToCNY(usd: number, rate: number): number {
  const r = effectiveRate(rate);
  return safeNum(usd) * r;
}

/** RMB amount -> USD using the project rate. */
export function cnyToHKD(cny: number, rate: number): number {
  const r = effectiveRate(rate);
  return safeNum(cny) / r;
}

/**
 * The CNY-equivalent payable value of a record.
 * USD records: payable * rate.  RMB records: payable directly.
 */
export function payableInCNY(rec: PayrollRecord, rate: number): number {
  if (rec.currency === 'RMB') return safeNum(rec.payableAmount);
  if (rec.currency === 'HKD') return safeNum(rec.payableAmount); // legacy
  return hkdToCNY(safeNum(rec.payableAmount), rate);
}

/**
 * A per-record multiplier that converts an *original-currency* amount (e.g.
 * accruedSalary, taxWithheld) into its CNY-equivalent, consistent with how the
 * record's own payable converts to CNY.
 */
export function cnyFactor(rec: PayrollRecord, rate: number): number {
  const payableCNY = payableInCNY(rec, rate);
  const base = safeNum(rec.payableAmount);
  return base > 0 ? payableCNY / base : 1;
}

/** Guard against undefined/null/NaN -> 0 (never NaN). */
export function safeNum(v: number | undefined | null): number {
  return Number.isFinite(v as number) ? (v as number) : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
