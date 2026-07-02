// Centralized currency conversion utilities.
//
// Why this exists: the analytics component previously hardcoded `1.07` in ~10
// places and derived a "factor" via `inHKD / rec.payableAmount`. When a record
// had `payableAmount` of 0 / undefined / null, that division produced NaN, which
// propagated into every aggregate and crashed recharts. All currency math now
// funnels through the helpers below, which:
//   - prefer the precomputed `payableHKD` already stored on each record
//   - validate the rate (must be a finite positive number) and fall back to a
//     safe default otherwise
//   - never return NaN — invalid/zero records contribute 0, not NaN.
//
// Rate convention (matches `PayPeriodConfig.exchangeRate` and `payroll.ts`):
//   exchangeRate = "1 RMB = exchangeRate HKD"   (e.g. ~1.15)
// The live API returns "1 HKD = X CNY", so callers convert with
// `hkdToCnyRateToRmbRate()`.

import type { PayrollRecord } from './types';

/** Safe fallback rate when no valid rate is available (1 RMB ≈ 1.15 HKD). */
export const DEFAULT_EXCHANGE_RATE = 1.15;

/**
 * Convert an "1 HKD = X CNY" quote from a forex API into the project's
 * "1 RMB = X HKD" rate. E.g. 0.8665 CNY/HKD -> 1.154 HKD/RMB.
 */
export function hkdToCnyRateToRmbRate(hkdToCny: number): number {
  if (!Number.isFinite(hkdToCny) || hkdToCny <= 0) return DEFAULT_EXCHANGE_RATE;
  const rmbToHkd = 1 / hkdToCny;
  return Number.isFinite(rmbToHkd) && rmbToHkd > 0 ? round4(rmbToHkd) : DEFAULT_EXCHANGE_RATE;
}

/** Return a usable rate: the provided one if valid, else the fallback. */
export function effectiveRate(rate: number | undefined | null, fallback = DEFAULT_EXCHANGE_RATE): number {
  return Number.isFinite(rate as number) && (rate as number) > 0 ? (rate as number) : fallback;
}

/**
 * The HKD-equivalent payable value of a record. Prefers the precomputed
 * `payableHKD` field; otherwise derives it from the record's own currency.
 *
 * The semantics in `payroll.ts` are: `payableHKD` is only populated for RMB
 * records (= `payableAmount * exchangeRate`). For HKD records the payable is
 * already in HKD. So:
 *   - currency HKD  -> payableAmount (already HKD)
 *   - currency RMB  -> payableHKD if present, else payableAmount * rate
 */
export function payableInHKD(rec: PayrollRecord, rate: number): number {
  const r = effectiveRate(rate);
  if (rec.currency === 'HKD') {
    return safeNum(rec.payableAmount);
  }
  // RMB
  if (Number.isFinite(rec.payableHKD as number) && (rec.payableHKD as number) > 0) {
    return rec.payableHKD as number;
  }
  return safeNum(rec.payableAmount) * r;
}

/** HKD amount -> CNY using the project rate (1 RMB = rate HKD). */
export function hkdToCNY(hkd: number, rate: number): number {
  const r = effectiveRate(rate);
  return safeNum(hkd) / r;
}

/** RMB amount -> HKD using the project rate. */
export function cnyToHKD(cny: number, rate: number): number {
  const r = effectiveRate(rate);
  return safeNum(cny) * r;
}

/**
 * The CNY-equivalent payable value of a record.
 * HKD records: payable / rate.  RMB records: payable directly.
 */
export function payableInCNY(rec: PayrollRecord, rate: number): number {
  if (rec.currency === 'RMB') return safeNum(rec.payableAmount);
  return hkdToCNY(safeNum(rec.payableAmount), rate);
}

/**
 * A per-record multiplier that converts an *original-currency* amount (e.g.
 * accruedSalary, taxWithheld) into its CNY-equivalent, consistent with how the
 * record's own payable converts to CNY. This replaces the old
 * `inHKD / payableAmount` ratio that produced NaN.
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
