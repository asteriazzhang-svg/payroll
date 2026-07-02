'use client';

import { useEffect, useState } from 'react';
import { hkdToCnyRateToRmbRate, effectiveRate } from '@/lib/exchange';

export interface ExchangeRateState {
  /** Project rate: "1 RMB = rate HKD" (e.g. ~1.15). */
  rate: number;
  /** Where the rate came from. */
  source: 'live' | 'fallback';
  /** Whether a live fetch is in progress. */
  loading: boolean;
  /** Error message if the live fetch failed (null otherwise). */
  error: string | null;
  /** ISO timestamp of the live quote, when available. */
  fetchedAt: string | null;
}

/**
 * Fetch a live HKD↔CNY rate once on mount and expose it in the project's
 * "1 RMB = X HKD" convention. Falls back to `fallbackRate` (the user's
 * configured rate) when the network call fails.
 *
 * Uses open.er-api.com: free, no API key, CORS-enabled, daily update.
 */
export function useExchangeRate(fallbackRate: number): ExchangeRateState {
  const [state, setState] = useState<ExchangeRateState>(() => ({
    rate: effectiveRate(fallbackRate),
    source: 'fallback',
    loading: true,
    error: null,
    fetchedAt: null,
  }));

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    fetch('https://open.er-api.com/v6/latest/HKD', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { rates?: { CNY?: number }; time_last_update_utc?: string }) => {
        if (cancelled) return;
        const cny = data?.rates?.CNY;
        if (!Number.isFinite(cny) || (cny as number) <= 0) {
          throw new Error('live rate missing CNY');
        }
        const rate = hkdToCnyRateToRmbRate(cny as number);
        setState({
          rate,
          source: 'live',
          loading: false,
          error: null,
          fetchedAt: data?.time_last_update_utc ?? new Date().toISOString(),
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState((s) => ({
          rate: effectiveRate(fallbackRate),
          source: 'fallback',
          loading: false,
          error: err.message || 'fetch failed',
          fetchedAt: null,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackRate]);

  return state;
}
